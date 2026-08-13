-- ============================================================================
-- XLResale — alert delivery + web push
-- Run AFTER the auth-profiles, seller, buyer and admin additions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. QUEUE MATCHES THE MOMENT A SALE GOES PUBLIC
-- ----------------------------------------------------------------------------
-- CLAUDE.md §6 says to call match_sale_to_wishlists() from the Stripe webhook.
-- A trigger is strictly better: it fires however a sale becomes public — the
-- webhook when it exists, an admin putting a listing back on the map, a manual
-- fix in the SQL editor — so the retention hook can't be silently skipped by a
-- code path nobody remembered to wire up. It also means alerts work today,
-- with payments still deferred.
--
-- Fires only on the false -> true transition. Without that guard every later
-- edit to a published sale (a price drop, Go Live) would re-run matching, and
-- while the ON CONFLICT in match_sale_to_wishlists makes that harmless, it is
-- wasted work on every write.
create or replace function public.queue_wishlist_alerts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.listing_paid and (tg_op = 'INSERT' or not coalesce(old.listing_paid, false)) then
    perform public.match_sale_to_wishlists(new.id);
  end if;
  return new;
end $$;

drop trigger if exists sales_queue_alerts on public.sales;
create trigger sales_queue_alerts
  after insert or update of listing_paid on public.sales
  for each row execute function public.queue_wishlist_alerts();

-- ----------------------------------------------------------------------------
-- 2. WEB PUSH SUBSCRIPTIONS
-- ----------------------------------------------------------------------------
-- One row per browser/device that has granted notification permission. The
-- endpoint is the push service's URL for that device and is unique, which
-- doubles as the natural key: re-subscribing the same device must update, not
-- duplicate, or every alert gets sent twice.
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_profile_ix
  on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

-- A shopper manages their own devices. Sending happens with the service role,
-- which is also the only thing that ever needs to read another person's row.
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. PUSH PREFERENCE
-- ----------------------------------------------------------------------------
-- push_enabled already exists on notification_prefs from schema.sql. Default it
-- on for anyone who goes to the trouble of granting browser permission — the
-- permission prompt IS the opt-in, and asking twice reads as broken.
comment on column public.notification_prefs.push_enabled is
  'Send web push for wishlist matches. The browser permission prompt is the real opt-in.';

-- ----------------------------------------------------------------------------
-- 4. WHAT NEEDS SENDING
-- ----------------------------------------------------------------------------
-- Everything the notifier needs in one query: the alert, the sale it matched,
-- and the shopper's channel preferences. Emails live in auth.users, so the
-- sender still resolves those with the service role.
--
-- SECURITY DEFINER + an explicit service-role-only grant: this crosses between
-- shoppers by design and must never be reachable from a browser.
create or replace function public.pending_alerts(in_limit integer default 200)
returns table (
  alert_id      uuid,
  shopper_id    uuid,
  email_enabled boolean,
  push_enabled  boolean,
  matched_term  text,
  sale_id       uuid,
  sale_title    text,
  sale_address  text,
  sale_date     date,
  opens_at      time,
  closes_at     time,
  free_pile     boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id, a.shopper_id, np.email_enabled, np.push_enabled, a.matched_term,
    s.id, s.title, s.address, s.sale_date, s.opens_at, s.closes_at, s.free_pile
  from public.wishlist_alerts a
  join public.sales s on s.id = a.sale_id
  join public.notification_prefs np on np.profile_id = a.shopper_id
  where a.notified_at is null
    and s.listing_paid = true
    -- Never send about a sale that has already happened. An alert queued for a
    -- sale that got published late is worse than no alert at all.
    and s.sale_date >= current_date
  order by a.created_at
  limit in_limit;
$$;

revoke execute on function public.pending_alerts(integer) from public, anon, authenticated;
grant execute on function public.pending_alerts(integer) to service_role;

-- ----------------------------------------------------------------------------
-- 5. FIX match_sale_to_wishlists()
-- ----------------------------------------------------------------------------
-- As shipped in schema-additions-auth-profiles.sql this function could never
-- run. Two faults, both of which only surface when it is actually called — and
-- until the trigger above existed, nothing ever called it:
--
--   1. `w.max_miles * 1609.344` is integer * numeric = numeric, and st_dwithin
--      only overloads geography with double precision.
--   2. `set search_path = public` hides PostGIS, which Supabase installs into
--      the `extensions` schema, so st_dwithin isn't resolvable at all.
--
-- Same two faults I hit writing bulk_lot_audience. Body is otherwise unchanged.
create or replace function public.match_sale_to_wishlists(in_sale_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
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
    and st_dwithin(s.location, p.home_point, (w.max_miles * 1609.344)::double precision)
  on conflict (shopper_id, sale_id) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end $$;
