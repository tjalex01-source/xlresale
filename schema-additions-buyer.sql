-- ============================================================================
-- XLResale — buyer-side additions
-- Run AFTER schema.sql and schema-additions-auth-profiles.sql.
--
-- The shopper tables (wishlists, wishlist_alerts, finds, sale_watchers,
-- saved_routes) already exist from the earlier migrations. The only thing the
-- buyer side needs that isn't in the schema yet is the bulk-lot opt-in, which
-- CLAUDE.md §6 calls out to build EARLY:
--
--   "treat the buyer bulk-lot opt-in as high-value, not 'just a toggle' —
--    every opt-in is a deposit in this future business. Collect it from day one."
--
-- It lives on notification_prefs because that is what it is: a preference about
-- being contacted. No new table, no new RLS — the existing prefs policies
-- already scope every row to its owner.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BULK-LOT OPT-IN — the reseller segment
-- ----------------------------------------------------------------------------
alter table public.notification_prefs
  add column if not exists bulk_lots_enabled boolean not null default false;

-- Which categories this person actually flips. Two jobs, per the brief: it
-- keeps a national junk hauler from being pinged about a $5 box of paperbacks
-- (the churn risk), and it tells us which resale price data is worth sourcing
-- first if the pricing tool ever gets built.
--
-- smallint[] matches categories.id (smallserial). Deliberately NOT a foreign
-- key array — Postgres can't FK an array element, and a join table here would
-- be three tables of ceremony for a checkbox list. Unknown ids are simply
-- ignored at read time.
alter table public.notification_prefs
  add column if not exists bulk_lot_categories smallint[] not null default '{}';

comment on column public.notification_prefs.bulk_lots_enabled is
  'Shopper wants to hear about end-of-sale bulk lots nearby. Builds the reseller segment.';
comment on column public.notification_prefs.bulk_lot_categories is
  'categories.id values this shopper flips. Empty = all categories.';

-- ----------------------------------------------------------------------------
-- 2. HOW MANY RESELLERS ARE IN RANGE — the demand nudge
-- ----------------------------------------------------------------------------
-- Powers the host-side line the brief describes: "10 people near you may want
-- what's left — want us to tell them your price?" Selling the blast depends on
-- being able to show proven demand BEFORE asking for the $5, so the count has
-- to be answerable now, while the opt-in list is still being built.
--
-- SECURITY DEFINER because a host must not be able to read other people's
-- prefs or home points — they get an integer and nothing else. Counting is
-- done against the shopper's own radius_miles, since that is the distance
-- they said they would travel.
create or replace function public.bulk_lot_audience(sale_id uuid)
returns integer
language sql
security definer
-- extensions must be on the path explicitly. A SECURITY DEFINER function has to
-- pin its search_path or a caller can shadow the tables it reads, but pinning
-- it to public alone hides PostGIS, which Supabase installs into `extensions`.
set search_path = public, extensions
stable
as $$
  select count(*)::int
  from public.notification_prefs np
  join public.profiles p on p.id = np.profile_id
  join public.sales s on s.id = bulk_lot_audience.sale_id
  where np.bulk_lots_enabled
    and p.home_point is not null
    and p.id <> s.host_id
    -- Cast is required: radius_miles is an integer, so integer * 1609.344 is
    -- numeric, and st_dwithin only overloads geography with double precision.
    and st_dwithin(p.home_point, s.location, (np.radius_miles * 1609.344)::double precision)
    and (
      np.bulk_lot_categories = '{}'
      or exists (
        select 1 from public.sale_categories sc
        where sc.sale_id = s.id and sc.category_id = any(np.bulk_lot_categories)
      )
    );
$$;

revoke all on function public.bulk_lot_audience(uuid) from public;
grant execute on function public.bulk_lot_audience(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. UNSEEN ALERT COUNT
-- ----------------------------------------------------------------------------
-- wishlist_alerts rows are created by match_sale_to_wishlists(). The shopper's
-- dashboard needs "you have 3 new matches" without pulling every alert row.
create index if not exists wishlist_alerts_unseen_ix
  on public.wishlist_alerts (shopper_id)
  where seen_at is null;

-- Saved sales are read as "my saved sales, soonest first" on every dashboard
-- load; without this it's a full scan of the shopper's rows.
create index if not exists sale_watchers_shopper_ix
  on public.sale_watchers (shopper_id);

-- ----------------------------------------------------------------------------
-- 4. SALES NEAR ME, ACROSS A DATE RANGE
-- ----------------------------------------------------------------------------
-- sales_near() answers one calendar day, which is what a map with a day filter
-- needs. A shopper browsing "what's coming up near me" needs the week, and
-- calling the single-day function seven times is seven round trips.
--
-- Same shape as sales_near() plus free_pile and the discount fields, because a
-- browse list has to show the FREE badge and the "N% OFF" ribbon that the pin
-- shows. The map will read from this too — the day filter becomes a client-side
-- filter over one fetch instead of a query per day.
-- A named composite type rather than an inline `returns table (...)`, because
-- sales_near_me() below returns the same shape and a function that returns
-- TABLE does not create a type its callers can name. Declaring it once means
-- adding a column later is one edit, not three that can drift apart.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'nearby_sale' and typnamespace = 'public'::regnamespace) then
    create type public.nearby_sale as (
      id               uuid,
      host_id          uuid,
      title            text,
      description      text,
      address          text,
      lat              double precision,
      lng              double precision,
      sale_date        date,
      opens_at         time,
      closes_at        time,
      time_zone        text,
      status           public.sale_status,
      free_pile        boolean,
      discount_percent smallint,
      discount_active  boolean,
      distance_miles   double precision,
      categories       text[]
    );
  end if;
end $$;

-- Return type is changing from TABLE to the composite, which CREATE OR REPLACE
-- cannot do.
drop function if exists public.sales_near_upcoming(double precision, double precision, double precision, integer);

create or replace function public.sales_near_upcoming(
  in_lat   double precision,
  in_lng   double precision,
  in_miles double precision default 5,
  in_days  integer default 7
)
returns setof public.nearby_sale
language sql stable as $$
  select
    s.id, s.host_id, s.title, s.description, s.address,
    st_y(s.location::geometry) as lat,
    st_x(s.location::geometry) as lng,
    s.sale_date, s.opens_at, s.closes_at, s.time_zone, s.status,
    s.free_pile, s.discount_percent, s.discount_active,
    st_distance(s.location, st_point(in_lng, in_lat)::geography) / 1609.344 as distance_miles,
    coalesce(array_agg(c.slug) filter (where c.slug is not null), '{}') as categories
  from public.sales s
  left join public.sale_categories sc on sc.sale_id = s.id
  left join public.categories c       on c.id = sc.category_id
  where s.listing_paid = true
    -- Today forward. A sale that already happened is not something to drive to,
    -- and yesterday's closed pins would crowd out the ones that matter.
    and s.sale_date >= current_date
    and s.sale_date < current_date + make_interval(days => in_days)
    and st_dwithin(s.location, st_point(in_lng, in_lat)::geography, in_miles * 1609.344)
  group by s.id
  order by s.sale_date asc, distance_miles asc;
$$;

-- ----------------------------------------------------------------------------
-- 5. SALES NEAR *ME*
-- ----------------------------------------------------------------------------
-- The shopper's own home point drives the browse list and, later, the map's
-- initial viewport. This wrapper exists so the client never has to hold those
-- coordinates: the account page promises the home address is "kept private —
-- it never appears on your public profile", and the cheapest way to keep that
-- promise is for it to never leave the database.
--
-- SECURITY INVOKER (the default) is correct and deliberate: profiles_select_own
-- already restricts the row to auth.uid(), so this cannot read anyone else's
-- home point even if the id were somehow forged.
--
-- in_miles defaults to the shopper's saved radius rather than a constant, so
-- the "How far will you drive?" setting drives this without being passed in.
create or replace function public.sales_near_me(
  in_miles double precision default null,
  in_days  integer default 7
)
returns setof public.nearby_sale
language sql
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
  where p.id = auth.uid()
    and p.home_point is not null;
$$;

grant execute on function public.sales_near_me(double precision, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. LOCK DOWN bulk_lot_audience
-- ----------------------------------------------------------------------------
-- The REVOKE above strips the PUBLIC grant, but Supabase ships ALTER DEFAULT
-- PRIVILEGES that hand EXECUTE to anon and authenticated on every new function
-- in `public`, and a default-privilege grant is a real grant — revoking PUBLIC
-- does not touch it. Without this, a signed-out visitor can call a SECURITY
-- DEFINER function that reads notification_prefs and home points.
--
-- It only ever returns a count, so the exposure was small; it is still a
-- privileged function that should answer to signed-in callers only.
revoke execute on function public.bulk_lot_audience(uuid) from anon;

-- ----------------------------------------------------------------------------
-- 7. THE SHOPPER'S OWN HOME POINT
-- ----------------------------------------------------------------------------
-- The route planner runs in the browser (CLAUDE.md §10 solves client-side for
-- <= 15 stops), so it needs the coordinates the route starts from. Everywhere
-- else the home point deliberately stays server-side; here it cannot, because
-- the leg maths and the drive-time request both need it.
--
-- This is not a widening of what a client can read: auth.uid() is the only row
-- reachable, so a shopper gets their own address back and nobody else's. It
-- exists because home_point is a geography column and PostgREST cannot project
-- it to lat/lng on its own.
create or replace function public.my_home_point()
returns table (lat double precision, lng double precision)
language sql
stable
as $$
  select st_y(home_point::geometry), st_x(home_point::geometry)
  from public.profiles
  where id = auth.uid() and home_point is not null;
$$;

grant execute on function public.my_home_point() to authenticated;

-- One saved route per shopper per day. Re-planning a Saturday should overwrite
-- that Saturday rather than pile up rows nobody can tell apart.
create unique index if not exists saved_routes_shopper_date_ux
  on public.saved_routes (shopper_id, route_date);

-- ----------------------------------------------------------------------------
-- 8. THE SHOPPER'S SAVED SALES, WITH COORDINATES
-- ----------------------------------------------------------------------------
-- The route planner needs lat/lng for every candidate stop, and a saved sale is
-- not necessarily inside the shopper's radius — someone can save a sale two
-- towns over — so sales_near_me() is the wrong source for it.
--
-- Same nearby_sale shape as the browse and map queries so the planner, the map,
-- and the dashboard all speak one type. SECURITY INVOKER: RLS on sale_watchers
-- restricts this to the caller's own saves, and RLS on sales still hides
-- anything unpublished.
create or replace function public.my_saved_sales()
returns setof public.nearby_sale
language sql
stable
as $$
  select
    s.id, s.host_id, s.title, s.description, s.address,
    st_y(s.location::geometry) as lat,
    st_x(s.location::geometry) as lng,
    s.sale_date, s.opens_at, s.closes_at, s.time_zone, s.status,
    s.free_pile, s.discount_percent, s.discount_active,
    coalesce(
      st_distance(s.location, (select home_point from public.profiles where id = auth.uid()))
        / 1609.344,
      0
    ) as distance_miles,
    coalesce(array_agg(c.slug) filter (where c.slug is not null), '{}') as categories
  from public.sale_watchers w
  join public.sales s on s.id = w.sale_id
  left join public.sale_categories sc on sc.sale_id = s.id
  left join public.categories c on c.id = sc.category_id
  where w.shopper_id = auth.uid()
  group by s.id
  order by s.sale_date, s.opens_at;
$$;

grant execute on function public.my_saved_sales() to authenticated;
