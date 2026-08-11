# XLResale — Build Brief & `CLAUDE.md`

> **What this is:** the operating brief for building XLResale. Read it fully before
> writing any code. It defines the product, the stack, what's already built, what to
> build first, and the conventions to hold to. When in doubt, follow this document.
>
> **Companion files in this repo:**
> - `schema.sql` — the complete database migration (already written, ready to run).
> - `schema-additions-auth-profiles.sql` — **run after `schema.sql`.** Adds usernames,
>   public profiles, wishlist alerts, and the finds tracker.
> - `schema-additions-seller.sql` — **run after `schema.sql`.** Adds featured items
>   (tap-to-sell, per-item drops, lock-from-bulk), sale-wide discount tiers, and the
>   free-pile toggle. Read its header comment — the pricing rules live there.
> - `DESIGN.md` — **the design system. Read it before building any UI and follow it
>   exactly.** Covers palette, type, the mascot, and the hero.
> - `MAPS-COST-CONTROLS.md` — how to use Google Maps without surprise bills. Follow it.
> - `reference/design-reference.html` — a standalone visual prototype of the product UI. **Design
>   reference only — do not port it.** Rebuild its look/behavior as Next.js components.
> - `reference/hero-frame.html` — the built landing hero, composed over the real mascot
>   render. Rebuild the landing hero to match it (pulling type/color from `DESIGN.md`).
> - `reference/host-dashboard.html` — **the seller dashboard reference.** Interactive: Go
>   Live lifecycle, incoming-shoppers panel, featured items (tap-to-sell, per-item drop,
>   lock-from-bulk), preset discount tiers, free-pile toggle, live pin preview, and the
>   tap-to-total calculator. Its pricing math mirrors `schema-additions-seller.sql` — treat
>   it as the behavioral spec for the seller side.
> - `public/mascot/` — brand mascot art. `hero.png` is the hero illustration; add the
>   other poses (see `DESIGN.md` → Mascot) as you build the states that use them.
>
> *(The `.html` reference files may still say "Haul" in places — that was the working
> name. The product is **XLResale**. Database table names are generic and unaffected.)*

---

## 1. The product

XLResale is a **two-sided discovery app for garage, yard, and estate sales**.

- **Hosts** pay a one-time **$5 fee** to list a sale.
- **Shoppers** browse free: they see a live map of nearby sales, plan a **time-aware
  driving route**, and can opt in to alerts.

**The moat — say it out loud, because it drives every design choice:** competitors
scrape Craigslist and dump unverified pins on a map. They *structurally cannot* offer
two things we make the default:

1. **Verified, real-time status.** A host taps **Go Live** when they open the garage
   door; the pin pulses green in real time on every nearby shopper's map. Solves the
   #1 pain: driving out to a sale that already packed up.
2. **Time-aware routing.** A route that respects each sale's **closing time**, not just
   distance — so shoppers actually reach every sale before it closes.

Domain: **xlresale.com**. Part of the Xandland ecosystem. Mission-first: this is a tool
that helps real people, not a scraper farm.

---

## 2. Tech stack (the Xandland standard — do not substitute)

| Layer | Choice |
|---|---|
| Framework | **Next.js (App Router), TypeScript** |
| Styling | **Tailwind CSS** |
| Database / Auth / Realtime / Storage | **Supabase** (Postgres + PostGIS + RLS) |
| Payments | **Stripe** (one-time $5 listing) |
| Hosting / serverless | **Vercel** |
| Email | **Resend** |
| AI | **Anthropic API** (listing cleanup, category suggestions) |
| Maps | **Google Maps Platform** (Maps JS, Places Autocomplete, Distance Matrix / Routes) |

---

## 3. How the founder works — operational constraints (important)

- **T.J. does not write code and does not use a terminal.**
- **Deploy flow:** Claude Code writes and commits code → T.J. **pushes to `main` via
  GitHub Desktop** → **Vercel auto-deploys**. There is no manual build/deploy step.
- **Therefore:**
  - **Claude Code runs all terminal commands itself** (installs, type checks, local
    migrations, tests). Never hand T.J. a terminal command to run.
  - When an action *must* happen in a GUI (adding an env var, enabling a Supabase
    extension, creating a Storage bucket, flipping Stripe to live mode), give
    **click-by-click dashboard steps**, not CLI instructions.
  - Keep commits clean and well-messaged; T.J. reviews changes in GitHub Desktop.

---

## 4. Current state — what already exists

- ✅ **Database schema (`schema.sql`)** — complete and ready to run in the Supabase SQL
  Editor. Includes: `profiles`, `categories`, `sales`, `sale_categories`,
  `saved_routes`, `sale_watchers`, `notification_prefs`; the `sale_status` enum; full
  RLS; the `sales_near()` PostGIS radius RPC; a `pg_cron` auto-close job; and Realtime
  enabled on `sales`. Seeds the category list.
- ✅ **Design prototype (`reference/design-reference.html`)** — shows the full visual system, both
  the shopper and host views, the four live-pin states, and the working time-aware route
  planner (drag-to-reorder with ETA-vs-closing recalculation). **Reference only.**
- ⬜ Everything else (the app itself) — to build.

---

## 5. Data model (summary — full DDL in `schema.sql`)

| Table | Purpose |
|---|---|
| `profiles` | 1:1 with `auth.users`. Any profile can host and/or shop. Stores home point for "near me" + route start. |
| `categories` | Fixed lookup driving pin colors + filters (seeded). |
| `sales` | The listing. Has `location` (geography), `sale_date`, `opens_at`/`closes_at`, `status`, `listing_paid`, `went_live_at`. |
| `sale_categories` | Many-to-many join. |
| `saved_routes` | A shopper's ordered `stop_ids[]` for a given day. |
| `sale_watchers` | Who has a sale on a route (powers the host's "N shoppers watching"). |
| `notification_prefs` | Email/push/SMS toggles + **SMS opt-in consent record** (`sms_consent_at`, `sms_consent_text`) for A2P/TCPA compliance. |
| `sale_photos` | **Not yet in schema — see §7. Must be added.** |

**The lifecycle enum** (`sale_status`) is the single source of truth both sides read:

```
scheduled → live → winding_down → closed
```

Host **writes** it (Go Live button); every shopper map **subscribes** to it via Realtime.

---

## 6. v1 scope — build THIS, defer the rest

**In scope for v1:**

1. **Accounts** — Supabase **email + password** sign-up/login (not magic link). Sign-up
   collects **username + email + password**; username is a unique public handle (profile
   URL `/u/username`), login is by email + password. Include email verification + password
   reset (both native to Supabase Auth). Profile + notification prefs auto-created on
   signup. Public profile page at `/u/username` (uses the `public_profiles` view — never
   the base profiles row, which holds home location).
2. **Host: create a sale** — form with Google Places address autocomplete, hours,
   categories, **photos**; then **pay $5** to publish (`listing_paid = true`).
3. **Shopper: map** — nearby sales via `sales_near()`, day filter, **custom pins colored
   by status**, click-to-preview.
4. **Shopper: time-aware route planner** — add stops, drag to reorder, per-stop **ETA vs
   closing time** with a make-it/miss-it verdict, "optimize" button.
5. **Host: Go Live lifecycle** — cycle `scheduled → live → winding_down → closed`; pin
   updates on shopper maps **in real time**.

**Fast-follow (v1.5, after the core loop works — schema is already in
`schema-additions-auth-profiles.sql`):**
- **Wishlist alerts ("what I'm looking for").** Shoppers save search terms; when a sale is
  published, `match_sale_to_wishlists(sale_id)` (call it from the Stripe webhook after
  `listing_paid` flips true) queues matches in `wishlist_alerts`. A notifier job delivers
  un-sent alerts via each shopper's `notification_prefs` channels — start with **email
  (Resend)**, add push/SMS later. Nub's voice: "Someone 2 miles away just listed power
  tools." This is the retention hook — prioritize it.
- **Finds tracker + social.** Shoppers log bargains (photo, paid vs. est. value) in `finds`;
  public finds render on `/u/username` and on individual share pages with Open Graph tags
  (ideally an auto-generated share card featuring Nub) + the Web Share API on mobile. This
  is the growth loop — every shared find is a free ad.

**Seller reactive features (v1.5 — schema in `schema-additions-seller.sql`):** these turn
the host dashboard from broadcast-only into a live tool. Read that file's header for the
exact pricing rules.
- **Featured items.** Hosts showcase their 10-20 best (name, price, R2 photo) — framed as
  merchandising, never a required full inventory. Each item has **tap-to-mark-sold** (drops
  it from the map + "still available" + wishlist logic), an **individual price drop**, and a
  **lock** to exclude it from bulk discounts (the top-dollar pressure washer).
- **Bulk discount with preset tiers.** One sale-wide `discount_percent` with one-tap presets
  (10 / 25 / 50 / 75%) + custom. Hosts can step it down through the day. Applies to all
  unlocked featured items and announces the whole sale is discounted. **"Lower price wins"**
  display with strikethrough. Broadcasts live via realtime → pin gets a "N% OFF" ribbon, page
  reprices with no refresh. A confirm step guards the one-tap bulk drop. Best paired with the
  winding-down button ("Last call — take it all half off").
- **Free-pile toggle.** Set at sale creation ("🆓 Free stuff here" + optional note). Drives a
  green **FREE pin badge** and a **map filter** ("sales with free stuff") and can trigger
  wishlist pings. On a pin, show FREE over the discount ribbon; keep them separate signals.
- **Incoming-shoppers count.** "3 shoppers on the way in the next 10 min." v1 = count from
  `sale_watchers` ("N have you saved, M on the way now"); v2 = exact ETAs once active routes
  are persisted. Pair with winding-down: "Don't pack up — 3 arrive in 10."
- **Tap-to-total calculator (delight, build last).** Reuses the live discount: host taps
  featured items (+ loose entries), applies the current discount per the rules above (locked
  items stay full price), shows the total, and can **mark those items sold in the same tap**.
  Keep it a per-buyer scratchpad — no cash/day-total tracking (that's a tax-headache product).
- **Buyer ↔ seller contact.** Start light: a per-item "Is this still available?" quick-ping
  with an optional reply (rides Realtime), **not** full open chat. Requires report/block +
  notifications from day one. Off-platform payment (Venmo/cash) is fine — we take the $5
  listing fee, not a cut — but show a "meet safely; XLResale doesn't handle payments" note.

**Reschedule, weather & address edits (v1.5):** these turn weather and logistics from
refund threats into re-engagement moments — and they lean entirely on having a real host,
which is the moat.
- **A paid listing is one sale that never expires.** The $5 buys one sale, movable to any
  future date, no time window, no new charge. Payment still happens **at setup** (paid pins
  from day one is what keeps the map trustworthy — do NOT defer the charge to sale day). A
  listing is publicly visible only in the ~7 days before its `sale_date`; reschedule far out
  and it simply goes quiet, then reappears when its window opens. Keep the "listed up to 7
  days in advance" line as a **marketing/visibility** rule, decoupled from the never-expiring
  payment. Cap reschedules at a generous count (abuse guard), not a time limit.
- **Reschedule → re-alert savers.** Moving the date re-notifies everyone who saved it or has
  it on a route ("Rain moved the Standish Ave sale to Sunday — still on your list"), reusing
  the wishlist-alert plumbing.
- **Weather nudge.** A forecast API (external, no schema) checks each upcoming sale; if rain's
  likely, Nub proactively offers a one-tap reschedule a day or two out. Never touches money.
- **Wash-out credit.** If a host truly can't place it, offer a **rain-check credit** (a free
  relist) rather than a cash refund — keeps the revenue and the goodwill.
- **Address edits anytime.** Hosts can change their sale's address (e.g. combining with a
  friend's better-located sale — this is a normal edit, NOT a listing transfer). New address
  runs the same verification as at listing; on a **significant move**, show a soft confirm and
  **re-alert saved shoppers** with the new location (reuses the same notify plumbing). Pin,
  `sales_near()`, and routes recompute off the new `location` automatically.

**End-of-sale "what now?" handoff (monetization — capture; see staging below):** when a
host ends a sale they're standing in a driveway of leftovers at their lowest motivation — a
peak-intent moment.

**Governing revenue principle (applies to ALL of these): XLResale charges flat fees for
*reach* and referral fees to *businesses* — never a percentage of a peer-to-peer deal, and
money never moves through the platform.** This is what keeps XLResale a lightweight software
product and off the payments-business path (no Stripe Connect, KYC, chargebacks, or dispute
arbitration). We connect; we never operate, hold funds, or take a cut of a sale between two
people.

Doors from "End sale":
- **Sell what's left in bulk — a $5 blast (the key idea).** A one-tap "sell the rest as one
  lot, $X for everything" that blasts to resellers in range; first to claim gets the seller's
  contact and they settle **off-platform** (Venmo/cash). The **$5 is a flat fee for the
  broadcast — charged whether the lot sells or not.** It is NOT a cut of the sale; it's the
  same money shape as the core $5 listing ("$5 to broadcast one more thing"). Reuses the
  existing alert + radius + wishlist plumbing; "first to claim" is a small realtime lock.
- **Buyer opt-in: "notify me about bulk lots" (build EARLY — just a notification pref).**
  A toggle in the buyer's notification prefs that builds a segment of known, interested
  resellers. Collect this before the blast feature ships — it creates the audience *and* the
  proof of demand. Blasts only go to people who asked, which is higher-converting and cleaner.
- **Demand nudge (what sells the blast).** Because of the opt-in count, show the host proven
  demand *before* offering the paid blast: "10 people near you may want what's left — want us
  to tell them your price?" Flips "buy this feature" into "there are 10 buyers waiting." The
  opt-in and the nudge feed each other.
- **Haul it** — a **referral/lead handoff** to local junk haulers (1-800-GOT-JUNK, College
  Hunks, local operators). The fee attaches to the **hauler** (a business paying for a
  qualified lead at peak intent, address + rough load size known) — never to the homeowner's
  stuff. Clean lead-gen at zero operational cost. Start as a curated local list with "request
  a quote."
- **Donate it** — a pickup handoff to charities with free scheduled pickups (Salvation Army,
  Habitat ReStore). Warm optics; some have referral programs.

**Staging (prove the crowd before monetizing):**
- *Early:* ship the **buyer bulk-lot opt-in** (a preference toggle, ~free) to start building
  the reseller list.
- *v1.5:* the **bulk "sell what's left" blast + claim**, off-platform payment, with the $5
  reach fee — only meaningful once enough resellers are watching (the opt-in count tells you).
- *v2:* hauler/donation referral handoffs.
- **Explicitly NOT planned:** taking a percentage of the bulk deal / routing buyer→seller
  payment through the platform. That's the payments-business swamp the flat-fee principle
  exists to avoid. Off-platform settlement stays off-platform.

**Strategic asset: the reseller audience (NOT a build item — context only).** The most
valuable thing XLResale quietly accumulates isn't listings, it's a segment of resellers and
resale-minded buyers who opt in to "notify me about cheap/bulk stuff nearby." That audience
could seed a *separate future business* — a standalone "cheap stuff near you, right now"
alert network where **suppliers pay a flat fee to blast** (estate cleanouts, moving sales,
storage lots, liquidations, downsizing, landlords, contractors — not just garage-sale
leftovers) and **listeners pay to be in the pool.** Same flat-fee principle; no money moves
between parties.
- **Pricing ladder:** casual flippers (low or free — they're the volume + proof of audience)
  → pro pickers / resale shops (mid) → revenue businesses like national junk haulers, estate
  liquidators, thrift/scrap operators (high; $100+/yr is trivial to them *if it sends jobs*).
- **Two different wallets, one list:** a **reseller pays to find inventory**; a **service
  business pays to find customers** (a hauler isn't buying the couch — they're buying the
  lead). Service businesses have the biggest budgets and least price sensitivity.
- **Caveats:** value first, price second — tiers only mean anything once the list is large
  and active (so the audience must grow first); and **route by category + load size** so a
  national hauler isn't pinged about a $5 box of paperbacks (churn). The data model already
  carries category, location, and load hints, so leave room for this.
- **The only thing this implies for the build now:** treat the **buyer bulk-lot opt-in as
  high-value, not "just a toggle"** — every opt-in is a deposit in this future business.
  Collect it from day one. Do not build the network itself yet.

**Future product: reseller pricing tool (NOT a build item — context only).** A companion app
that estimates what an item is worth from recent **sold** comps, aimed at the same reseller
audience. Unlike the blast network (a channel), this is a *tool* — it makes the reseller
subscription stickier by giving them a daily-use reason to stay.
- **Dual monetization, both on-model (flat fee / bundle — never a cut of a deal):** sell it
  **paid standalone** (earns on its own + pulls in resellers not yet on the list) *and*
  **bundle it free with the reseller subscription** (retention weapon: "lot alerts + free
  pricing tool" is an easier yes than either alone). Front door and back door.
- **The hard part is the data, not the app.** Value lives entirely in estimate accuracy:
  - **Sold/completed comps are the only number that matters** — active listings are wishful
    asking prices. Verify *before building anything* that sold-price data can be obtained
    legally and reliably (eBay API terms / an aggregator or data partner). Historically this
    access has been gated and can be paid or restricted. Do not assume it.
  - **No scraping.** Against terms, brittle, and a legal liability under a paid product.
  - **Show ranges, not one confident number** ("similar sold for $18–$34 in the last 90
    days"). Condition and completeness swing value wildly; under-promising precision is what
    earns trust.
  - Start with one or two categories, prove usefulness, then expand sources.
- **Early breadcrumb (cheap, do it with the opt-in):** ask opting-in resellers **what
  categories they flip**. That both segments the audience and tells you which pricing data is
  worth sourcing first — the audience seeds the product spec, not just the distribution.

**Deferred to v2 (don't build yet):** push / SMS / email-digest channels (wire email first,
above); full buyer↔seller chat; follow-a-seller; payment-accepted badges; AI listing cleanup +
auto-categorization; advanced search; reviews; multi-day sales; aggregation of public listings
for cold-start density (needs legal review first).

---

## 7. The photos gap — fix before Phase 2

The host UI has photo uploads but the schema has **no photos storage**. Add:

**A) Table** (append to `schema.sql` and run):
```sql
create table if not exists public.sale_photos (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.sales(id) on delete cascade,
  storage_path text not null,
  position     smallint not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists sale_photos_sale_ix on public.sale_photos (sale_id);

alter table public.sale_photos enable row level security;

-- public can read photos of published sales; host manages their own
create policy sale_photos_read on public.sale_photos
  for select to anon, authenticated using (
    exists (select 1 from public.sales s
            where s.id = sale_id and (s.listing_paid = true or s.host_id = auth.uid()))
  );
create policy sale_photos_write on public.sale_photos
  for all to authenticated using (
    exists (select 1 from public.sales s where s.id = sale_id and s.host_id = auth.uid())
  ) with check (
    exists (select 1 from public.sales s where s.id = sale_id and s.host_id = auth.uid())
  );
```

**B) Storage bucket** (Supabase dashboard → Storage → New bucket):
- Name: `sale-photos`, **public read** on.
- Storage RLS: authenticated users may upload/delete only under their own `host_id/`
  path prefix. (Claude Code: write the bucket policy and document the dashboard clicks.)

---

## 8. Stripe — the $5 listing flow (spec)

- One-time payment, **Stripe Checkout in `payment` mode**, **$5.00 USD**.
- **Flow:** host fills the sale form → row created with `listing_paid = false` (not
  visible on the public map) → **"Publish for $5"** → Stripe Checkout → on
  `checkout.session.completed`, a **Vercel webhook route** sets `listing_paid = true`
  and stores `stripe_payment_id`.
- **Security:** verify the Stripe signature; do the DB write with the **service-role key,
  server-side only**. Never set `listing_paid` from the client.
- Test mode first; T.J. flips to live mode in the Stripe dashboard when ready.
- Nothing appears on the public map until this exists — it's the gate.

---

## 9. Google Maps integration (spec)

Replace the prototype's CSS-faked map with the real thing.

- **Map render:** Google Maps JS API. **Custom markers** colored by `sale_status`
  (see §11). The live pin gets a pulsing halo.
- **Address entry:** Google **Places Autocomplete** on the host address field → store the
  resulting lat/lng into `sales.location` as `geography(Point, 4326)`
  (`st_point(lng, lat)`).
- **Route legs:** Google **Distance Matrix / Routes API** for real drive times between
  stops, feeding the planner in §10.
- **Ops:** restrict the API key by HTTP referrer; Maps Platform billing must be enabled.
  Document the console steps for T.J. **Follow `MAPS-COST-CONTROLS.md`** for matrix
  caching, single-map-instance reuse, and the required billing cap + quotas.

---

## 10. Time-aware route planner (the moat — spec)

This is a **Vehicle Routing Problem with Time Windows (VRPTW)**, not shortest-path.

- Each stop has an **open/close window**. A valid route **arrives within every window**
  and **minimizes total drive time**.
- **Algorithm:** pull pairwise leg times from Distance Matrix → **greedy
  nearest-neighbor seed + a 2-opt improvement pass**, rejecting any order that arrives
  after a stop's `closes_at`. Runs client-side for ≤15 stops, or in a Vercel function.
- **Per-stop UI** (mirror the prototype's `schedule()` logic exactly):
  - ETA arrival time, the sale's close time,
  - a **verdict chip**: ✓ makes it (with minutes to spare) / ◔ cutting it close / ✕
    closes before you arrive,
  - "wait N min for open" if the shopper would arrive before it opens.
- **Dwell time** per stop defaults to **20 min** (make it a constant, ideally
  user-adjustable later).
- Route start = the shopper's home point (or current location).

The prototype's `schedule()` function is the reference implementation — port its logic,
swap its fake distances for real Distance Matrix legs.

---

## 11. Design system → see `DESIGN.md`

**`DESIGN.md` is the single source of truth for all visual design** — palette, type scale,
spacing, the mascot, the hero, component specs, and the "defaults to never ship" list.
Read it before building any UI and derive every color/font/size from it. The landing hero
is already built as `reference/hero-frame.html`; match it. Do not use any palette values from earlier
drafts of this brief — `DESIGN.md`'s tokens win.

Quick orientation only (full detail in `DESIGN.md`): fun, bold, mascot-led — the opposite
of the cold-blue scraper competitors. Display face **Bricolage Grotesque**, body
**Instrument Sans**, all numbers in **Space Mono**. Primary **pink `#FF2E63`**, live
**green `#12B76A`**, price-sticker **tangerine `#FF9F1C`**, ink `#17131F` on a near-white
canvas. Pin status colors: live = green (pulse) · winding_down = tangerine · scheduled/open
= pink · closed = grey.

---

## 12. Environment variables

| Var | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | RLS-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | webhooks / privileged writes — never ship to client |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | client | referrer-restricted |
| `GOOGLE_MAPS_SERVER_KEY` | server | Distance Matrix (optional split key) |
| `STRIPE_SECRET_KEY` | server | |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client | |
| `STRIPE_WEBHOOK_SECRET` | server | verify signatures |
| `RESEND_API_KEY` | server | v2 |
| `ANTHROPIC_API_KEY` | server | v2 listing cleanup |

Secrets live in `.env.local` (git-ignored) and in Vercel's env settings. Claude Code
scaffolds `.env.example` with keys only, no values.

---

## 13. Conventions & guardrails

- **RLS is the security layer.** All privileged access goes through it. Never use the
  service-role key in client code or to sidestep policies.
- **Payment state is server-truth.** `listing_paid` is only ever set by the verified
  Stripe webhook — never by the client.
- **TypeScript strict.** Type Supabase rows from generated types.
- **Money & time math is deterministic and server-checked** where it gates access.
- **Mobile-first.** Most shoppers use this on a phone, in a car, on a Saturday.
- **Keep secrets out of the repo.** Ever.

---

## 14. Suggested build order (phases)

0. **Scaffold** — Next.js + Tailwind + Supabase client; run `schema.sql` + the §7 photos
   additions; confirm categories seeded.
1. **Accounts + profiles** — email + password sign-up/login (username handle, verification,
   reset); profile/prefs auto-created (trigger in schema); public `/u/username` page.
2. **Host sale form** — Places autocomplete, hours, categories, photo upload to Storage;
   saves `listing_paid = false`.
3. **Stripe $5 flow** — Checkout + webhook → `listing_paid = true`.
4. **Shopper map** — Google Maps + `sales_near()` + custom status pins + preview cards +
   day filter.
5. **Route planner** — add/reorder stops, Distance Matrix legs, time-window verdicts,
   optimize.
6. **Go Live lifecycle** — host status controls + Realtime pin updates on shopper maps.
7. **Polish** — empty states, loading, mobile pass, accessibility.

Then v2: notifications (email/push/SMS with the consent record), AI listing cleanup.

**Schema note for the reschedule/address features:** minimal — on `sales`, use `paid_at`
(never expires), `sale_date` (drives the 7-day public visibility window), and add a small
`reschedule_count` for the abuse cap. Address edits reuse existing `address` + `location`.
No `purchase_window_ends` — there's deliberately no expiration. Reschedule and address-move
re-alerts reuse the wishlist-alert plumbing.

---

## 15. Explicit non-goals (don't build these — saying no protects the model)

- **Listings are non-transferable.** A paid listing cannot be sold, traded, gifted after
  purchase, or moved to another account. Allowing it would create a secondary market in $5
  credits that undercuts pricing and breaks the verified-host trust chain. The real need
  ("list a sale for a friend") is served by letting a host **create + pay for a listing on
  behalf of someone else** (payer stays accountable) — a small fast-follow, not a transfer.
- **No deferring the $5 charge to sale day.** Charge at setup; paid-from-day-one pins are the
  trust anchor. Weather/rescheduling is handled by the never-expiring-listing rule, not by
  moving when money changes hands.
- **The tally calculator is a per-buyer scratchpad**, not cash/day-total accounting (tax
  headache, different product).

---

## 16. Open decisions for T.J. (confirm before/early in the build)

1. **Brand name in UI copy** — "XLResale" for now (owns the domain); the code/tables are
   name-agnostic, so a later rename is copy-only.
2. **Supabase project** — dedicated project for XLResale, or the shared Xandland project?
   (Dedicated is cleaner for a consumer app with PostGIS + Realtime load.)
3. **Cold-start density** — how to seed enough sales that early shoppers see a full map.
   Aggregating public listings is one option but needs legal review; deferred, not in v1.

---

## 17. Kickoff prompt for Claude Code

Paste this as the first message once the files are in the repo:

> Read `CLAUDE.md` in full, then `DESIGN.md`, `schema.sql`, and the files in `reference/`. Confirm you
> understand the product, the stack, the v1 scope, and my deploy flow (I use GitHub
> Desktop → Vercel and don't run terminal commands — you run them). Then start with
> **Phase 0**: scaffold the Next.js + Tailwind + Supabase project, wire the Supabase
> client, and give me the exact dashboard steps to run the schema and add my env vars.
> Don't build ahead of the current phase. When Phase 0 is done, stop and check in.
