"use client";

import { useState, useTransition } from "react";

import type { SaleStatus } from "@/lib/database.types";
import { setSaleStatus, setDiscount } from "./actions";

/**
 * The Go Live control, following reference/host-dashboard.html.
 *
 * The lifecycle is the product's whole promise: this is the button that turns a
 * pin green on every nearby shopper's map. Copy comes from the reference so the
 * host reads the same words the prototype promised.
 */
const STATES: Record<
  SaleStatus,
  {
    label: string;
    head: string;
    sub: string;
    pulse: boolean;
    tint: string;
    ink: string;
    actions: { label: string; to: SaleStatus; primary?: boolean; halfOff?: boolean }[];
  }
> = {
  scheduled: {
    label: "Scheduled",
    head: "You're set for Saturday morning",
    sub: "Roll up the garage door and tap Go live. Nearby shoppers get pinged and your pin starts pulsing green.",
    pulse: false,
    tint: "var(--color-pink-50)",
    ink: "var(--color-pink-ink)",
    actions: [{ label: "Go live now", to: "live", primary: true }],
  },
  live: {
    label: "Live · open now",
    head: "You're open — your pin is pulsing green",
    sub: "Shoppers nearby can see you're open right now.",
    pulse: true,
    tint: "var(--color-green-50)",
    ink: "var(--color-green-ink)",
    actions: [
      { label: "Winding down", to: "winding_down" },
      { label: "End sale", to: "closed" },
    ],
  },
  winding_down: {
    label: "Winding down · last call",
    head: "Last call — clear it out",
    sub: "Good moment to drop prices. Shoppers see “closing soon, make offers.”",
    pulse: true,
    tint: "var(--color-tangerine-50)",
    ink: "var(--color-tangerine-ink)",
    actions: [
      { label: "Take it ½ off", to: "winding_down", primary: true, halfOff: true },
      { label: "Back to open", to: "live" },
      { label: "End sale", to: "closed" },
    ],
  },
  closed: {
    label: "Closed for today",
    head: "That's a wrap",
    sub: "Your pin greys out. Your items and photos are kept, so listing again is quick.",
    pulse: false,
    tint: "#EFECF2",
    ink: "var(--color-grey-ink)",
    actions: [{ label: "Reopen", to: "live", primary: true }],
  },
};

export function GoLiveCard({
  saleId,
  status,
  watcherCount,
}: {
  saleId: string;
  status: SaleStatus;
  watcherCount: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const state = STATES[status];

  function go(to: SaleStatus, halfOff?: boolean) {
    setError(null);
    start(async () => {
      // "Take it ½ off" is one tap for the host but two changes: the sale-wide
      // discount and the winding-down status.
      if (halfOff) {
        const d = await setDiscount(saleId, 50);
        if (!d.ok) return setError(d.message);
      }
      const r = await setSaleStatus(saleId, to);
      if (!r.ok) setError(r.message);
    });
  }

  return (
    <section
      className="rounded-[22px] p-6 shadow-card"
      style={{ backgroundColor: state.tint, color: state.ink }}
    >
      <p className="flex items-center gap-2.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em]">
        <span
          aria-hidden
          className={`size-2.5 rounded-full ${state.pulse ? "ping relative" : ""}`}
          style={{ backgroundColor: "currentColor", color: state.ink }}
        />
        {state.label}
      </p>

      <h2 className="mt-3 font-display text-[clamp(1.5rem,3.5vw,2rem)] font-extrabold leading-tight tracking-[-0.02em] text-ink">
        {state.head}
      </h2>
      <p className="mt-2 max-w-prose text-ink-soft">{state.sub}</p>

      {(status === "live" || status === "winding_down") && (
        <p className="mt-4 rounded-[10px] bg-panel px-4 py-3 text-sm">
          {watcherCount > 0 ? (
            <>
              <span className="font-mono font-bold">{watcherCount}</span>{" "}
              {watcherCount === 1 ? "shopper has" : "shoppers have"} you saved.
            </>
          ) : (
            <span className="text-muted">Nobody has saved your sale yet.</span>
          )}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2.5">
        {state.actions.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={pending}
            onClick={() => go(a.to, a.halfOff)}
            className={
              a.primary
                ? "inline-flex min-h-11 items-center rounded-[10px] bg-ink px-5 font-display text-lg font-bold text-canvas transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                : "inline-flex min-h-11 items-center rounded-[10px] border border-ink/20 bg-panel px-4 text-sm font-semibold text-ink hover:border-ink disabled:opacity-60"
            }
          >
            {a.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm font-semibold text-pink-ink" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
