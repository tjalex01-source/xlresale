import type { SaleStatus } from "@/lib/database.types";

/**
 * The single translation point between the `sale_status` enum and how a sale
 * reads on screen. Colors come from DESIGN.md.
 *
 * design-reference.html uses its own names — `open` / `soon` — which do NOT
 * match the database. The mapping lives here and nowhere else, so the prototype
 * naming never leaks into components:
 *
 *   scheduled    → prototype "open"    (pink)
 *   live         → prototype "live"    (green, pulses)
 *   winding_down → prototype "soon"    (tangerine)
 *   closed       → prototype "closed"  (grey)
 */
export interface SaleStatusMeta {
  /** Plain, active label shown to shoppers. */
  label: string;
  /** What the status means, in the interface's voice. */
  detail: string;
  /** Pin, dot, and fill color. Calibrated against the canvas background. */
  color: string;
  /**
   * The same color as a literal hex.
   *
   * Google Maps marker icons are data-URI SVGs rendered outside the document,
   * where `var(--color-green)` resolves to nothing and the pin comes out black.
   * Keep this in step with the token in globals.css.
   */
  hex: string;
  /**
   * Text color for anything sitting on `tint`. The brand color only reaches
   * ~2.5:1 on its own tint, so never use it for small text — use this instead.
   */
  textColor: string;
  /** Soft background for chips and tags. */
  tint: string;
  /** Only the live pin animates — and only if the user allows motion. */
  pulse: boolean;
}

export const SALE_STATUS_META: Record<SaleStatus, SaleStatusMeta> = {
  scheduled: {
    label: "Open today",
    detail: "Listed, not started yet.",
    color: "var(--color-pink)",
    hex: "#ff2e63",
    textColor: "var(--color-pink-ink)",
    tint: "var(--color-pink-50)",
    pulse: false,
  },
  live: {
    label: "Open now",
    detail: "Host is out there. Go.",
    color: "var(--color-green)",
    hex: "#12b76a",
    textColor: "var(--color-green-ink)",
    tint: "var(--color-green-50)",
    pulse: true,
  },
  winding_down: {
    label: "Closing soon",
    detail: "Last call — make an offer.",
    color: "var(--color-tangerine)",
    hex: "#ff9f1c",
    textColor: "var(--color-tangerine-ink)",
    tint: "var(--color-tangerine-50)",
    pulse: false,
  },
  closed: {
    label: "Wrapped up",
    detail: "Done for the day.",
    color: "var(--color-grey)",
    hex: "#8a8398",
    textColor: "var(--color-grey-ink)",
    tint: "#EFECF2",
    pulse: false,
  },
};

/** Lifecycle order — the sequence a host advances through. */
export const SALE_STATUS_ORDER: SaleStatus[] = [
  "scheduled",
  "live",
  "winding_down",
  "closed",
];
