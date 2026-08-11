-- ============================================================================
-- XLResale — Seller side: featured items, pricing controls, free pile
-- Addendum to schema.sql. Run AFTER schema.sql (order vs. the auth/profiles
-- addendum doesn't matter). Safe to re-run.
--
-- Adds:
--   • sale_items      — the host's 10-20 FEATURED items (not full inventory):
--                       price, R2 photo, TAP-TO-MARK-SOLD, own price drop,
--                       and a lock flag to exclude an item from bulk discounts.
--   • sales pricing   — a sale-wide discount_percent (preset tiers 10/25/50/75
--                       or custom) + discount_active, and a FREE-PILE toggle
--                       that drives a pin badge and a map filter.
--   • effective_price — one helper so the app never re-derives pricing rules.
--
-- PRICING RULES (single source of truth — implement everywhere from here):
--   1. An item's base price is sale_items.price.
--   2. If the item has its own drop (item_discount_percent > 0), apply it.
--   3. If the SALE has discount_active, and the item is NOT locked
--      (exclude_from_bulk = false), apply the sale-wide discount_percent too.
--   4. When both an item drop and the sale-wide drop apply, DISPLAY THE LOWER
--      price (never accidentally raise a hand-cut price). Show a strikethrough.
--   5. Locked items ignore the sale-wide discount entirely (the pressure washer).
--   6. Sold items show as sold and drop out of "still available" + wishlist logic.
--
-- PHOTOS: item photos live in Cloudflare R2, not Supabase Storage. Store only
--   the R2 object key here (photo_key). Browser uploads go straight to R2 via a
--   presigned URL minted by a Vercel function; the key is saved on the row after.
--   Public bucket (sale photos are public), so access control is at the bucket,
--   not RLS. (Claude Code: build the presigned-upload route + R2 client.)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. SALE-LEVEL PRICING + FREE PILE
-- ----------------------------------------------------------------------------
alter table public.sales
  add column if not exists discount_percent  smallint not null default 0
     check (discount_percent between 0 and 95),
  add column if not exists discount_active   boolean  not null default false,
  add column if not exists free_pile         boolean  not null default false,
  add column if not exists free_pile_note    text;

-- index so the map can cheaply filter "sales with a free pile"
create index if not exists sales_free_pile_ix on public.sales (free_pile) where free_pile = true;


-- ----------------------------------------------------------------------------
-- 2. FEATURED ITEMS (the 10-20 best — never a required full inventory)
-- ----------------------------------------------------------------------------
create table if not exists public.sale_items (
  id                     uuid primary key default gen_random_uuid(),
  sale_id                uuid not null references public.sales(id) on delete cascade,
  name                   text not null,
  price                  numeric(10,2) not null,
  item_discount_percent  smallint not null default 0
                           check (item_discount_percent between 0 and 95),  -- per-item drop
  exclude_from_bulk      boolean not null default false,  -- the lock (top-dollar items)
  is_sold                boolean not null default false,  -- tap-to-mark-sold
  sold_at                timestamptz,
  photo_key              text,                            -- Cloudflare R2 object key
  position               smallint not null default 0,     -- display order
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists sale_items_sale_ix on public.sale_items (sale_id, position);

drop trigger if exists trg_sale_items_touch on public.sale_items;
create trigger trg_sale_items_touch before update on public.sale_items
  for each row execute function public.touch_updated_at();

-- stamp sold_at when an item is tapped sold (and clear it if un-sold)
create or replace function public.stamp_item_sold()
returns trigger language plpgsql as $$
begin
  if new.is_sold and not old.is_sold then new.sold_at = now();
  elsif not new.is_sold and old.is_sold then new.sold_at = null;
  end if;
  return new;
end $$;

drop trigger if exists trg_sale_items_sold on public.sale_items;
create trigger trg_sale_items_sold before update of is_sold on public.sale_items
  for each row execute function public.stamp_item_sold();


-- ----------------------------------------------------------------------------
-- 3. EFFECTIVE-PRICE HELPER — the pricing rules in ONE place.
--    Returns the price a buyer actually pays for an item right now, given the
--    item's own drop, the sale-wide discount, and the lock flag ("lower wins").
-- ----------------------------------------------------------------------------
create or replace function public.item_effective_price(
  base_price       numeric,
  item_discount    smallint,
  sale_discount    smallint,
  sale_active      boolean,
  excluded         boolean
) returns numeric
language sql immutable as $$
  select round(
    least(
      -- price after the item's own drop
      base_price * (1 - item_discount / 100.0),
      -- price after the sale-wide drop (only if active and not locked)
      case when sale_active and not excluded
           then base_price * (1 - sale_discount / 100.0)
           else base_price end
    ), 2);
$$;

-- Convenience view: every featured item with its live effective price + sale flags.
-- (security_invoker so the public only sees items of published sales via sales RLS.)
create or replace view public.sale_items_priced
  with (security_invoker = on) as
  select
    i.*,
    s.discount_active,
    s.discount_percent as sale_discount_percent,
    public.item_effective_price(
      i.price, i.item_discount_percent, s.discount_percent, s.discount_active, i.exclude_from_bulk
    ) as effective_price
  from public.sale_items i
  join public.sales s on s.id = i.sale_id;
grant select on public.sale_items_priced to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.sale_items enable row level security;

-- public reads items of published sales; host fully controls their own
drop policy if exists sale_items_read on public.sale_items;
create policy sale_items_read on public.sale_items
  for select to anon, authenticated using (
    exists (select 1 from public.sales s
            where s.id = sale_id and (s.listing_paid = true or s.host_id = auth.uid()))
  );
drop policy if exists sale_items_write on public.sale_items;
create policy sale_items_write on public.sale_items
  for all to authenticated using (
    exists (select 1 from public.sales s where s.id = sale_id and s.host_id = auth.uid())
  ) with check (
    exists (select 1 from public.sales s where s.id = sale_id and s.host_id = auth.uid())
  );


-- ----------------------------------------------------------------------------
-- 5. REALTIME — item + pricing changes update the sale page and pin live
--    (sales is already in the publication from schema.sql; add sale_items)
-- ----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.sale_items;
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- SELLER TAP-ACTIONS the app wires to this schema:
--   • Mark sold        → update sale_items set is_sold = true where id = ...
--   • Drop one item    → update sale_items set item_discount_percent = 25 ...
--   • Lock from bulk   → update sale_items set exclude_from_bulk = true ...
--   • Bulk tier        → update sales set discount_percent = 25, discount_active = true
--   • Step down / end  → update sales set discount_percent = 50  (or discount_active = false)
--   • Free pile        → update sales set free_pile = true, free_pile_note = '...'
-- The tap-to-total calculator sums sale_items_priced.effective_price for the
-- chosen items (+ any loose entries) and can mark them sold in the same action.
-- ============================================================================
