"use client";

import { useState, useTransition } from "react";

import { DISCOUNT_TIERS, effectivePrice, formatMoney } from "@/lib/pricing";
import { addItem, deleteItem, setDiscount, updateItem } from "./actions";

type Item = {
  id: string;
  name: string;
  price: number;
  item_discount_percent: number;
  exclude_from_bulk: boolean;
  is_sold: boolean;
};

export function FeaturedItems({
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
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok && r.message) setError(r.message);
    });
  };

  return (
    <div>
      {/* ---- sale-wide discount ------------------------------------------ */}
      <div className="rounded-[16px] border border-hair p-4">
        <p className="text-sm font-semibold">Drop every price at once</p>
        <p className="mt-1 text-sm text-ink-soft">
          Applies to everything except items you&rsquo;ve locked.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DISCOUNT_TIERS.map((pct) => {
            const on = discountActive && discountPercent === pct;
            return (
              <button
                key={pct}
                type="button"
                disabled={pending}
                onClick={() => run(() => setDiscount(saleId, on ? 0 : pct))}
                aria-pressed={on}
                className={`inline-flex min-h-11 items-center rounded-[10px] border px-4 font-mono text-sm font-bold disabled:opacity-60 ${
                  on
                    ? "border-pink bg-pink text-white"
                    : "border-hair bg-panel hover:border-pink hover:text-pink-ink"
                }`}
              >
                {pct}% off
              </button>
            );
          })}
          {discountActive && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setDiscount(saleId, 0))}
              className="inline-flex min-h-11 items-center rounded-[10px] border border-hair bg-panel px-4 text-sm font-semibold disabled:opacity-60"
            >
              Stop the sale
            </button>
          )}
        </div>
        {discountActive && (
          <p className="mt-3 rounded-[10px] bg-tangerine-50 px-3.5 py-2 font-mono text-sm font-bold text-tangerine-ink">
            {discountPercent}% OFF is showing on your pin
          </p>
        )}
      </div>

      {/* ---- add ---------------------------------------------------------- */}
      <form
        action={(fd) => run(() => addItem(saleId, fd))}
        className="mt-4 flex flex-wrap items-end gap-2"
      >
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="item-name" className="block text-sm font-semibold">
            Item
          </label>
          <input
            id="item-name"
            name="name"
            required
            maxLength={80}
            placeholder="Marantz receiver"
            className="mt-1.5 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 text-base outline-none placeholder:text-grey focus:border-pink"
          />
        </div>
        <div className="w-28">
          <label htmlFor="item-price" className="block text-sm font-semibold">
            Price
          </label>
          <input
            id="item-price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            required
            placeholder="25"
            className="mt-1.5 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 font-mono text-base outline-none placeholder:text-grey focus:border-pink"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-60"
        >
          Add
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-[10px] bg-pink-50 px-3.5 py-2.5 text-sm text-pink-ink" role="alert">
          {error}
        </p>
      )}

      {/* ---- the list ----------------------------------------------------- */}
      {items.length === 0 ? (
        <p className="mt-5 text-sm text-ink-soft">
          Nothing featured yet. Add your ten or twenty best things — it&rsquo;s a shop window,
          not an inventory.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {items.map((item) => {
            const now = effectivePrice(
              item.price,
              item.item_discount_percent,
              discountPercent,
              discountActive,
              item.exclude_from_bulk,
            );
            const cut = now < item.price;

            return (
              <li
                key={item.id}
                className={`rounded-[16px] border p-4 ${
                  item.is_sold ? "border-hair bg-canvas opacity-60" : "border-hair bg-panel"
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className={`font-display text-lg font-bold ${item.is_sold ? "line-through" : ""}`}
                  >
                    {item.name}
                  </span>
                  <span className="font-mono text-lg font-bold">{formatMoney(now)}</span>
                  {cut && (
                    <span className="font-mono text-sm text-muted line-through">
                      {formatMoney(item.price)}
                    </span>
                  )}
                  {item.is_sold && (
                    <span className="rounded-full bg-grey/20 px-2.5 py-0.5 font-mono text-xs font-bold text-grey-ink">
                      SOLD
                    </span>
                  )}
                  {item.exclude_from_bulk && !item.is_sold && (
                    <span className="rounded-full bg-violet-50 px-2.5 py-0.5 font-mono text-xs font-bold text-violet-ink">
                      LOCKED
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => updateItem(saleId, item.id, { is_sold: !item.is_sold }))}
                    className="inline-flex min-h-11 items-center rounded-[10px] border border-hair px-3.5 text-sm font-semibold hover:border-green disabled:opacity-60"
                  >
                    {item.is_sold ? "Not sold after all" : "Mark sold"}
                  </button>

                  {!item.is_sold && (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            updateItem(saleId, item.id, {
                              item_discount_percent: Math.min(
                                95,
                                item.item_discount_percent + 25,
                              ),
                            }),
                          )
                        }
                        className="inline-flex min-h-11 items-center rounded-[10px] border border-hair px-3.5 text-sm font-semibold hover:border-pink disabled:opacity-60"
                      >
                        Drop 25%
                      </button>

                      {item.item_discount_percent > 0 && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(() => updateItem(saleId, item.id, { item_discount_percent: 0 }))
                          }
                          className="inline-flex min-h-11 items-center rounded-[10px] border border-hair px-3.5 text-sm font-semibold disabled:opacity-60"
                        >
                          Full price
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            updateItem(saleId, item.id, {
                              exclude_from_bulk: !item.exclude_from_bulk,
                            }),
                          )
                        }
                        aria-pressed={item.exclude_from_bulk}
                        className="inline-flex min-h-11 items-center rounded-[10px] border border-hair px-3.5 text-sm font-semibold hover:border-violet disabled:opacity-60"
                        title="Keep this out of sale-wide discounts"
                      >
                        {item.exclude_from_bulk ? "Unlock" : "Lock price"}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteItem(saleId, item.id))}
                    className="ml-auto inline-flex min-h-11 items-center rounded-[10px] px-3 text-sm font-semibold text-muted hover:text-pink-ink disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
