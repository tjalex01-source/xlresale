-- ============================================================================
-- XLResale — host address precision policy
-- Run AFTER schema-additions-security.sql.
--
-- The rule, in one line: precision exists only while somebody has a real
-- reason to drive there.
--
--   before sale day   block level   you are planning, not navigating
--   sale day, open    exact         you need the driveway
--   after close       block level   nobody needs to navigate to a finished sale
--
-- Why this is enforced here and not in the UI: the anon key ships in the
-- JavaScript bundle and PostgREST exposes every table it can read. A pin
-- coarsened in React is decoration — anyone can open the network tab. So the
-- database never hands out an exact address outside the window at all.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. THE WINDOW
-- ----------------------------------------------------------------------------
-- Deliberately time-based rather than keyed to the host tapping Go Live. Go
-- Live already carries the status signal; if it also controlled findability, a
-- host who forgot to tap it would leave shoppers on the right street with no
-- house number. Nothing to remember, nothing to forget.
--
-- Hours are wall-clock local to the sale, so every comparison goes through the
-- sale's own time_zone.
create or replace function public.sale_shows_exact_address(
  in_sale_date date,
  in_opens_at  time,
  in_closes_at time,
  in_time_zone text
)
returns boolean
language sql
stable
as $$
  select (now() at time zone coalesce(in_time_zone, 'America/Chicago'))
           >= (in_sale_date + in_opens_at - interval '30 minutes')
     and (now() at time zone coalesce(in_time_zone, 'America/Chicago'))
           <  (in_sale_date + in_closes_at + interval '3 hours');
$$;

-- ----------------------------------------------------------------------------
-- 2. COARSENING — DETERMINISTIC, NEVER RANDOM
-- ----------------------------------------------------------------------------
-- Snapped to a fixed grid, so the same sale always yields the same coarse
-- point. Random jitter would look private and not be: pull the same sale
-- repeatedly, average the offsets, and the true location falls out. A grid
-- gives no extra information no matter how many times it is read.
--
-- ~0.002 deg latitude is about 220m; longitude is widened because degrees of
-- longitude are shorter away from the equator, so the cell stays roughly
-- square at Texas latitudes.
create or replace function public.coarse_lat(g geography)
returns double precision
language sql immutable
as $$ select round((st_y(g::geometry) / 0.002)::numeric)::double precision * 0.002; $$;

create or replace function public.coarse_lng(g geography)
returns double precision
language sql immutable
as $$ select round((st_x(g::geometry) / 0.0025)::numeric)::double precision * 0.0025; $$;

-- "1234 W Main St, Bullard, TX" -> "1200 block of W Main St, Bullard, TX"
--
-- Shows the block rather than hiding the location: a shopper can plan around
-- it and can see plainly what they are being told. A blank pin with no text
-- reads as a broken listing and invites nobody.
create or replace function public.coarse_address(in_address text)
returns text
language sql immutable
as $$
  select case
    when in_address ~ '^\s*\d+\s' then
      case
        when (substring(in_address from '^\s*(\d+)'))::bigint >= 100
          then (floor((substring(in_address from '^\s*(\d+)'))::bigint / 100.0) * 100)::bigint::text
               || ' block of ' || regexp_replace(in_address, '^\s*\d+\s+', '')
        -- House numbers under 100 have no meaningful block; naming "0 block of"
        -- would be worse than saying nothing precise at all.
        else 'Near ' || regexp_replace(in_address, '^\s*\d+\s+', '')
      end
    else in_address
  end;
$$;

-- ----------------------------------------------------------------------------
-- 3. THE PUBLIC SURFACE
-- ----------------------------------------------------------------------------
-- A view, because the policy has to be applied by the database on the way out.
-- It runs with the owner's rights (the default for a view), which means RLS on
-- `sales` is NOT consulted — so the WHERE clause below IS the access rule and
-- has to be complete. Same pattern as public_profiles.
--
-- Two gates:
--   listing_paid          drafts are never public
--   sale_date window      enforces the "visible in the ~7 days before" rule
--                         from CLAUDE.md §6, which until now lived only inside
--                         sales_near_upcoming() and was bypassed entirely by a
--                         direct query. Past sales stay readable, coarsened, so
--                         saved lists and shared links don't rot.
create or replace view public.public_sales as
select
  s.id,
  s.host_id,
  s.title,
  s.description,
  case when e.exact then s.address else public.coarse_address(s.address) end as address,
  case when e.exact then st_y(s.location::geometry) else public.coarse_lat(s.location) end as lat,
  case when e.exact then st_x(s.location::geometry) else public.coarse_lng(s.location) end as lng,
  s.sale_date,
  s.opens_at,
  s.closes_at,
  s.time_zone,
  s.status,
  s.free_pile,
  s.free_pile_note,
  s.discount_percent,
  s.discount_active,
  e.exact as location_is_exact
from public.sales s
cross join lateral (
  select public.sale_shows_exact_address(s.sale_date, s.opens_at, s.closes_at, s.time_zone) as exact
) e
where s.listing_paid = true
  and s.sale_date <= current_date + 7;

grant select on public.public_sales to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. THE HOST'S OWN SURFACE
-- ----------------------------------------------------------------------------
-- A host must always see their real address — it's theirs. Also owner-rights,
-- so the auth.uid() filter is the access rule.
create or replace view public.host_sales as
select s.*
from public.sales s
where s.host_id = auth.uid();

grant select on public.host_sales to authenticated;

-- ----------------------------------------------------------------------------
-- 5. CLOSE THE DIRECT PATH
-- ----------------------------------------------------------------------------
-- With the views in place, nothing outside the database needs raw address or
-- location. Revoking them is what turns the policy from a convention into a
-- guarantee: even a hand-written PostgREST query cannot reach them.
revoke select on public.sales from anon, authenticated;

grant select (
  id, host_id, title, description,
  sale_date, opens_at, closes_at, time_zone,
  status, went_live_at, listing_paid,
  discount_percent, discount_active,
  free_pile, free_pile_note,
  photos_purged_at, created_at, updated_at
) on public.sales to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. THE RPCs HAND OUT COORDINATES TOO
-- ----------------------------------------------------------------------------
-- The map and route planner read lat/lng through these, so coarsening the view
-- alone would leave the exact point one RPC call away.
--
-- They must also become SECURITY DEFINER: as SECURITY INVOKER they read
-- s.address and s.location as the caller, and the revoke above would break
-- them for every non-admin. Running as owner, they read the columns and decide
-- what to emit — which is where the decision belongs anyway.
--
-- Return type gains location_is_exact, so the UI can say which it is showing.
drop function if exists public.sales_near_upcoming(double precision, double precision, double precision, integer);
drop function if exists public.sales_near_me(double precision, integer);
drop function if exists public.my_saved_sales();
drop type if exists public.nearby_sale;

create type public.nearby_sale as (
  id                uuid,
  host_id           uuid,
  title             text,
  description       text,
  address           text,
  lat               double precision,
  lng               double precision,
  sale_date         date,
  opens_at          time,
  closes_at         time,
  time_zone         text,
  status            public.sale_status,
  free_pile         boolean,
  discount_percent  smallint,
  discount_active   boolean,
  distance_miles    double precision,
  categories        text[],
  location_is_exact boolean
);

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
    and s.sale_date >= current_date
    and s.sale_date < current_date + make_interval(days => in_days)
    and st_dwithin(s.location, st_point(in_lng, in_lat)::geography, in_miles * 1609.344)
  group by s.id, e.exact
  order by s.sale_date asc, 16 asc;
$$;

grant execute on function public.sales_near_upcoming(double precision, double precision, double precision, integer) to anon, authenticated;

create or replace function public.sales_near_me(
  in_miles double precision default null,
  in_days  integer default 7
)
returns setof public.nearby_sale
language sql
security definer
set search_path = public, extensions
stable
as $$
  select u.*
  from public.profiles p
  join public.notification_prefs np on np.profile_id = p.id
  cross join lateral public.sales_near_upcoming(
    st_y(p.home_point::geometry),
    st_x(p.home_point::geometry),
    coalesce(in_miles, np.radius_miles::double precision),
    in_days
  ) u
  -- SECURITY DEFINER bypasses RLS, so this filter IS the access control.
  where p.id = auth.uid()
    and p.home_point is not null;
$$;

grant execute on function public.sales_near_me(double precision, integer) to authenticated;

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
  -- Same note as above: this filter is the access control, not RLS.
  where w.shopper_id = auth.uid()
  group by s.id, e.exact
  order by s.sale_date, s.opens_at;
$$;

grant execute on function public.my_saved_sales() to authenticated;
