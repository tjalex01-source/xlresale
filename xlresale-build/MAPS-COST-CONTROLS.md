# XLResale — Maps cost controls

> Add a line to `CLAUDE.md` pointing here, and build these in now. Three controls keep
> Google Maps spend near zero at local scale and make a surprise bill impossible.
> (Pricing context: the old universal $200 credit is gone; each API has its own free
> monthly tier — ~10,000 free Dynamic Map loads, then ~$7/1,000 — and Route/Distance
> Matrix bills ~$0.008 per element, with **no automatic spending cap**.)

## 1. Cache the distance matrix — one Google call per route session

- When a shopper builds or optimizes a route, make **one** Route/Distance Matrix call
  for all selected stops + the start point, and cache the pairwise leg times in state
  (keyed by the set of stop IDs).
- **All** reordering, dragging, and what-if recalculation reads the **cached** matrix —
  never call Google on a drag.
- Re-call only when the *set* of stops changes (a stop added or removed), not when their
  order changes.
- For the live drag preview, use straight-line (haversine) distance for instant feedback;
  the cached road matrix backs the committed ETAs.
- **Why:** turns routing from a per-interaction cost into a per-session cost. One 6-stop
  route is a few cents; dragging it 20 times is still those same few cents.

## 2. One map instance, reused — never remount

- Instantiate the Google Map **once** and keep it mounted. Update markers and data on the
  existing instance; do not tear down and recreate it. **Every fresh map init is a
  billable Dynamic Maps load.**
- Load the Maps JS loader a single time and share the instance across views.
- Don't remount the map on tab/route changes — hide/show or update in place.
- For a small non-interactive map image on a card or preview, use a **Static Maps** image,
  not a full interactive map.

## 3. Hard billing cap + budget alerts — do this on day one

- Pay-as-you-go has **no default ceiling**, so this is the seatbelt.
- In Google Cloud Console → Billing → Budgets & alerts: set a budget with alerts (e.g.
  $10 / $25 / $50).
- More important: in APIs & Services → each API → Quotas, set **daily request quotas** on
  Maps JavaScript, Places, and Route/Distance Matrix to sane ceilings for your scale, so a
  bot or traffic spike physically can't run up a four-figure bill.
- Restrict the **browser key by HTTP referrer** (`xlresale.com`, `*.xlresale.com`) and the
  **server key by IP**. Never ship the server key to the client.

## Enforcement note for Claude Code

Implement #1 and #2 in code now. For #3, give T.J. click-by-click Cloud Console steps —
he sets the budgets and quotas in the dashboard.
