-- ============================================================================
-- XLResale — security hardening
-- Run AFTER all other additions.
--
-- Written after auditing the app against the Xandland security checklist. RLS
-- itself came out clean: all 16 tables have it on, and an anonymous probe of
-- every table and view with the public anon key returned zero rows from every
-- private one. What it did surface is below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STOP SHIPPING NON-PUBLIC COLUMNS OF `sales` TO THE BROWSER
-- ----------------------------------------------------------------------------
-- `sales_read_public` is `listing_paid = true`, which is a ROW rule. RLS has no
-- column dimension, so `select=*` through PostgREST handed anonymous callers
-- every column of every published sale — including three that were never meant
-- to leave the server:
--
--   raw_description   the host's unedited original text, kept for reference
--   stripe_payment_id payment identifiers, once payments exist
--   search_tsv        internal full-text index
--
-- Column privileges are the missing dimension. Table-level SELECT implies all
-- columns, so revoking it and re-granting a named list is the only way to
-- narrow it — revoking a single column from a table-level grant is a no-op.
--
-- Verified before writing this: no app code selects * from sales, and every
-- call site names its columns. The two `select("*", { head: true })` counts in
-- the admin console run as service_role, which these grants don't touch.
revoke select on public.sales from anon, authenticated;

grant select (
  id, host_id, title, description, address, location,
  sale_date, opens_at, closes_at, time_zone,
  status, went_live_at, listing_paid,
  discount_percent, discount_active,
  free_pile, free_pile_note,
  photos_purged_at, created_at, updated_at
) on public.sales to anon, authenticated;

-- match_sale_to_wishlists() reads search_tsv, but it is SECURITY DEFINER and
-- runs as the owner, so it is unaffected by the grants above.

-- ----------------------------------------------------------------------------
-- 2. SAME TREATMENT FOR `profiles`
-- ----------------------------------------------------------------------------
-- profiles_select_own already limits rows to the signed-in user, and
-- public_profiles exists precisely so the base row is never the public surface.
-- home_point and home_address are still readable by that user's own session,
-- which is correct — but two pages were selecting * from profiles, and the
-- habit is what the checklist warns about: add a column later and it ships.
--
-- Nothing is revoked here because the row rule is already tight; the fix for
-- those two pages is in the application code, naming their columns.

-- ----------------------------------------------------------------------------
-- 3. NOT FIXED HERE — HOST ADDRESS EXPOSURE
-- ----------------------------------------------------------------------------
-- Deliberately left alone, because it is a product decision, not a bug to
-- quietly patch. Recording the current behaviour so the decision is made with
-- the facts:
--
--   * A published sale's EXACT address and PostGIS point are readable by
--     anyone holding the anon key, which ships in the JavaScript bundle.
--   * There is no date restriction. The "visible in the ~7 days before the
--     sale" rule from CLAUDE.md §6 lives only inside sales_near_upcoming();
--     a direct PostgREST query ignores it entirely, so a sale published a
--     month early is enumerable from the moment it is paid for.
--   * Pin precision applied in the UI would therefore be decoration.
--
-- Options, for whoever decides:
--   a) Accept it — the address is the product, and it is already public on
--      Craigslist-style listings.
--   b) Add the date window to the RLS policy so unpublished-window sales are
--      unreadable, matching the documented rule. Note this also hides past
--      sales from a shopper's own saved list, which needs handling.
--   c) Move the public surface to a view with a coarsened point (street or
--      block level) until the host goes live, revoking direct select on the
--      base table from anon.
--
-- See docs/ADDRESS-POLICY.md once decided.
