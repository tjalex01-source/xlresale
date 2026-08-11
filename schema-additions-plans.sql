-- ============================================================================
-- XLResale — Listing plans, credits & photo retention
-- Addendum to schema.sql. Run AFTER schema.sql. Safe to re-run.
--
-- THE THREE THINGS A HOST CAN BUY (single source of truth — price them here,
-- read them everywhere):
--   • single    $5   → 1 listing credit.  Never expires.
--   • four_pack $12  → 4 listing credits. Never expire.
--   • annual    $60  → unlimited listings for 12 months.
--
-- Credits and the subscription are DIFFERENT things and are stored separately:
-- a credit is a consumable bought once and kept forever; the subscription is a
-- capability that lapses on a date. Someone can hold both.
--
-- PUBLISHING A SALE consumes exactly one credit — unless the host has an active
-- annual plan, in which case nothing is consumed. Always go through
-- consume_listing_credit(); it is atomic, so two sales published at the same
-- moment cannot spend the same last credit twice.
--
-- PHOTO RETENTION: sale photos are deleted 60 days after the SALE DATE (not the
-- upload date — a listing never expires and can be rescheduled far into the
-- future, so upload time says nothing about when the sale happened). Hosts on an
-- active annual plan keep theirs; that is a headline reason to buy it.
--   Only the IMAGES are purged. The sale row, its items, names and prices stay —
--   they cost almost nothing and they power "relist this sale", the host's
--   history, and the provenance of shoppers' finds.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. WHAT A HOST HOLDS
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists listing_credits integer not null default 0
     check (listing_credits >= 0),
  add column if not exists plan text not null default 'free'
     check (plan in ('free', 'annual')),
  add column if not exists plan_renews_at timestamptz;   -- null unless annual

-- ----------------------------------------------------------------------------
-- 2. PURCHASE LEDGER — every payment, one row.
--    stripe_payment_id is UNIQUE, which is what makes the webhook idempotent:
--    Stripe retries deliveries, and without this a retry would grant the credits
--    twice. Insert here FIRST, and only grant on a fresh insert.
-- ----------------------------------------------------------------------------
create table if not exists public.listing_purchases (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  sku               text not null check (sku in ('single', 'four_pack', 'annual')),
  credits_granted   integer not null default 0,
  amount_cents      integer not null,
  stripe_payment_id text unique,
  created_at        timestamptz not null default now()
);
create index if not exists listing_purchases_profile_ix
  on public.listing_purchases (profile_id, created_at desc);

alter table public.listing_purchases enable row level security;
-- a host reads their own receipts; only the webhook (service role) writes.
drop policy if exists purchases_own_read on public.listing_purchases;
create policy purchases_own_read on public.listing_purchases
  for select to authenticated using (profile_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 3. IS THE SUBSCRIPTION LIVE?  One definition, used by everything below.
-- ----------------------------------------------------------------------------
create or replace function public.has_active_annual(in_profile uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1 from public.profiles
    where id = in_profile
      and plan = 'annual'
      and plan_renews_at is not null
      and plan_renews_at > now()
  );
$$;


-- ----------------------------------------------------------------------------
-- 4. SPEND A CREDIT — atomic. Returns true if the sale may be published.
--    The `and listing_credits > 0` in the UPDATE is the lock: concurrent callers
--    serialise on the row, so the balance can never go negative.
-- ----------------------------------------------------------------------------
create or replace function public.consume_listing_credit(in_profile uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare spent integer;
begin
  if public.has_active_annual(in_profile) then
    return true;                      -- unlimited: nothing to spend
  end if;

  update public.profiles
     set listing_credits = listing_credits - 1
   where id = in_profile
     and listing_credits > 0;

  get diagnostics spent = row_count;
  return spent = 1;
end $$;


-- ----------------------------------------------------------------------------
-- 5. PHOTO RETENTION
-- ----------------------------------------------------------------------------
alter table public.sales
  add column if not exists photos_purged_at timestamptz;

-- How long free/credit hosts keep sale photos. Change it here only.
create or replace function public.photo_retention_days()
returns integer language sql immutable as $$ select 60; $$;

-- Everything the nightly purge job needs, with the rule in one place.
-- The job deletes these sales' R2 objects, clears sale_photos, nulls
-- sale_items.photo_key, then stamps sales.photos_purged_at.
create or replace view public.sales_photo_purge_due as
  select
    s.id        as sale_id,
    s.host_id,
    s.sale_date,
    s.sale_date + public.photo_retention_days() as purge_on
  from public.sales s
  where s.photos_purged_at is null
    and s.sale_date < current_date - public.photo_retention_days()
    and not public.has_active_annual(s.host_id);

-- Sales whose photos come down soon — drives the "download or upgrade" email.
create or replace view public.sales_photo_purge_warning as
  select
    s.id        as sale_id,
    s.host_id,
    s.sale_date,
    s.sale_date + public.photo_retention_days() as purge_on
  from public.sales s
  where s.photos_purged_at is null
    and not public.has_active_annual(s.host_id)
    and s.sale_date + public.photo_retention_days() between current_date and current_date + 7;

-- Both views are read by the cron job with the service key. They are NOT granted
-- to anon/authenticated: they expose host_id across all accounts.

-- ============================================================================
-- WEBHOOK CONTRACT (Phase 3) — on checkout.session.completed:
--   1. insert into listing_purchases (..., stripe_payment_id) -- unique = idempotent
--   2. if that insert was fresh:
--        single    -> profiles.listing_credits += 1
--        four_pack -> profiles.listing_credits += 4
--        annual    -> plan='annual', plan_renews_at = greatest(now(), coalesce(plan_renews_at, now())) + 1 year
--   3. publishing a sale calls consume_listing_credit() and only then sets listing_paid
-- ============================================================================
