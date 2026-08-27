-- ============================================================================
-- XLResale — the weather nudge
-- Run AFTER schema-additions-finds-sharing.sql.
--
-- CLAUDE.md §6 says the forecast itself is external and needs no schema, which
-- is true. Two small things do:
--
--   * the host's own sale coordinates, which the address-precision work
--     deliberately made unreachable through PostgREST, and
--   * a record of which date we already nudged about, so a daily cron doesn't
--     mail the same host every morning until the rain arrives.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. WHERE IS MY SALE, EXACTLY
-- ----------------------------------------------------------------------------
-- `sales.location` is a geography and PostgREST hands it back as opaque WKB,
-- and SELECT on the column is revoked from authenticated anyway
-- (schema-additions-address-policy.sql §5). A host reading their OWN sale's
-- point is not what that revoke exists to stop, so this is the sanctioned way
-- back in — the same shape as my_home_point().
--
-- It reads through `host_sales`, not `sales`, and that detail is the whole
-- design. SELECT on sales.location is revoked from `authenticated`, so a
-- SECURITY INVOKER function selecting the base table gets "permission denied
-- for table sales" — the caller's own privileges are what a revoke removes.
--
-- A view is checked against its OWNER's privileges, so reading location through
-- host_sales works, and host_sales is already `where host_id = auth.uid()` —
-- which means the view supplies both the reach and the access control. No
-- SECURITY DEFINER needed, and therefore no hand-written ownership check that
-- could be wrong.
create or replace function public.my_sale_point(in_sale_id uuid)
returns table (lat double precision, lng double precision)
language sql
stable
set search_path = public, extensions
as $$
  select st_y(location::geometry), st_x(location::geometry)
  from public.host_sales
  where id = in_sale_id;
$$;

-- BOTH revokes, and PUBLIC first. A new function in `public` picks up two
-- separate EXECUTE grants: Postgres's own default to PUBLIC, and Supabase's
-- default privileges to anon/authenticated/service_role. Revoking from `anon`
-- alone leaves the PUBLIC grant, and `has_function_privilege('anon', ...)`
-- still comes back true — the ACL shows it as a bare `=X/postgres`.
-- (HANDOFF.md §4 had this the wrong way round until this migration.)
revoke execute on function public.my_sale_point(uuid) from public;
revoke execute on function public.my_sale_point(uuid) from anon;
grant execute on function public.my_sale_point(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. WHICH DATE HAVE WE ALREADY NUDGED ABOUT
-- ----------------------------------------------------------------------------
-- A date, not a boolean or a timestamp. The guard has to reset the moment the
-- host acts on the nudge, and moving the sale changes `sale_date` — so
-- comparing the two gives that for free: nudged for the date it's on = stay
-- quiet, nudged for some other date = this is a new situation, say something.
alter table public.sales
  add column if not exists weather_nudged_for date;

comment on column public.sales.weather_nudged_for is
  'The sale_date we last warned this host about rain for. Null = never. '
  'Compared against sale_date, so a reschedule re-arms the nudge by itself.';

-- ----------------------------------------------------------------------------
-- 3. WHAT THE CRON READS
-- ----------------------------------------------------------------------------
-- The nightly job needs every upcoming sale WITH coordinates, which no existing
-- function provides: sales_near_upcoming() is anchored to a shopper's point and
-- coarsens the address, and this needs the real one to ask about the weather.
--
-- Locked to service_role. It returns exact coordinates for every upcoming sale
-- in the system, which is the entire thing docs/ADDRESS-POLICY.md exists to
-- prevent leaking — so the revokes below are load-bearing, and there are three
-- of them for the reason given in §1.
create or replace function public.upcoming_sales_for_weather(in_days integer default 7)
returns table (
  id                 uuid,
  host_id            uuid,
  title              text,
  sale_date          date,
  opens_at           time,
  closes_at          time,
  time_zone          text,
  lat                double precision,
  lng                double precision,
  weather_nudged_for date
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    s.id, s.host_id, s.title, s.sale_date, s.opens_at, s.closes_at, s.time_zone,
    st_y(s.location::geometry), st_x(s.location::geometry),
    s.weather_nudged_for
  from public.sales s
  where s.listing_paid = true
    and s.hidden_at is null
    and s.sale_date >= current_date
    and s.sale_date <= current_date + make_interval(days => in_days)
    -- Already warned about the date it is currently on.
    and (s.weather_nudged_for is null or s.weather_nudged_for <> s.sale_date)
  order by s.sale_date;
$$;

revoke execute on function public.upcoming_sales_for_weather(integer) from public;
revoke execute on function public.upcoming_sales_for_weather(integer) from anon, authenticated;
grant execute on function public.upcoming_sales_for_weather(integer) to service_role;
