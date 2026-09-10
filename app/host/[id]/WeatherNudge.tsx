"use client";

import { useState, useTransition } from "react";

import { Nub } from "@/components/Nub";
import { formatSaleDay } from "@/lib/sale-time";
import { describeOutlook, type WeatherNudge as Nudge } from "@/lib/weather";
import { keepTheDate, rescheduleTo } from "./actions";

/**
 * "It's going to rain on your sale. Move it?"
 *
 * The brief (CLAUDE.md §6) asks for a one-tap reschedule a day or two out, and
 * the tap is the whole point — a host who has to open the edit form, find the
 * date field and re-save is a host who doesn't bother.
 *
 * It shows its evidence. "80% chance, 4mm" lets a host who knows their own sky
 * overrule us, which is the difference between a useful nudge and a nag.
 *
 * Tangerine, not pink: this is the "something needs your attention" colour the
 * draft banner already uses on this page, and it isn't an error.
 */
export function WeatherNudge({ saleId, nudge }: { saleId: string; nudge: Nudge }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /**
   * There is deliberately no success state here.
   *
   * There used to be — a green "Moved to Sunday" panel — and clicking the
   * button in a real browser showed it was unreachable. Both actions
   * revalidate this page, the server re-renders, and the new date is dry by
   * definition (dry days are the only ones offered), so `nudge` comes back null
   * and the parent stops rendering this component before any message could be
   * read. "Keep the date" unmounts it the same way.
   *
   * What the host actually sees is the card vanishing and the date at the top
   * of the page changing, which is honest feedback. Only failures need to be
   * held on screen, because a failure leaves the card mounted.
   */
  const act = (run: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setError(null);
      const result = await run();
      if (!result.ok) setError(result.message ?? "That didn't work.");
    });

  return (
    <section className="mt-4 rounded-[22px] bg-tangerine-50 p-5">
      <div className="flex items-start gap-4">
        <Nub pose="shrug" width={72} className="hidden w-[72px] shrink-0 sm:block" decorative />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold text-tangerine-ink">
            Rain on {formatSaleDay(nudge.current.date)}
          </h2>
          <p className="mt-1 font-mono text-sm text-tangerine-ink">
            {describeOutlook(nudge.current)} during your hours
          </p>

          {nudge.alternatives.length > 0 ? (
            <>
              {/* The rain-check credit, said plainly. CLAUDE.md §6 offers hosts
                  "a free relist rather than a cash refund" — and because the $5
                  buys a sale that never expires, this is that, with nothing to
                  redeem. */}
              <p className="mt-3 text-sm text-ink-soft">
                Moving it is free &mdash; the $5 buys the sale, not the date.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {nudge.alternatives.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      act(() => rescheduleTo(saleId, day.date))
                    }
                    className="inline-flex min-h-11 flex-col items-start justify-center rounded-[10px] bg-ink px-4 py-1.5 text-left text-canvas hover:opacity-90 disabled:opacity-60"
                  >
                    <span className="text-sm font-semibold">
                      Move to {formatSaleDay(day.date)}
                    </span>
                    <span className="font-mono text-[11px] opacity-80">{day.chance}% rain</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            // Singapore in the wet season, or a week of storms. Saying "no
            // drier day this week" is more use than an empty row of buttons.
            <p className="mt-3 text-sm text-ink-soft">
              Nothing drier in the next week. You can move it to any future date from{" "}
              <span className="font-semibold">Edit</span> &mdash; it&rsquo;s free, and the listing
              never expires.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => keepTheDate(saleId))}
              className="text-sm font-semibold text-tangerine-ink underline underline-offset-4 hover:text-ink disabled:opacity-60"
            >
              Keep the date
            </button>
            {pending && <span className="font-mono text-[13px] text-muted">Working…</span>}
          </div>

          {error && (
            <p className="mt-3 rounded-[10px] bg-pink-50 px-3.5 py-2.5 text-sm text-pink-ink" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
