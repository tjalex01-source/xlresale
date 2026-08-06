import type { SaleStatus } from "@/lib/database.types";

/**
 * The single translation point between the `sale_status` enum and how a sale
 * reads on screen.
 *
 * design-reference.html uses its own names — `open` / `soon` — which do NOT
 * match the database. The mapping lives here and nowhere else, so the prototype
 * naming never leaks into components:
 *
 *   scheduled    → prototype "open"    (pink)
 *   live         → prototype "live"    (green, pulses)
 *   winding_down → prototype "soon"    (gold)
 *   closed       → prototype "closed"  (grey)
 */
export interface SaleStatusMeta {
  /** Plain, active label shown to shoppers. */
  label: string;
  /** Pin and chip color. */
  color: string;
  /** Soft background for chips. */
  tint: string;
  /** Only the live pin animates — and only if the user allows motion. */
  pulse: boolean;
}

export const SALE_STATUS_META: Record<SaleStatus, SaleStatusMeta> = {
  scheduled: {
    label: "Open today",
    color: "var(--color-sale)",
    tint: "var(--color-sale-tint)",
    pulse: false,
  },
  live: {
    label: "Open now",
    color: "var(--color-live)",
    tint: "var(--color-live-tint)",
    pulse: true,
  },
  winding_down: {
    label: "Closing soon",
    color: "var(--color-gold)",
    tint: "var(--color-gold-tint)",
    pulse: false,
  },
  closed: {
    label: "Wrapped up",
    color: "var(--color-asphalt)",
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
