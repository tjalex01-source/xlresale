-- ============================================================================
-- XLResale — Accounts, Profiles, Wishlists & Finds
-- Addendum to schema.sql. Run this AFTER schema.sql in the Supabase SQL Editor.
--
-- Adds: username/profile fields, "what I'm looking for" wishlists with
-- geo + full-text matching, a match function + alerts queue, and a finds
-- (bargain) tracker with public sharing. Safe to re-run.
--
-- AUTH NOTE: email + password signup/login is handled by Supabase Auth itself
-- (no schema needed). Username below is a unique public handle stored on the
-- profile, not the login credential. Login = email + password. (Optional
-- "log in with username" = a server-side username→email lookup before sign-in.)
-- ============================================================================

create extension if not exists citext with schema extensions;  -- case-insensitive handles


-- ----------------------------------------------------------------------------
-- 1. PROFILE FIELDS: public handle, bio, avatar, visibility
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists username   citext unique,
  add column if not exists bio        text,
  add column if not exists avatar_url text,
  add column if not exists is_public  boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format
      check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$');
  end if;
end $$;

-- Public-safe view: exposes ONLY handle/avatar/bio for public profiles.
-- (Never expose the base profiles row publicly — it holds home_point.)
create or replace view public.public_profiles as
  select id, username, avatar_url, bio
  from public.profiles
  where is_public = true;
grant select on public.public_profiles to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2. WISHLISTS — "what I'm looking for"
-- ----------------------------------------------------------------------------
create table if not exists public.wishlists (
  id          uuid primary key default gen_random_uuid(),
  shopper_id  uuid not null references public.profiles(id) on delete cascade,
  term        text not null,                              -- "vinyl records", "power tools"
  category_id smallint references public.categories(id),  -- optional narrowing
  max_miles   integer not null default 10,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists wishlists_shopper_ix on public.wishlists (shopper_id);

alter table public.wishlists enable row level security;
drop policy if exists wishlists_own on public.wishlists;
create policy wishlists_own on public.wishlists
  for all to authenticated using (shopper_id = auth.uid()) with check (shopper_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 3. FULL-TEXT SEARCH on sales (so wishlist terms can match sale text)
-- ----------------------------------------------------------------------------
alter table public.sales add column if not exists search_tsv tsvector;

create or replace function public.sales_tsv_update()
returns trigger language plpgsql as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('english', coalesce(new.title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.raw_description,'')), 'C');
  return new;
end $$;

drop trigger if exists trg_sales_tsv on public.sales;
create trigger trg_sales_tsv
  before insert or update of title, description, raw_description
  on public.sales for each row execute function public.sales_tsv_update();

create index if not exists sales_search_gin on public.sales using gin (search_tsv);

-- backfill existing rows
update public.sales set search_tsv =
  setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
  setweight(to_tsvector('english', coalesce(description,'')), 'B') ||
  setweight(to_tsvector('english', coalesce(raw_description,'')), 'C');


-- ----------------------------------------------------------------------------
-- 4. ALERTS QUEUE — matches waiting to be delivered by the notifier
-- ----------------------------------------------------------------------------
create table if not exists public.wishlist_alerts (
  id           uuid primary key default gen_random_uuid(),
  shopper_id   uuid not null references public.profiles(id) on delete cascade,
  sale_id      uuid not null references public.sales(id) on delete cascade,
  wishlist_id  uuid references public.wishlists(id) on delete set null,
  matched_term text,
  notified_at  timestamptz,   -- null until the email/push/SMS goes out
  seen_at      timestamptz,   -- null until the shopper opens it
  created_at   timestamptz not null default now(),
  unique (shopper_id, sale_id)
);
create index if not exists alerts_shopper_ix on public.wishlist_alerts (shopper_id);
create index if not exists alerts_undelivered_ix on public.wishlist_alerts (notified_at) where notified_at is null;

alter table public.wishlist_alerts enable row level security;
-- shoppers read their own alerts and can mark them seen; inserts happen via the
-- security-definer match function below (which bypasses RLS), so no insert policy.
drop policy if exists alerts_own_read on public.wishlist_alerts;
create policy alerts_own_read on public.wishlist_alerts
  for select to authenticated using (shopper_id = auth.uid());
drop policy if exists alerts_own_update on public.wishlist_alerts;
create policy alerts_own_update on public.wishlist_alerts
  for update to authenticated using (shopper_id = auth.uid()) with check (shopper_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 5. MATCH FUNCTION — call after a sale is published; queues alerts for
--    every shopper whose active wishlist term matches AND who is in range.
--    Then a notifier job (Vercel/edge) delivers rows where notified_at is null,
--    respecting each shopper's notification_prefs channels.
-- ----------------------------------------------------------------------------
create or replace function public.match_sale_to_wishlists(in_sale_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare inserted int;
begin
  with s as (
    select id, location, search_tsv
    from public.sales
    where id = in_sale_id and listing_paid = true
  )
  insert into public.wishlist_alerts (shopper_id, sale_id, wishlist_id, matched_term)
  select w.shopper_id, s.id, w.id, w.term
  from s
  join public.wishlists w on w.active
  join public.profiles  p on p.id = w.shopper_id and p.home_point is not null
  where s.search_tsv @@ plainto_tsquery('english', w.term)
    and (w.category_id is null
         or exists (select 1 from public.sale_categories sc
                    where sc.sale_id = s.id and sc.category_id = w.category_id))
    and st_dwithin(s.location, p.home_point, w.max_miles * 1609.344)
  on conflict (shopper_id, sale_id) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end $$;

-- Call this right after listing_paid flips true (in the Stripe webhook) and
-- optionally again on Go Live:  select public.match_sale_to_wishlists('<sale-id>');


-- ----------------------------------------------------------------------------
-- 6. FINDS — the bargain tracker + shareable "my hauls"
-- ----------------------------------------------------------------------------
create table if not exists public.finds (
  id         uuid primary key default gen_random_uuid(),
  finder_id  uuid not null references public.profiles(id) on delete cascade,
  sale_id    uuid references public.sales(id) on delete set null,  -- optional: where it was found
  title      text not null,                       -- "1970s Marantz receiver"
  note       text,
  price_paid numeric(10,2),
  est_value  numeric(10,2),                        -- the brag: worth 200, paid 15
  photo_path text,                                 -- path in the 'finds' storage bucket
  is_public  boolean not null default true,
  found_on   date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists finds_finder_ix on public.finds (finder_id);
create index if not exists finds_public_ix on public.finds (is_public, created_at desc);

alter table public.finds enable row level security;
-- the finder fully manages their own finds
drop policy if exists finds_own on public.finds;
create policy finds_own on public.finds
  for all to authenticated using (finder_id = auth.uid()) with check (finder_id = auth.uid());
-- anyone can read PUBLIC finds (this is what makes /u/username + share pages work)
drop policy if exists finds_public_read on public.finds;
create policy finds_public_read on public.finds
  for select to anon, authenticated using (is_public = true);


-- ----------------------------------------------------------------------------
-- 7. STORAGE (dashboard step) — create a bucket named 'finds' (public read).
--    RLS: authenticated users may upload/delete only under their own
--    finder_id/ path prefix. (Claude Code: write the bucket policy; give T.J.
--    the click-by-click dashboard steps.)
-- ============================================================================
