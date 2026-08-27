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
sides, finger-drag and swipe on the route planner, the install prompt reworded and moved,
**the role chooser** (§9), and **the copy-and-visual pass** (§10).

Then **finds sharing** — the growth loop (§11) — and the **free-pile map filter** (§12).

**Not done, and next up:** §8 is the priority list, which is now the seller v1.5 backlog —
weather nudge and wash-out credit first, both unblocked since editing landed. Stripe stays
last at T.J.'s instruction.

---

## 2. What is built

**24 pages** · **3 API routes** · **15 migrations** · **53 commits**

| Area | State |
|---|---|
| Accounts | Email+password, verification, reset, Turnstile bot check, public `/u/username`, **role chooser** |
| Host | Create, **edit/reschedule**, Go Live lifecycle, featured items, bulk discounts, free pile, photos, **self-serve takedown** |
| Shopper | Map with status pins + day and **free-stuff** filters, sale pages with realtime, save, dashboard, **route planner**, wishlist alerts, finds tracker + **public share pages** |
| Alerts | Queued by DB trigger, delivered by email (Resend) + web push, three kinds (match / rescheduled / moved) |
| PWA | Manifest, icons, service worker, install + notification opt-in |
| Admin | `/admin` overview, accounts (suspend/delete), sales (comp/hide/delete), audit trail |
| Legal | `/privacy`, self-serve account deletion |

Routes: `/ /account /account/delete /account/password /admin /admin/sales /admin/users
/forgot-password /host /host/[id] /host/[id]/edit /host/new /login /map /privacy /route
/s/[id] /shop /shop/alerts /shop/finds /signup /u/[username] /welcome`

Plus `/f/[id]` — a public find, with a generated Open Graph card at
`/f/[id]/opengraph-image`.

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

7. **The role chooser is stored as `profiles.focus`, not `profiles.role`,** and is a UI
   preference that must never become an authorisation check. See §9 for why the name
   matters in a project where `role` already means something.

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
- **`next.startsWith("/") && !next.startsWith("//")` is not a redirect guard**, and the
  sign-in action was using it. `/\evil.com` passes it, and the browser resolves that to
  `https://evil.com/`. `lib/safe-redirect.ts` exists for this and now has both callers.
  Anything that hands a caller-supplied path to `redirect()` must go through it.
- **Turnstile cannot pass on localhost** — the site key is domain-restricted, so the token
  never arrives and the submit-hold never releases. A browser sign-in against the dev
  server is therefore impossible; verify signed-in behaviour server-side (§6).

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
when the pane isn't displayed; the preview drops), and Turnstile makes a real browser
sign-in impossible locally anyway (§4). What worked: mint a session with the admin API
(`generate_link` → `verify`), encode it as `sb-<ref>-auth-token` the way `@supabase/ssr`
does (`base64-` + base64url JSON, chunked at 3180), and `fetch` the page with that cookie.
**Use `logout?scope=local`** — `scope=global` signs the user out on every device, which
happened repeatedly and looked to T.J. like broken auth.

Two details that cost time:
- `verify` wants **`{ type, token_hash }`**. `generate_link` returns the *hashed* OTP, and
  posting it as `{ type, token, email }` comes back `otp_expired`, which reads like a
  timing problem and isn't one.
- **Server Actions can be driven without a browser.** Next renders a hidden
  `$ACTION_ID_<hash>` input into every form for the no-JavaScript path; read it out of the
  HTML and POST the form as `multipart/form-data` and the real action runs. That is how
  the role chooser was tested end to end.

**Test data.** Six `[TEST]` sales owned by T.J. are still on the map. They should go
before any real visitor sees the map.

---

## 7. The agreed UX plan (partly built)

From T.J.'s walkthrough, with the reasoning that survived discussion:

- **Root cause of "hard to navigate" was no shared navigation** — 13 pages each
  hand-rolled a header. ✅ Fixed: one bar, Map · Saved · Alerts · Sell · You, bottom on
  mobile.
- **Role chooser** — three buttons on first sign-in, then the account page reorders.
  ✅ Built, see §9. The agreed caveat is what the code enforces: "Both" means *buyer-first
  with selling visible*, never "show all eight cards", and the choice reorders without ever
  hiding a card.
- **Handle up front** — T.J. wants it for both roles. Signup still collects a username.
  **Deliberately left open, both sides recorded:**
  - *Against:* "username taken" at signup is a classic abandonment point, and a shopper
    who only wants alerts is being asked to invent a public identity before they've seen
    a single sale. Alternative: display name up front, unique handle deferred to the
    first public action.
  - *For (T.J.):* collisions only start happening at a scale where the app is popular
    enough that nobody abandons over one. Which is right — at a few hundred users the
    "taken" path essentially never fires.
  - The residual concern is the *ask*, not the collision, which makes it partly a copy
    problem. Revisit when a real stranger has tried the signup, not before.
- **Map prominent** — argued it should *be* the buyer home rather than a button. ✅ Settled
  by the chooser: a plain sign-in now lands a shopper (and a "both") on `/map` and a host on
  `/host`. The Map tab is also leftmost in the nav, so it stays one tap from everywhere.
- **Categories** ✅ built.
- **Touch drag + swipe-to-remove on the route** ✅ built, **unverified on a real device**.
- **Less wordy, more visual** ✅ done, see §10. 20% fewer words across the signed-in app,
  and category colour is now carried on the cards a shopper actually scans.

---

## 8. What is left, in priority order

**Blocking a real launch**
1. **Stripe $5 flow** — T.J. wants this last. Note the consequence: without it no real
   host can publish, so the comp control in `/admin/sales` is the pilot path.
2. Privacy policy exists but the contact address `hello@xlresale.com` may not be real, and
   nobody qualified has reviewed it.

**Seller v1.5 backlog** (all specified in CLAUDE.md §6)
3. Weather nudge and wash-out credit — both unblocked now that editing exists.
4. Tap-to-total calculator (brief says build last).
5. Buyer↔seller "is this still available?" ping — needs report/block first.
6. Incoming-shopper ETAs.
7. End-of-sale handoff and the $5 bulk-lot blast.

**Unverified by a human — needs a phone, ten minutes**
- The Turnstile submit-hold fix (sign out, sign in at normal typing speed)
- Web push end-to-end (`VAPID_PRIVATE_KEY` is the only unconfirmed env var)
- The new nav, category picker, and route drag/swipe
- **The map's Free stuff toggle and the FREE pin badge** — behaviour and SVG are verified
  (§12), but nobody has seen either on a map.
- **How the chooser looks.** Its behaviour is verified against the running app (§9), but
  nothing has been seen on a screen this session: the browser pane wouldn't composite
  frames, so every screenshot timed out.

**Housekeeping**
- Delete the six `[TEST]` sales.
- A security kit lives in `files.zip` at the repo root: two scanners plus a pre-push hook
  and a GitHub Action, **not installed**. Both scanners currently pass except one warning
  that cannot be cleared — the `admins` "no policy" warning promises a comment-based
  suppression its code never implements. Leave the code correct.

---

## 9. The role chooser, as built

`schema-additions-focus.sql` · `lib/focus.ts` · `app/welcome/` · `components/FocusChooser.tsx`

Three buttons on a first sign-in — **Shopping · Selling · Both** — which reorder the
account page and decide where signing in lands.

**It is `profiles.focus`, not `profiles.role`.** In a Supabase project `role` already means
anon / authenticated / service_role, and `auth.users` has a column by that name. A
`profiles.role` sitting next to twenty RLS policies invites somebody to gate access on it —
on a preference the person picked for themselves and can change in one tap. `focus` cannot
be misread that way. **It must never become an authorisation check.**

**NULL means "never asked",** and that is what puts the chooser in front of someone. Every
account that predates this is null, so each gets the question once, on its next sign-in.
There is deliberately **no skip**: a skip that left the column null would show the same
person the same page at every sign-in, which is the worse wall.

**The answer reorders; it never hides.** `CARD_ORDER` in `app/account/page.tsx` holds three
lists, and every list contains every card. `both` — which will be the popular answer — means
shopping first with selling immediately under it, not "show them everything".

**Where a sign-in lands** (`landingFor`): shopping → `/map`, both → `/map`, selling →
`/host`, never-asked → `/welcome`. **Only the *default* destination is replaced.** Someone
who clicked "List your sale" arrives with `next=/host/new` and keeps it; asking "what brings
you here?" one tap after they said so is the kind of interstitial that feels like paperwork.
The same rule protects the password-reset link, which comes through `/auth/callback` asking
for `/account/password` and has to get it.

**Also fixed here, because the same code path had to change:** `signIn` sanitised `next`
with `startsWith("/") && !startsWith("//")` and handed the result to `redirect()`. That is
the exact case `lib/safe-redirect.ts` was written about — `/\evil.com` passes the string
test, and the browser resolves it to `https://evil.com/`. It was a live open redirect on the
sign-in page, which is the worst place for one: the visitor has just proved the site is
genuine by logging into it. Both entry points now go through `safeRedirect`.

**Verified** against the running app by reading the progressive-enhancement action id out of
the rendered HTML and posting the form the way a browser with JavaScript off would — so the
real Server Action ran, not a stand-in. Fourteen checks: the chooser renders for a null
focus; each answer writes and redirects to the right home; `/welcome` stops being reachable
once answered; each answer produces its own card order; and all eight cards survive all
three answers.

**A real browser sign-in is not possible locally** — the Turnstile key is domain-restricted,
so on localhost the token never arrives and the submit-hold (correctly) never releases. That
is why the verification above is server-side. It also means the sign-in *redirect* has only
been proven through `/welcome`'s own redirect, not through the login form.

---

## 10. The copy-and-visual pass, as done

T.J.'s brief: the app is "far too wordy", bring Nub into empty states, use the category
colours. **20% fewer visible words** across the signed-in app — `/account` −32%,
`/shop` −29% — measured by rendering each page before and after and counting.

**The rule used for cutting.** A line survives only if it says something the page can't
show. What went was the paragraph that named the buttons directly underneath it
(`/shop`'s subhead listed its own three sections; five account cards explained their own
link), the sentence narrating what the interface already demonstrates (the route planner
claiming it beats closing times, above stop cards showing a hit, a near-miss and a miss;
"prices update live" above prices that visibly update over Realtime), and the second
sentence of anything that had made its point in the first.

What stayed: the safety and money lines the brief requires (`/s/[id]` still says pay the
host directly, no cut, meet safely — one sentence instead of three), anything about what
is kept private, and the reassurance at the top of the sale form, which is the sentence
that gets somebody to start filling one in.

**Nub is now on the empty states that had none** — the empty map, which is the first
thing a lot of people will ever see, and the route planner. One Nub per screen, so
`/shop`'s second empty list stayed a plain line rather than shrugging at you twice.

**Category colour reaches the cards people scan.** `components/CategoryChips.tsx` is one
component for the chips, so a sale reads the same in a list, in an alert, and on its own
page; `lib/sale-categories.ts` fetches them for a whole list in one round trip rather than
one per row. The landing page now reads its chips from the database — it had eight
hardcoded labels from before the tree renamed them, so it was advertising "Vinyl / Media"
and "Outdoors" to people who would then find "Books, Music & Media" and "Outdoors &
Camping" in the filters.

**Two bugs found while in there.** The bulk-lot preference rendered a checkbox per
category — eight before the category tree landed, **101** after it; it's parents only now.
And the 404's "Back to the map" button went to the landing page.

**~~Not covered:~~ the map's preview card — done later, and the reasoning here was wrong.**
This said a second query had nowhere cheap to hang. It didn't need one:
`sales_near_upcoming` has returned each sale's category slugs all along, so the map page
fetches the ~100 category rows once and the client maps slug → colour. Fixed with the
free-pile filter (§12). Worth remembering as a case of ruling something out without
reading the function's return type.

---

## 11. Finds sharing — the growth loop, as built

`schema-additions-finds-sharing.sql` · `lib/finds.ts` · `app/f/[id]/` ·
`components/FindPhotoField.tsx` · `components/ShareButton.tsx`

A find gets a photo, a public page at `/f/[id]`, a generated Open Graph card, and a Share
button. The brief's line is "every shared find is a free ad", so the share page is written
for the stranger who opens the link, not for the finder: the bargain, then who found it,
then one line of pitch and a door.

**The bucket existed only as a sentence.** `finds.photo_path` has been in the schema since
the second migration, pointing at a bucket that `schema-additions-auth-profiles.sql` §7
left as a dashboard step nobody clicked — so it was null on every row that could ever be
written. It's created in SQL now, with the same owner-prefix policies as `sale-photos`.

**Photos never go through the Server Action.** A Server Action body is capped at 1MB and a
phone photo isn't, so the browser uploads to Storage and posts back only the path. The
action re-checks that path (`<own-uid>/<uuid>.<ext>`, no second slash) before writing it to
a row, because the path arrives as a plain form field and every reader downstream trusts
it. The trade: pick a photo and abandon the page, and the object is orphaned. Choosing a
different photo cleans up the last one, so it's bounded to abandoned drafts.

**Private means private.** `/f/[id]` reads through `finds_public_read`, so a private find
is a 404 and its card renders the generic XLResale one with no title in it. A public find
by a *private profile* renders unattributed — the find was made public, the person wasn't.

**The Open Graph card fought back, and the fixes are worth knowing:**
- `fetch(new URL("./x.ttf", import.meta.url))` is the pattern the Next docs give for local
  assets in an OG route. Turbopack answers a `file:` URL with "not implemented... yet...".
  Both fonts and the mascot are therefore served from `public/` and fetched over HTTP.
- **A photo the renderer can't decode is not catchable.** It throws while the response is
  being piped, so a try/catch around the render — even one that awaits the bytes — still
  lets the request 500, and a 500 means the link previews as nothing. The card now fetches
  the photo itself and sniffs its magic bytes, and anything that isn't PNG/JPEG/GIF/WebP
  becomes the mascot layout. This matters because **the bucket accepts HEIC, which is what
  an iPhone uploads, and HEIC is exactly what the renderer can't read.**
- The asset cache hands out a **copy** of each buffer, never the cached one. A warm
  instance serves many requests from it, and a detached ArrayBuffer surfaces as
  "unsupported image format" on request two, which looks nothing like a caching bug.

**Three layers stop an unusable photo**, because each catches what the others can't: the
uploader refuses a file the browser can't draw, the card sniffs bytes and falls back to
Nub, and the share page's `<img>` is the only place left that can show nothing.

**The Share button has a third path.** Native sheet, then clipboard, then — when the
clipboard is denied, which really happens — the URL appears in a selected readonly input.
Before that it silently did nothing, on the one button whose entire job is handing someone
a link.

**Verified** with 24 checks against the running app: upload, the real Server Action, a
photo path under someone else's id, a traversal path, the share page as a signed-out
stranger, every Open Graph tag, the card as real PNG bytes, a private find 404ing, the
profile linking through, and a HEIC photo still producing a card. Both card layouts were
rendered and looked at.

**Left undone:** a photo that decodes in the uploader's browser but not in the renderer
(16-bit PNG, CMYK JPEG) still 500s the card. The share page itself is fine, so the cost is
a missing preview image, and the byte sniffing covers the case that actually happens.

---

## 12. The free-pile filter, as built

`app/map/MapView.tsx` · `app/map/page.tsx` · `lib/map-pin.ts`

A **Free stuff** toggle on the map, sitting apart from the day buttons because it's a
toggle rather than another day, and green because that's the colour of the FREE badge it
filters for. It only renders when something in range actually has a free pile — computed
over every loaded sale, not the day-filtered set, so it doesn't appear and vanish as you
tap between days.

**The pin got the badge too**, which the brief asked for and nothing had built: a green
disc with a canvas-coloured ring at the tag's top-right. The ring is what keeps it legible
on the one pin that is already green — a live sale. A dot rather than the word, because
four letters at 40px across are mush. `tagPinDataUri` takes an options object now instead
of a positional boolean. A filter for something invisible on the map is half a feature,
which is why this came along with it.

**Filtering still never touches the map instance.** Both filters only call
`marker.setVisible`, per MAPS-COST-CONTROLS.md §2 — every fresh map init is a billable
load, so a filter tap must not cause one.

**Filters can now exclude everything while pins are still loaded**, and a blank map with no
explanation reads as a broken one. That case says which filter did it ("No free piles on
Saturday") and undoes it in a tap.

**Verified:** five checks that the page ships `free_pile` and the category slugs to the
client and renders the toggle, and eight against the real `lib/map-pin.ts` (executed via
`tsx`, not reimplemented) covering the badge on plain, live, and selected pins.

**Unverified, and it needs a phone:** how the toggle and the pin badge actually look. A
signed-in browser can't be had locally — Turnstile can't pass on localhost (§4) — and
screenshots don't work on this machine at all, so nothing on the map has been seen with
eyes this session.

---

## 13. How this session worked

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
