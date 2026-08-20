-- ============================================================================
-- XLResale — host takedown + rate limiting
-- Run AFTER schema-additions-address-policy.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HIDING IS NOT UNPAYING
-- ----------------------------------------------------------------------------
-- The admin console currently takes a sale off the map by flipping
-- listing_paid to false. That is wrong in two ways, and giving hosts the same
-- button would have made it worse:
--
--   * CLAUDE.md §13 — listing_paid is payment state, written only by the
--     verified Stripe webhook. Using it as a visibility switch means a
--     takedown looks like a refund.
--   * Restoring it flips false -> true, which is exactly the transition
--     sales_queue_alerts watches. Every restore would re-blast the wishlist
--     alerts for that sale to everyone who matched it.
--
-- So visibility gets its own column. Payment state is left alone.
alter table public.sales
  add column if not exists hidden_at timestamptz;

-- Who hid it matters. A host must be able to pull their own sale down
-- instantly and put it back — but must NOT be able to undo a moderation
-- decision by tapping "show again".
alter table public.sales
  add column if not exists hidden_by_admin boolean not null default false;

comment on column public.sales.hidden_at is
  'Non-null = off the map. Visibility only; never payment state.';
comment on column public.sales.hidden_by_admin is
  'True when an admin hid it. The host cannot un-hide those.';

-- ----------------------------------------------------------------------------
-- 2. THE HOST'S OWN TAKEDOWN
-- ----------------------------------------------------------------------------
-- A function rather than an RLS-guarded update, because the rule is
-- conditional: hide is always allowed, un-hide only when an admin wasn't the
-- one who hid it. Expressing that as a WITH CHECK is possible but reads as a
-- puzzle; here the intent is legible and the ownership check is explicit.
--
-- Returns a status string so the UI can say which of the three things happened.
create or replace function public.set_sale_hidden(in_sale_id uuid, in_hidden boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare s record;
begin
  select id, host_id, hidden_at, hidden_by_admin into s
  from public.sales where id = in_sale_id;

  if not found then return 'not_found'; end if;
  if s.host_id <> auth.uid() then return 'forbidden'; end if;

  if in_hidden then
    -- Don't clear an admin's flag by hiding something already hidden.
    update public.sales
       set hidden_at = coalesce(hidden_at, now()),
           hidden_by_admin = case when hidden_at is null then false else hidden_by_admin end
     where id = in_sale_id;
    return 'hidden';
  end if;

  if s.hidden_by_admin then return 'admin_locked'; end if;

  update public.sales set hidden_at = null where id = in_sale_id;
  return 'visible';
end $$;

revoke execute on function public.set_sale_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_sale_hidden(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. HIDDEN MEANS HIDDEN EVERYWHERE
-- ----------------------------------------------------------------------------
-- A takedown that only removes the pin is not a takedown. Every public surface
-- has to honour it, or a host who felt unsafe is still findable by whichever
-- route was missed.
create or replace view public.public_sales as
select
  s.id, s.host_id, s.title, s.description,
  case when e.exact then s.address else public.coarse_address(s.address) end as address,
  case when e.exact then st_y(s.location::geometry) else public.coarse_lat(s.location) end as lat,
  case when e.exact then st_x(s.location::geometry) else public.coarse_lng(s.location) end as lng,
  s.sale_date, s.opens_at, s.closes_at, s.time_zone, s.status,
  s.free_pile, s.free_pile_note, s.discount_percent, s.discount_active,
  e.exact as location_is_exact
from public.sales s
cross join lateral (
  select public.sale_shows_exact_address(s.sale_date, s.opens_at, s.closes_at, s.time_zone) as exact
) e
where s.listing_paid = true
  and s.hidden_at is null
  and s.sale_date <= current_date + 7;

grant select on public.public_sales to anon, authenticated;

create or replace function public.sales_near_upcoming(
  in_lat   double precision,
  in_lng   double precision,
  in_miles double precision default 5,
  in_days  integer default 7
)
returns setof public.nearby_sale
language sql
security definer
set search_path = public, extensions
stable
as $$
  select
    s.id, s.host_id, s.title, s.description,
    case when e.exact then s.address else public.coarse_address(s.address) end,
    case when e.exact then st_y(s.location::geometry) else public.coarse_lat(s.location) end,
    case when e.exact then st_x(s.location::geometry) else public.coarse_lng(s.location) end,
    s.sale_date, s.opens_at, s.closes_at, s.time_zone, s.status,
    s.free_pile, s.discount_percent, s.discount_active,
    st_distance(s.location, st_point(in_lng, in_lat)::geography) / 1609.344,
    coalesce(array_agg(c.slug) filter (where c.slug is not null), '{}'),
    e.exact
  from public.sales s
  cross join lateral (
    select public.sale_shows_exact_address(s.sale_date, s.opens_at, s.closes_at, s.time_zone) as exact
  ) e
  left join public.sale_categories sc on sc.sale_id = s.id
  left join public.categories c       on c.id = sc.category_id
  where s.listing_paid = true
    and s.hidden_at is null
    and s.sale_date >= current_date
    and s.sale_date < current_date + make_interval(days => in_days)
    and st_dwithin(s.location, st_point(in_lng, in_lat)::geography, in_miles * 1609.344)
  group by s.id, e.exact
  order by s.sale_date asc, 16 asc;
$$;

grant execute on function public.sales_near_upcoming(double precision, double precision, double precision, integer) to anon, authenticated;

-- Saved sales too: someone who saved it before the takedown should stop being
-- routed to the door.
create or replace function public.my_saved_sales()
returns setof public.nearby_sale
language sql
security definer
set search_path = public, extensions
stable
as $$
  select
    s.id, s.host_id, s.title, s.description,
    case when e.exact then s.address else public.coarse_address(s.address) end,
    case when e.exact then st_y(s.location::geometry) else public.coarse_lat(s.location) end,
    case when e.exact then st_x(s.location::geometry) else public.coarse_lng(s.location) end,
    s.sale_date, s.opens_at, s.closes_at, s.time_zone, s.status,
    s.free_pile, s.discount_percent, s.discount_active,
    coalesce(
      st_distance(s.location, (select home_point from public.profiles where id = auth.uid()))
        / 1609.344, 0),
    coalesce(array_agg(c.slug) filter (where c.slug is not null), '{}'),
    e.exact
  from public.sale_watchers w
  join public.sales s on s.id = w.sale_id
  cross join lateral (
    select public.sale_shows_exact_address(s.sale_date, s.opens_at, s.closes_at, s.time_zone) as exact
  ) e
  left join public.sale_categories sc on sc.sale_id = s.id
  left join public.categories c       on c.id = sc.category_id
  where w.shopper_id = auth.uid()
    and s.hidden_at is null
  group by s.id, e.exact
  order by s.sale_date, s.opens_at;
$$;

grant execute on function public.my_saved_sales() to authenticated;

-- A hidden sale must also stop generating alerts.
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
    s.id, s.title,
    -- Alerts go out before the sale opens, so they carry the coarse address
    -- for the same reason the map does.
    case
      when public.sale_shows_exact_address(s.sale_date, s.opens_at, s.closes_at, s.time_zone)
        then s.address
      else public.coarse_address(s.address)
    end,
    s.sale_date, s.opens_at, s.closes_at, s.free_pile
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
-- 4. RATE LIMITING
-- ----------------------------------------------------------------------------
-- Postgres-backed rather than in-memory. Serverless instances come and go and
-- there are several at once, so an in-process counter enforces nothing in
-- particular — it just makes the graph look reassuring.
--
-- RLS on with no policies: reachable only through the function below, which
-- runs as owner and is granted to service_role alone.
create table if not exists public.rate_limits (
  bucket       text primary key,
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);

alter table public.rate_limits enable row level security;

-- Returns true when the call is allowed. One statement, so two requests
-- arriving together can't both read a stale count and both decide they're fine.
create or replace function public.rate_limit_hit(
  in_bucket         text,
  in_limit          integer,
  in_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare updated record;
begin
  insert into public.rate_limits (bucket, window_start, hits)
  values (in_bucket, now(), 1)
  on conflict (bucket) do update
    set hits = case
                 when rate_limits.window_start < now() - make_interval(secs => in_window_seconds)
                 then 1
                 else rate_limits.hits + 1
               end,
        window_start = case
                 when rate_limits.window_start < now() - make_interval(secs => in_window_seconds)
                 then now()
                 else rate_limits.window_start
               end
  returning * into updated;

  return updated.hits <= in_limit;
end $$;

revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
