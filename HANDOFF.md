# XLResale — handoff

**Read this before `CLAUDE.md`.** `CLAUDE.md` is the product brief and is still
authoritative on *what* to build and *why*. This file is what's actually been built, the
decisions that override the brief, the traps that have already bitten, and what's left.

Last updated at the end of a long build session. Live at **xlresale.com**, deployed from
`main` on every push (Vercel auto-deploys — commits are pushed directly, at T.J.'s
request, overriding CLAUDE.md §3's "T.J. pushes via GitHub Desktop").

---

## 1. Where we left off

**Mid-way through a navigation and UX pass**, prompted by T.J. walking the signed-in app
and finding it hard to move around.

Done in that pass: a single navigation bar, a category tree with subcategories on both
sides, finger-drag and swipe on the route planner, and the install prompt reworded and
moved.

**Not done, and next up:**

1. **Role chooser on first sign-in** — three buttons (List a sale / See sales near me /
   Both), which then reorders the account page. See §7 for the design already agreed.
2. **Copy-and-visual pass** — T.J.'s words: the app is "far too wordy". Cut the
   explanatory paragraphs, bring Nub into empty states, use the category colours.

Do the role chooser first: it reshapes the account page, so doing copy first means
writing it twice.

---

## 2. What is built

**22 pages** · **3 API routes** · **13 migrations** · **49 commits**

| Area | State |
|---|---|
| Accounts | Email+password, verification, reset, Turnstile bot check, public `/u/username` |
| Host | Create, **edit/reschedule**, Go Live lifecycle, featured items, bulk discounts, free pile, photos, **self-serve takedown** |
| Shopper | Map with status pins + day filter, sale pages with realtime, save, dashboard, **route planner**, wishlist alerts, finds tracker |
| Alerts | Queued by DB trigger, delivered by email (Resend) + web push, three kinds (match / rescheduled / moved) |
| PWA | Manifest, icons, service worker, install + notification opt-in |
| Admin | `/admin` overview, accounts (suspend/delete), sales (comp/hide/delete), audit trail |
| Legal | `/privacy`, self-serve account deletion |

Routes: `/ /account /account/delete /account/password /admin /admin/sales /admin/users
/forgot-password /host /host/[id] /host/[id]/edit /host/new /login /map /privacy /route
/s/[id] /shop /shop/alerts /shop/finds /signup /u/[username]`

APIs: `/api/cron/send-alerts` `/api/push/subscribe` `/api/route-matrix`

---

## 3. Decisions that override or extend CLAUDE.md

These were made deliberately. Don't "fix" them back.

1. **Alerts fire from a database trigger, not the Stripe webhook** (§6 says webhook). A
   trigger fires however a sale becomes public — webhook, admin comp, manual SQL — so the
   retention hook can't be skipped by a path nobody wired. `schema-additions-notify.sql`.

2. **`listing_paid` is never a visibility switch.** Hiding uses `hidden_at` /
   `hidden_by_admin`. Two reasons: §13 reserves `listing_paid` for the verified webhook,
   and flipping it false→true is exactly what the alert trigger watches, so every restore
   would re-blast that sale's alerts.

3. **Host address precision is enforced in the database.** Block-level outside the sale
   window, exact from 30 min before opening to 3 h after closing. Full rationale and the
   five answered questions in `docs/ADDRESS-POLICY.md`. `SELECT` on `sales.address` and
   `sales.location` is **revoked** from `anon` and `authenticated`; everything public goes
   through the `public_sales` view or the `sales_near_*` functions.

4. **Payment stays create-then-pay.** T.J. proposed pay-first and then agreed to keep the
   brief's order (§8): fill in the sale, then "Publish for $5". Asking a stranger for
   money before they've typed anything is the highest-drop-off possible.

5. **Comped listings** (`comped_at`, `comped_reason`) are the one legitimate exception to
   §13 — an admin publishing without payment. Stamped as a comp so it never counts as
   revenue. This is also the brief's "rain-check credit", and until Stripe exists it is
   **the only way a real host's sale can reach the map**.

6. **Category matching is asymmetric — do not "simplify" it.** See §5.

---

## 4. Traps that already bit — check these first when something is odd

- **`integer * 1609.344` is `numeric`, and PostGIS `st_dwithin` has no geography overload
  for it.** Cast to `double precision`. Bit three separate functions.
- **`set search_path = public` hides PostGIS.** Supabase installs it into `extensions`.
  Any SECURITY DEFINER function using PostGIS needs `set search_path = public, extensions`.
- **A partial unique index only works as an `ON CONFLICT` arbiter if the statement repeats
  the index predicate.** Dropping a blanket UNIQUE for a partial one silently broke every
  wishlist match until the `where kind = 'match'` was added to the conflict clause.
- **PostgREST expands `select=*` before checking column privileges.** After narrowing the
  grant on `sales`, every `select("*")` on that table 401'd — including two `head: true`
  counts that broke the landing page and the account page. Name your columns.
- **Supabase default privileges grant `EXECUTE` to `anon` on every new function in
  `public`.** `REVOKE … FROM PUBLIC` does *not* remove it. Revoke from `anon` explicitly.
- **`NOT NULL` + `ON DELETE SET NULL` is a contradiction** that only fires on delete. It
  made admins undeletable. Fixed on `admin_actions.actor_id`.
- **Turnstile is checked before the password.** A missing captcha token produces
  "verification expired", which users read as "my password is wrong". The submit is now
  held until the token lands (`components/Turnstile.tsx`).
- **`match_sale_to_wishlists` had never run** before this session, because nothing called
  it. Assume any never-invoked function is untested.

---

## 5. Category matching — the part that is easy to get wrong

Two levels: 18 parents, 83 children, all in `public.categories` with `parent_id`.

A shopper's picks expand **one level in both directions**. The sale's tags are left
exactly as the host wrote them:

- **down** — asked for *Electronics* → a sale tagged *Computer parts* matches
- **up** — asked for *Video games* → a sale tagged only *Electronics* matches, because the
  host was unspecific and it might be in there

The tempting shortcut is to expand *both* sides to their ancestors and test for overlap.
That silently matches **siblings**: someone wanting video games gets alerted about computer
parts, because both roll up to Electronics. Expanding only the shopper's side is what keeps
them apart. `public.category_match_set()`.

Verified: exact ✓, parent ✓, sibling ✗.

Wishlists no longer require a keyword — a category alone is a valid alert. Where both are
given, the keyword *narrows* the categories.

---

## 6. Operational facts

**Environment.** `.env.local` has everything except `RESEND_API_KEY` (Vercel only). Vercel
has all of it. `GOOGLE_MAPS_SERVER_KEY` is present locally but empty — drive times only
work in production.

**Database access.** No Supabase MCP auth in this setup. SQL was run with a throwaway
`pg` client in the scratchpad:
- Direct host `db.<ref>.supabase.co` **does not resolve**. Use the pooler:
  `postgresql://postgres.<ref>:<pw>@aws-0-us-east-2.pooler.supabase.com:5432/postgres`
- Password is in `SUPABASE-DB-PASSWORD.txt` (gitignored, repo root).
- `supabase gen types` needs Docker, which isn't installed — `lib/database.types.ts` has
  been **hand-patched** all session. It is accurate but no longer machine-generated.

**Verifying signed-in pages.** The browser tool is unreliable here (screenshots time out
when the pane isn't displayed; the preview drops). What worked: mint a session with the
admin API (`generate_link` → `verify`), encode it as `sb-<ref>-auth-token` the way
`@supabase/ssr` does (`base64-` + base64url JSON, chunked at 3180), and `fetch` the page
with that cookie. **Use `logout?scope=local`** — `scope=global` signs the user out on
every device, which happened repeatedly and looked to T.J. like broken auth.

**Test data.** Six `[TEST]` sales owned by T.J. are still on the map. They should go
before any real visitor sees the map.

---

## 7. The agreed UX plan (partly built)

From T.J.'s walkthrough, with the reasoning that survived discussion:

- **Root cause of "hard to navigate" was no shared navigation** — 13 pages each
  hand-rolled a header. ✅ Fixed: one bar, Map · Saved · Alerts · Sell · You, bottom on
  mobile.
- **Role chooser** — three buttons on first sign-in, then the account page reorders.
  ⬜ Not built. Caveat agreed: "Both" will win by default, so it must mean *buyer-first
  with selling visible*, never "show all eight cards". The choice reorders; it never hides.
- **Handle up front** — T.J. wanted it for both roles. Counter-argument offered and **not
  resolved**: "username taken" at signup is a classic abandonment point and a buyer who
  never posts a public find never needs one. Suggestion was display name up front, unique
  handle deferred to first public action. Signup still collects a username. **Open.**
- **Map prominent** — argued it should *be* the buyer home rather than a button. Currently
  the Map tab is leftmost in the nav, which is one tap from everywhere. Landing after
  sign-in is still `/account`; changing it is tied up with the role chooser.
- **Categories** ✅ built.
- **Touch drag + swipe-to-remove on the route** ✅ built, **unverified on a real device**.
- **Less wordy, more visual** ⬜ not started.

---

## 8. What is left, in priority order

**Blocking a real launch**
1. **Stripe $5 flow** — T.J. wants this last. Note the consequence: without it no real
   host can publish, so the comp control in `/admin/sales` is the pilot path.
2. Privacy policy exists but the contact address `hello@xlresale.com` may not be real, and
   nobody qualified has reviewed it.

**The agreed UX pass**
3. Role chooser (§7).
4. Copy-and-visual pass — cut paragraphs, Nub in empty states, category colours.

**Buyer gaps**
5. **Finds sharing** — logging works, sharing doesn't. No photo upload, no Open Graph
   share pages, no Web Share API. The brief calls this the growth loop.
6. Free-pile map filter ("sales with free stuff") — the badge exists, the filter doesn't.

**Seller v1.5 backlog** (all specified in CLAUDE.md §6)
7. Weather nudge and wash-out credit — both unblocked now that editing exists.
8. Tap-to-total calculator (brief says build last).
9. Buyer↔seller "is this still available?" ping — needs report/block first.
10. Incoming-shopper ETAs.
11. End-of-sale handoff and the $5 bulk-lot blast.

**Unverified by a human — needs a phone, ten minutes**
- The Turnstile submit-hold fix (sign out, sign in at normal typing speed)
- Web push end-to-end (`VAPID_PRIVATE_KEY` is the only unconfirmed env var)
- The new nav, category picker, and route drag/swipe

**Housekeeping**
- Delete the six `[TEST]` sales.
- A security kit lives in `files.zip` at the repo root: two scanners plus a pre-push hook
  and a GitHub Action, **not installed**. Both scanners currently pass except one warning
  that cannot be cleared — the `admins` "no policy" warning promises a comment-based
  suppression its code never implements. Leave the code correct.

---

## 9. How this session worked

T.J. is a screenwriter, not a developer, and does not use a terminal. Run every command
yourself and give dashboard click-paths for anything that must happen in a GUI.

Secrets are handed over by **file** in the repo root (gitignored), never pasted in chat.
Read them, install them, delete the file.

Commits must be authored as **TJ Alex <tjalex01@gmail.com>** — Vercel blocks deploys
authored by `noreply@anthropic.com`.

What worked well: verifying against the live database rather than the screen, and saying
plainly when something couldn't be verified. What went wrong: one confidently wrong
diagnosis ("your password was never changed") built on a test that was itself broken —
worth checking your own test before believing its output.
