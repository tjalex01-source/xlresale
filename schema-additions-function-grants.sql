-- ============================================================================
-- XLResale — close three SECURITY DEFINER functions that anon could call
-- Run AFTER schema-additions-weather.sql.
--
-- Found while adding the weather nudge, by checking the grants on the two new
-- functions and discovering the note in HANDOFF.md §4 was backwards. It said
-- "REVOKE … FROM PUBLIC does not remove it; revoke from anon explicitly". The
-- truth is the other way round, and it matters:
--
--   A new function in `public` collects TWO grants — Postgres's own default to
--   PUBLIC, and Supabase's default privileges to anon/authenticated/service_role.
--   Revoking from `anon` leaves the PUBLIC grant behind, and anon can still call
--   it. In the ACL that grant shows up as a bare `=X/postgres` with no grantee.
--
-- So every `revoke ... from anon` written on that advice did nothing, and three
-- SECURITY DEFINER functions — which run as the owner and bypass RLS — were
-- reachable with the anon key that ships in the JavaScript bundle.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. sale_move_miles — a distance oracle against exact sale coordinates
-- ----------------------------------------------------------------------------
-- The serious one. It is SECURITY DEFINER, takes any sale id and any point, and
-- returns the exact distance between them. It has no ownership check.
--
-- Sale ids are public — one is in the URL of every /s/[id] page. So anybody
-- could pick a sale, call this three times with three arbitrary points, and
-- trilaterate the host's front door to the metre. That is precisely what
-- docs/ADDRESS-POLICY.md exists to prevent, and that document calls host
-- address exposure "the one XLResale exposure that is about physical safety,
-- not just privacy". The policy's own verification probed the view, the base
-- table, the RPCs and a `like` filter used as an extraction oracle — and missed
-- this function.
--
-- Two fixes, because either alone is thin: the grant is closed, AND the body
-- now only answers for a sale the caller hosts. It exists so a host editing
-- their own address can be told how far the pin moved (see updateSale), which
-- needs no more reach than that.
create or replace function public.sale_move_miles(
  in_sale_id uuid,
  in_lat     double precision,
  in_lng     double precision
)
returns double precision
language sql
security definer
set search_path = public, extensions
stable
as $$
  select st_distance(s.location, st_point(in_lng, in_lat)::geography) / 1609.344
  from public.sales s
  where s.id = in_sale_id
    and s.host_id = auth.uid();
$$;

revoke execute on function public.sale_move_miles(uuid, double precision, double precision) from public;
revoke execute on function public.sale_move_miles(uuid, double precision, double precision) from anon;
grant  execute on function public.sale_move_miles(uuid, double precision, double precision) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. consume_listing_credit — spends someone else's credits
-- ----------------------------------------------------------------------------
-- Takes a profile id and decrements that profile's listing_credits. Callable by
-- anon, it let anybody burn any host's credits to zero. Nothing spends credits
-- yet because Stripe isn't built, which is the only reason this was harmless.
--
-- Its header comment already says the webhook calls it; a webhook runs
-- server-side as service_role and needs nothing else to reach it.
revoke execute on function public.consume_listing_credit(uuid) from public;
revoke execute on function public.consume_listing_credit(uuid) from anon, authenticated;
grant  execute on function public.consume_listing_credit(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 3. match_sale_to_wishlists — queues other people's alerts
-- ----------------------------------------------------------------------------
-- Writes rows into wishlist_alerts for other users. It is fired by a trigger
-- when a sale becomes public, and triggers run as the table owner regardless of
-- who holds EXECUTE — so closing the grant does not stop the retention hook.
-- No application code calls it directly.
--
-- The blast radius was small (the partial unique index on kind='match' stops
-- duplicates) but "anon can enqueue mail to strangers" is not a property to
-- leave lying around.
revoke execute on function public.match_sale_to_wishlists(uuid) from public;
revoke execute on function public.match_sale_to_wishlists(uuid) from anon, authenticated;
grant  execute on function public.match_sale_to_wishlists(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 4. WHAT WAS CHECKED AND DELIBERATELY LEFT ALONE
-- ----------------------------------------------------------------------------
--   * sales_near_upcoming — anon by design; the map works signed out.
--   * sales_near_me, my_saved_sales, my_home_point — keyed on auth.uid(), which
--     is null for anon, so they return nothing.
--   * handle_new_user, queue_wishlist_alerts, sales_tsv_update, stamp_went_live,
--     stamp_item_sold, touch_updated_at — trigger functions. Postgres refuses to
--     call one outside a trigger ("trigger functions can only be called as
--     triggers"), so the grant is not a way in.
--   * close_expired_sales and the coarse_*/pricing helpers — SECURITY INVOKER,
--     so RLS still applies to whoever calls them.
