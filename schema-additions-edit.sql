-- ============================================================================
-- XLResale — editing a sale, rescheduling, and re-alerting savers
-- Run AFTER schema-additions-takedown.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RESCHEDULE COUNTER
-- ----------------------------------------------------------------------------
-- CLAUDE.md §6: the $5 buys one sale that never expires and can move to any
-- future date. The abuse guard is a generous COUNT, not a time limit — a host
-- rained out three weekends running is the normal case this has to survive.
alter table public.sales
  add column if not exists reschedule_count smallint not null default 0;

comment on column public.sales.reschedule_count is
  'Times the date has moved. Abuse guard only; a listing never expires.';

-- ----------------------------------------------------------------------------
-- 2. ALERTS GAIN A KIND
-- ----------------------------------------------------------------------------
-- Reschedule and address-move notices reuse the wishlist-alert plumbing, as the
-- brief intends — same queue, same sender, same channel preferences.
--
-- The blocker was UNIQUE (shopper_id, sale_id): it exists so a shopper is never
-- told twice that one sale matched their wishlist, but it also made a second
-- row of ANY sort impossible, so a reschedule notice would silently collide
-- with the original match.
--
-- Replaced with a PARTIAL unique index covering only kind='match'. The dedupe
-- intent survives exactly where it was wanted, and a sale can still be moved
-- more than once without the second notice vanishing.
alter table public.wishlist_alerts
  add column if not exists kind text not null default 'match';

alter table public.wishlist_alerts
  add column if not exists note text;

alter table public.wishlist_alerts
  drop constraint if exists wishlist_alerts_shopper_id_sale_id_key;

create unique index if not exists wishlist_alerts_match_unique
  on public.wishlist_alerts (shopper_id, sale_id)
  where kind = 'match';

comment on column public.wishlist_alerts.kind is
  'match | rescheduled | moved — decides which copy the sender uses.';
comment on column public.wishlist_alerts.note is
  'Human-readable summary of what changed, e.g. "moved to Sat, Aug 22".';

-- ----------------------------------------------------------------------------
-- 3. TELL THE PEOPLE WHO SAVED IT
-- ----------------------------------------------------------------------------
-- Inserts one alert per shopper who saved this sale. SECURITY DEFINER because
-- it writes rows belonging to other people, which no client may do — so the
-- host check inside is the access control, not RLS.
--
-- Skips the host: hosts frequently save their own sale to see how it looks, and
-- emailing someone about a change they just made themselves reads as a bug.
create or replace function public.notify_sale_watchers(
  in_sale_id uuid,
  in_kind    text,
  in_note    text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  host uuid;
  inserted integer;
begin
  select host_id into host from public.sales where id = in_sale_id;
  if host is null then return 0; end if;
  if host <> auth.uid() then return -1; end if;          -- not your sale

  if in_kind not in ('rescheduled', 'moved') then return -1; end if;

  insert into public.wishlist_alerts (shopper_id, sale_id, wishlist_id, matched_term, kind, note)
  select w.shopper_id, in_sale_id, null, null, in_kind, in_note
  from public.sale_watchers w
  where w.shopper_id <> host;

  get diagnostics inserted = row_count;
  return inserted;
end $$;

revoke execute on function public.notify_sale_watchers(uuid, text, text) from public, anon;
grant execute on function public.notify_sale_watchers(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. HOW FAR DID IT MOVE?
-- ----------------------------------------------------------------------------
-- A host correcting a typo in their own street name should not fire a
-- notification to everyone who saved it. A quarter of a mile is past
-- "same driveway, better geocode" and into "you'd drive somewhere else".
create or replace function public.sale_move_miles(in_sale_id uuid, in_lat double precision, in_lng double precision)
returns double precision
language sql
security definer
set search_path = public, extensions
stable
as $$
  select st_distance(s.location, st_point(in_lng, in_lat)::geography) / 1609.344
  from public.sales s
  where s.id = in_sale_id;
$$;

grant execute on function public.sale_move_miles(uuid, double precision, double precision) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. THE SENDER NEEDS THE KIND
-- ----------------------------------------------------------------------------
-- Same queue, three different messages.
-- Return type gains two columns, which CREATE OR REPLACE cannot do.
drop function if exists public.pending_alerts(integer);

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
  free_pile     boolean,
  kind          text,
  note          text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id, a.shopper_id, np.email_enabled, np.push_enabled, a.matched_term,
    s.id, s.title,
    case
      when public.sale_shows_exact_address(s.sale_date, s.opens_at, s.closes_at, s.time_zone)
        then s.address
      else public.coarse_address(s.address)
    end,
    s.sale_date, s.opens_at, s.closes_at, s.free_pile,
    a.kind, a.note
  from public.wishlist_alerts a
  join public.sales s on s.id = a.sale_id
  join public.notification_prefs np on np.profile_id = a.shopper_id
  where a.notified_at is null
    and s.listing_paid = true
    and s.hidden_at is null
    and s.sale_date >= current_date
  order by a.created_at
  limit in_limit;
$$;

revoke execute on function public.pending_alerts(integer) from public, anon, authenticated;
grant execute on function public.pending_alerts(integer) to service_role;

-- ----------------------------------------------------------------------------
-- 6. THE ARBITER MOVED WITH THE CONSTRAINT
-- ----------------------------------------------------------------------------
-- Replacing the blanket UNIQUE with a partial index broke this function, which
-- names (shopper_id, sale_id) as its ON CONFLICT arbiter: a partial unique
-- index only qualifies if the statement repeats the index predicate, so without
-- the WHERE it fails with "no unique or exclusion constraint matching the ON
-- CONFLICT specification" — and every wishlist match with it.
--
-- Caught by the trigger firing during a test insert. Nothing in the type system
-- or the build would have shown it.
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
  insert into public.wishlist_alerts (shopper_id, sale_id, wishlist_id, matched_term, kind)
  select w.shopper_id, s.id, w.id, w.term, 'match'
  from s
  join public.wishlists w on w.active
  join public.profiles  p on p.id = w.shopper_id and p.home_point is not null
  where s.search_tsv @@ plainto_tsquery('english', w.term)
    and (w.category_id is null
         or exists (select 1 from public.sale_categories sc
                    where sc.sale_id = s.id and sc.category_id = w.category_id))
    and st_dwithin(s.location, p.home_point, (w.max_miles * 1609.344)::double precision)
  on conflict (shopper_id, sale_id) where kind = 'match' do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end $$;
