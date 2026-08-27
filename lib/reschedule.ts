import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { formatSaleDay } from "@/lib/sale-time";

/**
 * Moving a sale's date — the policy, in one place.
 *
 * Two things move a date now: the full edit form, and the one-tap button on the
 * weather nudge. They must agree about the cap and about who gets told, because
 * a shopper who hears about a form edit but not about a weather move has been
 * let down by an implementation detail they can't see.
 *
 * CLAUDE.md §6: the $5 buys one sale that never expires and can move to any
 * future date. Nothing here touches `listing_paid`, and nothing here charges
 * for a move — that IS the brief's "rain-check credit", delivered by the
 * listing rather than by a separate credit to redeem.
 */

/** Generous, per CLAUDE.md §6 — a host rained out three weekends running is normal. */
export const MAX_RESCHEDULES = 10;

export const rescheduleCapMessage = `You've moved this sale ${MAX_RESCHEDULES} times. Get in touch and we'll sort it out.`;

/**
 * Queue a "this moved" notice for everyone who saved the sale.
 *
 * Queues only — the caller flushes. An edit can change the date and the address
 * at once, and each of those queues its own notice; sending inside here would
 * mean two sweeps for one save.
 */
export async function announceNewDate(
  supabase: SupabaseClient<Database>,
  saleId: string,
  newDate: string,
): Promise<number> {
  const { data: count } = await supabase.rpc("notify_sale_watchers", {
    in_sale_id: saleId,
    in_kind: "rescheduled",
    in_note: `now ${formatSaleDay(newDate)}`,
  });

  return typeof count === "number" ? count : 0;
}

/**
 * Deliver what's queued, now.
 *
 * Immediately rather than waiting for the nightly sweep: a date change is only
 * useful to somebody who hears about it before they set off.
 */
export async function flushAlerts(): Promise<void> {
  const { sendPendingAlerts } = await import("@/lib/notify");
  await sendPendingAlerts();
}

export const peopleTold = (count: number) =>
  `${count} ${count === 1 ? "person" : "people"} told about the new date`;
