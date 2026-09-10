"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import { effectivePrice, formatMoney } from "@/lib/pricing";
import { markItemsSold } from "./actions";
import type { ActionResult } from "./actions";

/**
 * Tally a buyer — the calculator from CLAUDE.md §6, and the last seller feature
 * the brief asks for ("delight, build last").
 *
 * Somebody is standing in the driveway with an armful. The host taps what
 * they're carrying, the current discounts apply themselves, and one more tap
 * marks the lot sold — which drops those items off the map and out of every
 * shopper's "still available" list.
 *
 * It is a PER-BUYER SCRATCHPAD and nothing else. CLAUDE.md §15 rules out cash
 * or day-total tracking in as many words: that's an accounting product with a
 * tax headache attached, and it is not this. Nothing here is persisted except
 * the items being marked sold — close the drawer and the tally is gone.
 */

type Item = {
  id: string;
  name: string;
  price: number;
  item_discount_percent: number;
  exclude_from_bulk: boolean;
  is_sold: boolean;
};

/** Something with no listing — the box of paperbacks under the table. */
type Loose = { key: number; label: string; amount: number };

export function TallyDrawer({
  saleId,
  items,
  discountPercent,
  discountActive,
}: {
  saleId: string;
  items: Item[];
  discountPercent: number;
  discountActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loose, setLoose] = useState<Loose[]>([]);
  const [looseLabel, setLooseLabel] = useState("");
  const [looseAmount, setLooseAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [result, submit, pending] = useActionState<ActionResult | null, FormData>(
    markItemsSold,
    null,
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const available = items.filter((i) => !i.is_sold);

  // Escape closes it. Somebody mid-transaction should never have to hunt for
  // the way out of a panel they opened by accident.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const priceOf = (item: Item) =>
    effectivePrice(
      item.price,
      item.item_discount_percent,
      discountPercent,
      discountActive,
      item.exclude_from_bulk,
    );

  const chosen = available.filter((i) => picked.has(i.id));

  // Sticker total vs what they actually pay. The gap is shown rather than
  // folded in, so a host can see the discount doing its job — and so can the
  // buyer, leaning over the table.
  const sticker = chosen.reduce((sum, i) => sum + i.price, 0) + loose.reduce((s, l) => s + l.amount, 0);
  const owed = chosen.reduce((sum, i) => sum + priceOf(i), 0) + loose.reduce((s, l) => s + l.amount, 0);
  const saved = Math.round((sticker - owed) * 100) / 100;

  function addLoose() {
    const amount = Number(looseAmount.replace(/^\$/, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Type an amount.");
      return;
    }
    setError(null);
    setLoose((prev) => [
      ...prev,
      { key: Date.now(), label: looseLabel.trim() || "Something else", amount },
    ]);
    setLooseLabel("");
    setLooseAmount("");
  }

  function clearAll() {
    setPicked(new Set());
    setLoose([]);
    setError(null);
  }

  // Clear and close once the server confirms, not when the tap lands — a host
  // who sees the drawer shut has been told the items are marked sold, and that
  // should only be said when it's true. Adjust-state-on-a-changed-result rather
  // than an effect, so it happens in the same render.
  const [seenResult, setSeenResult] = useState<ActionResult | null>(null);
  if (result !== seenResult) {
    setSeenResult(result);
    if (result?.ok) {
      clearAll();
      setOpen(false);
    }
  }

  return (
    <>
      {/* Above the nav bar, not on top of it: AppNav is fixed to the bottom on
          a phone, and a floating button landing on "Sell" would be a trap. It
          moves down at `sm`, where that bar becomes a top bar.
          The offset goes through a CSS variable rather than `style={{ bottom }}`
          because an inline style beats every class — `sm:bottom-6` would have
          been silently dead. Nub.tsx carries the same warning about widths. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-5 z-30 inline-flex min-h-14 items-center gap-2 rounded-full bg-ink px-5 font-display text-base font-bold text-canvas shadow-float transition-transform hover:-translate-y-0.5 bottom-[var(--fab-bottom)] sm:bottom-6"
        style={{ "--fab-bottom": "calc(env(safe-area-inset-bottom) + 76px)" } as React.CSSProperties}
      >
        <CalculatorIcon />
        Tally a buyer
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-[22px] bg-canvas shadow-float outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[26rem] sm:max-h-none sm:rounded-l-[22px] sm:rounded-tr-none"
          >
            <div className="flex items-center gap-3 border-b border-hair px-5 py-4">
              <h2 id={titleId} className="font-display text-xl font-bold">
                Tally a buyer
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="ml-auto grid size-11 place-items-center rounded-[10px] text-muted hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted">
                Tap what they&rsquo;re buying
              </p>

              {available.length === 0 ? (
                <p className="mt-3 text-sm text-ink-soft">
                  Nothing featured and unsold. You can still add loose items below.
                </p>
              ) : (
                <ul className="mt-3">
                  {available.map((item) => {
                    const now = priceOf(item);
                    const cut = now < item.price;
                    const on = picked.has(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggle(item.id)}
                          aria-pressed={on}
                          className="flex w-full items-center gap-3 border-b border-hair py-3 text-left"
                        >
                          <span
                            aria-hidden
                            className={`grid size-6 shrink-0 place-items-center rounded-[7px] border-2 text-sm font-bold ${
                              on ? "border-pink bg-pink text-white" : "border-hair"
                            }`}
                          >
                            {on ? "✓" : ""}
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-semibold">
                            {item.name}
                            {item.exclude_from_bulk && (
                              <span className="ml-1.5 font-mono text-[11px] text-muted">locked</span>
                            )}
                          </span>
                          <span className="shrink-0 font-mono text-sm font-bold">
                            {cut && (
                              <span className="mr-1.5 text-[11.5px] text-muted line-through">
                                {formatMoney(item.price)}
                              </span>
                            )}
                            {formatMoney(now)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Loose entries. CLAUDE.md §6 says "featured items (+ loose
                  entries)" — most of what leaves a driveway was never listed. */}
              <p className="mt-6 font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted">
                Anything else
              </p>

              {loose.length > 0 && (
                <ul className="mt-2">
                  {loose.map((entry) => (
                    <li
                      key={entry.key}
                      className="flex items-center gap-3 border-b border-hair py-2.5"
                    >
                      <span className="min-w-0 flex-1 text-sm font-semibold">{entry.label}</span>
                      <span className="font-mono text-sm font-bold">
                        {formatMoney(entry.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLoose((p) => p.filter((l) => l.key !== entry.key))}
                        aria-label={`Remove ${entry.label}`}
                        className="grid size-8 place-items-center rounded-[8px] text-muted hover:text-pink-ink"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor="loose-label" className="block text-[13px] font-semibold">
                    What is it
                  </label>
                  <input
                    id="loose-label"
                    value={looseLabel}
                    onChange={(e) => setLooseLabel(e.target.value)}
                    maxLength={40}
                    placeholder="Box of records"
                    className="mt-1 w-full rounded-[10px] border border-hair bg-panel px-3 py-2 text-base outline-none placeholder:text-grey focus:border-pink"
                  />
                </div>
                <div className="w-24">
                  {/* "Charging", not "price": a loose entry takes no discount —
                      see the note by the totals below. */}
                  <label htmlFor="loose-amount" className="block text-[13px] font-semibold">
                    Charging
                  </label>
                  <input
                    id="loose-amount"
                    value={looseAmount}
                    onChange={(e) => setLooseAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="$5"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLoose();
                      }
                    }}
                    className="mt-1 w-full rounded-[10px] border border-hair bg-panel px-3 py-2 font-mono text-base outline-none placeholder:text-grey focus:border-pink"
                  />
                </div>
                <button
                  type="button"
                  onClick={addLoose}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-[10px] border border-hair bg-panel px-3.5 text-sm font-semibold hover:border-pink hover:text-pink"
                >
                  Add
                </button>
              </div>
            </div>

            {/* ---- the total ------------------------------------------------ */}
            <div
              className="border-t border-hair bg-panel px-5 pt-4"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
            >
              {saved > 0 && (
                <>
                  <div className="flex items-baseline justify-between text-sm text-ink-soft">
                    <span>Sticker</span>
                    <span className="font-mono">{formatMoney(sticker)}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-sm text-green-ink">
                    <span>
                      {discountActive ? `Sale (${discountPercent}% off)` : "Discounts"}
                    </span>
                    <span className="font-mono font-bold">&minus;{formatMoney(saved)}</span>
                  </div>
                </>
              )}

              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-display text-lg font-bold">They owe</span>
                <span className="font-mono text-[2rem] font-bold leading-none">
                  {formatMoney(owed)}
                </span>
              </div>

              {(error || (result && !result.ok)) && (
                <p
                  className="mt-3 rounded-[10px] bg-pink-50 px-3.5 py-2.5 text-sm text-pink-ink"
                  role="alert"
                >
                  {error ?? (result && !result.ok ? result.message : null)}
                </p>
              )}

              <form action={submit} className="mt-4 flex flex-wrap gap-2">
                <input type="hidden" name="sale_id" value={saleId} />
                {[...picked].map((id) => (
                  <input key={id} type="hidden" name="item_id" value={id} />
                ))}

                <button
                  type="submit"
                  disabled={pending || (picked.size === 0 && loose.length === 0)}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-[12px] bg-ink px-4 font-display text-base font-bold text-canvas hover:opacity-90 disabled:opacity-40"
                >
                  {pending
                    ? "Marking sold…"
                    : picked.size > 0
                      ? `Mark ${picked.size} sold & clear`
                      : "Clear"}
                </button>
                {(picked.size > 0 || loose.length > 0) && (
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={pending}
                    className="inline-flex min-h-12 items-center rounded-[12px] border border-hair px-4 text-sm font-semibold hover:border-pink hover:text-pink disabled:opacity-60"
                  >
                    Start over
                  </button>
                )}
              </form>

              <p className="mt-3 text-[13px] text-muted">
                A scratchpad for one buyer &mdash; nothing is kept once it clears. Loose items are
                charged exactly as typed.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function CalculatorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="2.5" width="16" height="19" rx="3" />
      <path d="M8 7h8" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" />
    </svg>
  );
}
