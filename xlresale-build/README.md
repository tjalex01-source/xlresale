# XLResale — complete build package

Unzip into your repo root. The folders are already where they belong.

## Files

| File | What it is |
|---|---|
| `CLAUDE.md` | **Start here.** The build brief — product, stack, v1 scope, phases, specs, non-goals. |
| `DESIGN.md` | The design system — palette, type, Nub the mascot, hero. Source of truth for all UI. |
| `MAPS-COST-CONTROLS.md` | Google Maps without surprise bills (matrix caching, one map instance, billing cap). |
| `schema.sql` | **Run 1st.** Core database migration — sales, lifecycle, PostGIS, RLS, realtime. |
| `schema-additions-auth-profiles.sql` | **Run 2nd.** Usernames, public profiles, wishlist alerts, finds tracker. |
| `schema-additions-seller.sql` | **Run 3rd.** Featured items (tap-to-sell, per-item drops, lock-from-bulk), discount tiers, free pile. |
| `reference/design-reference.html` | Product UI prototype — map, route planner, host Go Live. Reference only, don't port. |
| `reference/hero-frame.html` | The built landing hero over the real mascot render. Match it. |
| `reference/host-dashboard.html` | The seller dashboard reference — interactive; its pricing math mirrors the seller schema. |
| `reference/hero.png` | Copy of the hero image so the reference HTML renders standalone. |
| `public/mascot/hero.png` | The production hero illustration at the path the app expects. |

## Order of operations

1. Unzip into the repo root and commit.
2. In Supabase → SQL Editor, run the three `.sql` files **in the order listed above**.
3. Have accounts ready: Supabase, Stripe, Google Maps Platform, Vercel. (Resend + Anthropic
   are v2.)
4. Open the repo in Claude Code and paste the kickoff prompt from `CLAUDE.md` §17.

## Mascot art still to add

Nub is the mascot (round matte-white character, two dot eyes, simple smile). `hero.png` is
done. Generate and drop these into `public/mascot/` as transparent PNGs — `DESIGN.md` →
Mascot says which screen uses which:

`hero-mobile.png` · `point.png` · `grab.png` · `clipboard.png` · `lean.png` · `shrug.png` ·
`404.png` · `celebrate.png` · `pin.png` · `peek.png`

## Notes

- The `reference/*.html` files may still say "Haul" (an old working name). The product is
  **XLResale**; table names are generic and unaffected.
- `CLAUDE.md` §15 lists explicit **non-goals** — read them. They protect the business model
  (no listing transfers, no deferred charge, no cut of peer-to-peer deals).
