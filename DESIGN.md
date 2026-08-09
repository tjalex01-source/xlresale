# XLResale — Design System (`DESIGN.md`)

> **Read this before touching any UI, and derive every color, font, size, and spacing
> value from it.** This exists because "make it modern/fun" produces templated defaults.
> This spec removes the guesswork: follow it exactly. Companion visual references:
> `design-reference.html` (product UI) and `hero-frame.html` (the landing hero, built
> over the real mascot render).
>
> **Direction in one line:** the fluorescent poster-board yard-sale sign — big, bold,
> tactile — executed with modern discipline, and fronted by a friendly 3D **mascot**
> (see the Mascot section). Fun, high-energy, confident. Not cozy, not corporate.

---

## The three defaults to NEVER ship

If the design drifts toward any of these, it's wrong — they're what AI produces on
autopilot and they read as generic:

1. ❌ Cream background (`#F4F1EA`-ish) + high-contrast serif + terracotta accent.
2. ❌ Near-black background + one acid-green/vermilion accent.
3. ❌ Broadsheet layout: hairline rules, zero radius, dense newspaper columns.

Also avoid: everything center-aligned, uniform gray cards on white, timid 2rem headings,
generic rounded-rectangle buttons, fade-in-on-scroll on every element, emoji used as UI
icons.

---

## Color

Bright, committed, subject-rooted. Six named values — use them boldly, not just on buttons.

| Token | Hex | Role |
|---|---|---|
| `--canvas` | `#FFFDF9` | base — nearly white with a hair of warmth (NOT cream) |
| `--ink` | `#17131F` | text, structure, high-contrast blocks |
| `--pink` | `#FF2E63` | PRIMARY — fluorescent sale-sign pink |
| `--green` | `#12B76A` | "open now / go" — the live state |
| `--tangerine` | `#FF9F1C` | price-sticker orange — energy, "closing soon" |
| `--violet` | `#7C5CFC` | modern electric accent — category/links, keeps it from feeling purely retro |

Plus soft tints for section backgrounds: `--pink-50 #FFE7EE`, `--green-50 #DEF7EC`,
`--tangerine-50 #FFF1DA`, `--violet-50 #ECE7FF`.

**Rule:** at least **two full sections** must use a bold color-blocked background (pink,
green, tangerine, or ink) with contrasting text on top. A page that's all white-with-gray-
text is the flatness you're trying to escape. Commit to color.

---

## Type

The pairing is part of the identity — keep it.

- **Display:** `Bricolage Grotesque` (700 / 800). Quirky, modern, confident.
- **Body / UI:** `Instrument Sans` (400 / 500 / 600).
- **Numbers & data:** `Space Mono` (700) — **every** price, mile, minute, and clock time.
  This is a signature; never set data in the body font.

**Type scale — be bold. Timid headings are the #1 tell.**

| Use | Size | Weight | Tracking / leading |
|---|---|---|---|
| Hero display | `clamp(2.75rem, 8vw, 6.5rem)` | 800 | `-0.03em` / `0.95` |
| Section header | `clamp(2rem, 4vw, 3.25rem)` | 700 | `-0.02em` / `1.0` |
| Card title | `1.15–1.35rem` | 700 | `-0.01em` |
| Body | `1rem–1.125rem` | 400/500 | `1.5` |
| Eyebrow / label | `0.7rem` | 700 | `0.14em`, uppercase, mono or Instrument |
| Data (mono) | context | 700 | — |

---

## Spacing, radius, depth

- **Spacing scale (px):** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128. Use only these.
- **Section vertical padding:** 96–128 desktop / 56–72 mobile. Generous whitespace is
  modern; cramped is not.
- **Radius:** `--r-sm 10` · `--r-md 16` · `--r-lg 22` · `--r-pill 999`. Pick and stay
  consistent.
- **Depth:** soft, layered shadows (`0 6px 20px rgba(23,19,31,.10)`), not hard borders on
  everything. Tactile elements (tags, pins) get a slight shadow + a 1–3° rotation so they
  feel like real stickers.

---

## Signature elements (spend your boldness here)

1. **Live "OPEN NOW" hero moment.** The hero's characteristic beat: a pin (or the map)
   flips to pulsing green on load — the product's whole promise, animated once. This is
   the thing the page is remembered by.
2. **Sale-tag pins.** Custom map markers shaped like little price tags / signs, colored by
   status (green=live+pulse, tangerine=closing, pink=open today, grey=wrapped). Never the
   default Google red teardrop.
3. **Receipt-style route cards.** Each route stop is a perforated ticket: number, title,
   mono drive time + ETA, and a verdict chip (✓ makes it / ◔ tight / ✕ misses). This is
   already the strongest idea on the page — make it look like a real torn receipt.
4. **Peel-off sticker chips.** Category tags styled as stickers with slight rotation and a
   soft shadow; on hover they straighten and lift.
5. **Hand-drawn "SALE →" arrow accents** pointing at primary CTAs.

---

## Mascot (name TBD)

We have a mascot — a small, round, matte-**white** 3D character: smooth egg-shaped body,
two simple black dot eyes, a wide friendly smile, short stubby arms. Soft Pixar-style 3D,
matte finish. He's the face of the brand and appears throughout the product, not just the
hero. Asset files live in `/public/mascot/`.

**On-model rules (keep him *him*):**
- Eyes are always two plain black dots; mouth is a simple smile. **No** toothy open grins,
  no detailed/winking faces, no eyebrows.
- Arms stay short and stubby with simple mitten hands — never long or detailed.
- Pure matte white body. Color comes from what he holds (a brand-colored map pin), never
  from recoloring him.
- When in doubt, simpler is more on-model.

**Pose → screen mapping** (each pose is its own cut-out asset):
| Pose | Where it goes |
|---|---|
| Waving / riding the loot-piled car | Landing hero (`hero.png`) |
| Standing, neutral | Headers, about, general |
| Shrugging, empty hands | **Empty states** ("No sales here yet — be the first to list one") |
| Holding a map pin | Logo lockup / loading |
| Peeking from an edge | Tooltips, "coming soon," onboarding nudges |
| Face-plant on a map | **404 / error page** ("Looks like we lost the map") |
| Celebrating, arms up | Success (listing published, payment complete) |

Use him to give personality to the moments generic apps leave blank — empty, loading, and
error screens are where he earns his keep.

---

## Motion

- **One orchestrated set-piece** (the hero going live) + tasteful micro-interactions:
  buttons press down, sticker chips wobble/straighten on hover, pins drop in with a small
  bounce, verdict chips pop.
- Do **not** scatter identical fade-in-on-scroll across every block — that reads AI-
  generated.
- Respect `prefers-reduced-motion` (disable non-essential motion).

---

## Layout moves

- Don't center everything. Use asymmetry: off-grid hero, content that hangs into the
  margin, a pin or sticker overlapping a card's edge.
- Alternate section rhythm: white → bold color block → tint → white. Never ten identical
  white sections stacked.
- Mobile-first; every signature survives down to a phone. This is used in a car on a
  Saturday.

---

## Per-component quick specs

- **Buttons (primary):** ink or pink fill, white text, `--r-md`, weight 700, press-down on
  click, generous padding (14×24). Secondary: outline or tint fill.
- **Hero:** full-bleed mascot **illustration** (`/public/mascot/hero.png`, the render of
  the mascot riding a loot-piled car past yard sales, matte map-pins floating in the sky)
  as the background. Over it, left-aligned: a live "N sales open right now" pill (pulsing
  green dot, mono number), the oversized display headline, a one-line subhead, and two CTAs
  ("Find sales near me" primary / "List a sale · $5" secondary). A soft warm-white scrim on
  the left keeps text legible over any render. Build exactly like `hero-frame.html`. Ship a
  taller-crop image for mobile. **Not** a centered headline + generic stat trio, and **not**
  a flat-color hero — the illustration is the hero.
- **Pins:** tag-shaped SVG, status color, live gets a pulsing halo + a "●" or count.
- **Route card:** receipt/ticket styling, mono numbers, colored verdict chip.
- **Category chip:** sticker look, category color from the palette, slight rotation.

---

## Quality floor (build to it silently)

Responsive to mobile · visible keyboard focus · reduced-motion respected · real empty/
loading/error states written in the interface's voice ("No sales here yet — be the first
to list one," not a spinner alone).

---

## Where the current site most likely falls short — fix in this order

1. **Rebuild the hero around the mascot illustration** (see `hero-frame.html`) with the
   oversized headline pushed to the clamp scale. The illustration + big type is the single
   biggest "fun and modern" jump.
2. **Not enough color commitment** below the hero. Add the two bold color-blocked sections.
3. **Default components.** Replace generic cards/pins with the tag pins + receipt route
   cards + sticker chips.
4. **No motion set-piece.** Add the one hero "go live" moment.
