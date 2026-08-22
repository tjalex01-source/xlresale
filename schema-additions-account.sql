-- ============================================================================
-- XLResale — comped listings, account deletion, audit-trail fix
-- Run AFTER schema-additions-edit.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. THE AUDIT TRAIL COULD NOT OUTLIVE ITS ACTOR
-- ----------------------------------------------------------------------------
-- admin_actions.actor_id was NOT NULL *and* ON DELETE SET NULL. Those
-- contradict: deleting a profile makes Postgres try to null the column, which
-- the NOT NULL then refuses, so the delete fails outright.
--
-- Nobody hit it because the 29 accounts deleted so far had never performed an
-- admin action. It would have fired the first time an admin deleted their own
-- account — which is exactly what the deletion path below does.
--
-- Nullable is the right answer regardless: an audit trail should survive the
-- person it describes. A row saying "somebody, now deleted, suspended this
-- account" is still worth more than no row.
alter table public.admin_actions
  alter column actor_id drop not null;

-- ----------------------------------------------------------------------------
-- 2. COMPED LISTINGS
-- ----------------------------------------------------------------------------
-- CLAUDE.md §13 reserves listing_paid for the verified Stripe webhook. An admin
-- comp is the one legitimate exception, so it records itself as one rather than
-- pretending to be a payment — otherwise every future revenue figure quietly
-- counts listings nobody paid for.
--
-- This is also the mechanism the brief already asks for by another name: the
-- "rain-check credit — a free relist rather than a cash refund".
alter table public.sales
  add column if not exists comped_at     timestamptz,
  add column if not exists comped_reason text;

comment on column public.sales.comped_at is
  'Set when an admin published this without payment. Null for real Stripe payments.';

-- ----------------------------------------------------------------------------
-- 3. DELETING YOUR OWN ACCOUNT
-- ----------------------------------------------------------------------------
-- What actually goes when an account is deleted, so the privacy policy can say
-- it accurately. Everything below cascades from auth.users -> profiles:
--
--   profiles, notification_prefs, push_subscriptions
--   sales (and their photos, items, categories, watchers)
--   sale_watchers, saved_routes, wishlists, wishlist_alerts, finds
--
-- Two things deliberately survive:
--   * admin_actions rows, with actor_id nulled (see 1) — the record of a
--     moderation decision has to outlast the moderator.
--   * Nothing else. There is no soft-delete and no shadow copy.
--
-- This function exists so the app can show someone what they're about to lose
-- BEFORE they confirm, rather than after.
create or replace function public.my_account_footprint()
returns table (
  sales_count     bigint,
  saved_count     bigint,
  finds_count     bigint,
  wishlists_count bigint,
  devices_count   bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.sales where host_id = auth.uid()),
    (select count(*) from public.sale_watchers where shopper_id = auth.uid()),
    (select count(*) from public.finds where finder_id = auth.uid()),
    (select count(*) from public.wishlists where shopper_id = auth.uid()),
    (select count(*) from public.push_subscriptions where profile_id = auth.uid())
  where auth.uid() is not null;
$$;

revoke execute on function public.my_account_footprint() from public, anon;
grant execute on function public.my_account_footprint() to authenticated;
