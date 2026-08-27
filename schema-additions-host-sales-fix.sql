-- ============================================================================
-- XLResale — host_sales had been six columns behind since it was created
-- Run AFTER schema-additions-weather.sql.
--
-- THE BUG. `host_sales` is defined as `select s.* from public.sales s where
-- s.host_id = auth.uid()`. Postgres expands that `*` ONCE, when the view is
-- created, and freezes the result. Every column added to `sales` afterwards is
-- invisible to the view forever — silently, with no error until something
-- selects it.
--
-- The view was created in schema-additions-address-policy.sql. Six columns have
-- been added to `sales` since:
--
--   hidden_at, hidden_by_admin      (takedown)
--   reschedule_count                (edit/reschedule)
--   comped_at, comped_reason        (comped listings)
--   weather_nudged_for              (the weather nudge)
--
-- WHAT IT BROKE. Two live code paths select the missing columns from this view,
-- and PostgREST answers "column does not exist" rather than returning a row:
--
--   * app/host/[id]/page.tsx selects hidden_at — so the whole sale dashboard
--     fell through to notFound(). The host dashboard has been a 404 for its
--     owner since the takedown feature shipped.
--   * app/host/[id]/edit/actions.ts selects reschedule_count — so every edit
--     returned "That sale isn't yours, or no longer exists."
--
-- Nobody caught it because the earlier sessions verified against the database
-- rather than the page, and the one person with a sale hadn't opened either
-- screen since.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RE-EXPAND THE STAR
-- ----------------------------------------------------------------------------
-- CREATE OR REPLACE keeps the grants, and is allowed here because the six new
-- columns all sit at the END of `sales` — replacing a view may append columns,
-- never reorder or remove them.
create or replace view public.host_sales as
select s.*
from public.sales s
where s.host_id = auth.uid();

-- ----------------------------------------------------------------------------
-- 2. FAIL LOUDLY IF IT EVER DRIFTS AGAIN
-- ----------------------------------------------------------------------------
-- This is the part that matters more than the fix. The next person to add a
-- column to `sales` will not remember this file exists, so re-running any
-- migration that ends with this block will tell them.
--
-- Add a column to public.sales? Re-run this file. That's the whole rule.
do $$
declare
  missing text[];
begin
  select array_agg(c.column_name order by c.ordinal_position) into missing
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'sales'
    and c.column_name not in (
      select h.column_name
      from information_schema.columns h
      where h.table_schema = 'public' and h.table_name = 'host_sales'
    );

  if missing is not null then
    raise exception
      'host_sales is behind public.sales — missing: %. A view built on select * '
      'freezes its column list at creation; re-run this file.', missing;
  end if;

  raise notice 'host_sales matches public.sales (% columns)',
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='host_sales');
end $$;

-- ----------------------------------------------------------------------------
-- 3. THE OTHER VIEWS, CHECKED
-- ----------------------------------------------------------------------------
-- Recorded so nobody has to re-derive it:
--
--   * public_sales and public_profiles both name their columns explicitly, so
--     they cannot drift this way. A new column simply isn't exposed, which for
--     a public surface is the correct default — see the note in
--     schema-additions-focus.sql, which relies on exactly that property to keep
--     `focus` off the public profile.
--   * sales_photo_purge_due names its columns too.
--
-- host_sales was the only `select *` view, and it is the one that wants every
-- column: it exists so a host can read their OWN row in full, including the
-- address and location that are revoked from `authenticated` everywhere else.
