# XLResale — Build Brief & `CLAUDE.md`

> **What this is:** the operating brief for building XLResale. Read it fully before
> writing any code. It defines the product, the stack, what's already built, what to
> build first, and the conventions to hold to. When in doubt, follow this document.
>
> **Companion files in this repo:**
> - `schema.sql` — the complete database migration (already written, ready to run).
> - `DESIGN.md` — **the design system. Read it before building any UI and follow it
>   exactly.** Covers palette, type, the mascot, and the hero.
> - `MAPS-COST-CONTROLS.md` — how to use Google Maps without surprise bills. Follow it.
> - `design-reference.html` — a standalone visual prototype of the product UI. **Design
>   reference only — do not port it.** Rebuild its look/behavior as Next.js components.
> - `hero-frame.html` — the built landing hero, composed over the real mascot render.
>   Rebuild the landing hero to match it (pulling type/color from `DESIGN.md`).
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
- ✅ **Design prototype (`design-reference.html`)** — shows the full visual system, both
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

1. **Auth** — Supabase email magic-link sign-in; profile auto-created on signup.
2. **Host: create a sale** — form with Google Places address autocomplete, hours,
   categories, **photos**; then **pay $5** to publish (`listing_paid = true`).
3. **Shopper: map** — nearby sales via `sales_near()`, day filter, **custom pins colored
   by status**, click-to-preview.
4. **Shopper: time-aware route planner** — add stops, drag to reorder, per-stop **ETA vs
   closing time** with a make-it/miss-it verdict, "optimize" button.
5. **Host: Go Live lifecycle** — cycle `scheduled → live → winding_down → closed`; pin
   updates on shopper maps **in real time**.

**Deferred to v2 (don't build yet):** SMS / push / email-digest notifications; AI listing
cleanup + auto-categorization (nice, but not v1-critical); advanced search; reviews;
multi-day sales; any social/"Crews" features; aggregation of public listings for
cold-start density (needs legal review first).

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
is already built as `hero-frame.html`; match it. Do not use any palette values from earlier
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
1. **Auth + profiles** — magic link; profile/prefs auto-created (trigger already in schema).
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

---

## 15. Open decisions for T.J. (confirm before/early in the build)

1. **Brand name in UI copy** — "XLResale" for now (owns the domain); the code/tables are
   name-agnostic, so a later rename is copy-only.
2. **Supabase project** — dedicated project for XLResale, or the shared Xandland project?
   (Dedicated is cleaner for a consumer app with PostGIS + Realtime load.)
3. **Cold-start density** — how to seed enough sales that early shoppers see a full map.
   Aggregating public listings is one option but needs legal review; deferred, not in v1.

---

## 16. Kickoff prompt for Claude Code

Paste this as the first message once the files are in the repo:

> Read `CLAUDE.md` in full, then `schema.sql` and `design-reference.html`. Confirm you
> understand the product, the stack, the v1 scope, and my deploy flow (I use GitHub
> Desktop → Vercel and don't run terminal commands — you run them). Then start with
> **Phase 0**: scaffold the Next.js + Tailwind + Supabase project, wire the Supabase
> client, and give me the exact dashboard steps to run the schema and add my env vars.
> Don't build ahead of the current phase. When Phase 0 is done, stop and check in.
