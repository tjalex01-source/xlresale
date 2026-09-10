"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  MAX_RESCHEDULES,
  announceNewDate,
  flushAlerts,
  rescheduleCapMessage,
} from "@/lib/reschedule";
import type { SaleStatus } from "@/lib/database.types";

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Every action re-checks that the caller owns this sale. RLS enforces it too,
 * but a Server Action is its own entry point and the check is one query.
 */
async function ownedSale(saleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, owned: false };

  const { data } = await supabase
    .from("sales")
    .select("id")
    .eq("id", saleId)
    .eq("host_id", user.id)
    .maybeSingle();

  return { supabase, user, owned: !!data };
}

const ALLOWED: SaleStatus[] = ["scheduled", "live", "winding_down", "closed"];

/**
 * The Go Live lifecycle. Writing `status` is all that's needed — the trigger in
 * schema.sql stamps went_live_at the first time it becomes 'live', and Realtime
 * carries the change to every shopper's map without anything extra here.
 */
export async function setSaleStatus(saleId: string, status: SaleStatus): Promise<ActionResult> {
  if (!ALLOWED.includes(status)) return { ok: false, message: "Unknown status." };

  const { supabase, owned } = await ownedSale(saleId);
  if (!owned) return { ok: false, message: "That isn't your sale." };

  const { error } = await supabase.from("sales").update({ status }).eq("id", saleId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/host/${saleId}`);
  return { ok: true };
}

/** Sale-wide discount. `percent` 0 turns it off rather than setting a 0% sale. */
export async function setDiscount(saleId: string, percent: number): Promise<ActionResult> {
  if (!Number.isInteger(percent) || percent < 0 || percent > 95) {
    return { ok: false, message: "Pick a discount between 0 and 95%." };
  }

  const { supabase, owned } = await ownedSale(saleId);
  if (!owned) return { ok: false, message: "That isn't your sale." };

  const { error } = await supabase
    .from("sales")
    .update({ discount_percent: percent, discount_active: percent > 0 })
    .eq("id", saleId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/host/${saleId}`);
  return { ok: true };
}

export async function setFreePile(
  saleId: string,
  on: boolean,
  note: string,
): Promise<ActionResult> {
  const { supabase, owned } = await ownedSale(saleId);
  if (!owned) return { ok: false, message: "That isn't your sale." };

  const { error } = await supabase
    .from("sales")
    .update({ free_pile: on, free_pile_note: on && note.trim() ? note.trim() : null })
    .eq("id", saleId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/host/${saleId}`);
  return { ok: true };
}

export async function addItem(saleId: string, formData: FormData): Promise<ActionResult> {
  const { supabase, owned } = await ownedSale(saleId);
  if (!owned) return { ok: false, message: "That isn't your sale." };

  const name = String(formData.get("name") ?? "").trim();
  const price = Number(formData.get("price"));

  if (!name) return { ok: false, message: "Give the item a name." };
  if (!Number.isFinite(price) || price < 0) return { ok: false, message: "Enter a price." };

  const { count } = await supabase
    .from("sale_items")
    .select("*", { count: "exact", head: true })
    .eq("sale_id", saleId);

  // Featured items are a shop window, not an inventory — the brief is explicit
  // that hosts should never feel obliged to list everything.
  if ((count ?? 0) >= 20) {
    return { ok: false, message: "That's 20 featured items — plenty. Sell some first." };
  }

  const { error } = await supabase
    .from("sale_items")
    .insert({ sale_id: saleId, name, price, position: count ?? 0 });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/host/${saleId}`);
  return { ok: true };
}

/**
 * Mark a whole armful sold in one go — the end of a buyer tally.
 *
 * Takes FormData rather than a plain argument list, like every other action in
 * this app — one shape to remember, and the ids arrive as strings to be
 * validated rather than as a typed array that looks trustworthy and isn't.
 *
 * It does NOT gain a working no-JavaScript path from that, and it was wrong to
 * think so: the form only exists once the drawer is open, and opening it is a
 * click handler. Selecting items and seeing a running total is inherently
 * client-side, so there is no meaningful fallback to build here.
 *
 * One statement rather than a loop over updateItem: somebody is standing at the
 * table waiting, and six round trips on a phone signal in a driveway is the
 * difference between instant and awkward. `stamp_item_sold` in schema.sql sets
 * sold_at on the way through, so this doesn't need to.
 */
export async function markItemsSold(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const saleId = String(formData.get("sale_id") ?? "");
  const itemIds = formData.getAll("item_id").map(String);

  if (itemIds.length === 0) return { ok: true };
  if (itemIds.length > 50) return { ok: false, message: "That's a lot of items at once." };
  if (!itemIds.every((id) => /^[0-9a-f-]{36}$/.test(id))) {
    return { ok: false, message: "Something's wrong with that list." };
  }

  const { supabase, owned } = await ownedSale(saleId);
  if (!owned) return { ok: false, message: "That isn't your sale." };

  // `.eq("sale_id", saleId)` as well as the id list: the ids arrive from the
  // browser, and this is what stops a crafted list marking somebody else's
  // items sold. RLS would catch it too — this makes it not depend on that.
  const { error } = await supabase
    .from("sale_items")
    .update({ is_sold: true })
    .eq("sale_id", saleId)
    .in("id", itemIds);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/host/${saleId}`);
  revalidatePath(`/s/${saleId}`);
  return { ok: true };
}

export async function updateItem(
  saleId: string,
  itemId: string,
  patch: { is_sold?: boolean; item_discount_percent?: number; exclude_from_bulk?: boolean },
): Promise<ActionResult> {
  const { supabase, owned } = await ownedSale(saleId);
  if (!owned) return { ok: false, message: "That isn't your sale." };

  if (
    patch.item_discount_percent !== undefined &&
    (!Number.isInteger(patch.item_discount_percent) ||
      patch.item_discount_percent < 0 ||
      patch.item_discount_percent > 95)
  ) {
    return { ok: false, message: "Discount must be between 0 and 95%." };
  }

  const { error } = await supabase
    .from("sale_items")
    .update(patch)
    .eq("id", itemId)
    .eq("sale_id", saleId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/host/${saleId}`);
  return { ok: true };
}

export async function deleteItem(saleId: string, itemId: string): Promise<ActionResult> {
  const { supabase, owned } = await ownedSale(saleId);
  if (!owned) return { ok: false, message: "That isn't your sale." };

  const { error } = await supabase
    .from("sale_items")
    .delete()
    .eq("id", itemId)
    .eq("sale_id", saleId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/host/${saleId}`);
  return { ok: true };
}

export type HideResult = { ok: true; hidden: boolean; message: string } | { ok: false; message: string };

/**
 * Pull a sale off the map, or put it back.
 *
 * This is the takedown path a host needs when they feel unsafe mid-sale —
 * someone in that position should not have to wait for a human to answer an
 * email. It's instant and it's reversible.
 *
 * Visibility only: it never touches `listing_paid`, so a takedown is not a
 * refund and restoring it can't re-fire the wishlist alerts. All the
 * authorisation lives in set_sale_hidden() (schema-additions-takedown.sql),
 * including the rule that a host cannot undo an admin's takedown.
 */
export async function setSaleHidden(saleId: string, hidden: boolean): Promise<HideResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "You're signed out. Sign in and try again." };

  const { data, error } = await supabase.rpc("set_sale_hidden", {
    in_sale_id: saleId,
    in_hidden: hidden,
  });

  if (error) {
    console.error("set_sale_hidden failed:", error.message);
    return { ok: false, message: "Couldn't change that just now." };
  }

  switch (data) {
    case "hidden":
      return { ok: true, hidden: true, message: "Off the map. Nobody can find it now." };
    case "visible":
      return { ok: true, hidden: false, message: "Back on the map." };
    case "admin_locked":
      return {
        ok: false,
        message: "This sale was taken down by XLResale. Get in touch and we'll look at it.",
      };
    case "forbidden":
      return { ok: false, message: "That isn't your sale." };
    default:
      return { ok: false, message: "That sale no longer exists." };
  }
}

/**
 * Move the sale to a new date in one tap, from the weather nudge.
 *
 * The full edit form can do this too. This exists because the moment a host is
 * most willing to move a sale is the moment they're told it's going to rain on
 * it, and making them open a form and find the date field is enough friction to
 * lose them.
 *
 * Same policy as the form: the cap is a count, the move is free, and everyone
 * who saved the sale gets told (lib/reschedule.ts).
 */
export async function rescheduleTo(saleId: string, newDate: string): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return { ok: false, message: "That isn't a date." };
  if (newDate < new Date().toLocaleDateString("en-CA")) {
    return { ok: false, message: "That date has already been." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You're signed out." };

  // host_sales is scoped to auth.uid(), so reading the row IS the ownership check.
  const { data: sale } = await supabase
    .from("host_sales")
    .select("id, sale_date, reschedule_count")
    .eq("id", saleId)
    .maybeSingle();

  if (!sale) return { ok: false, message: "That sale isn't yours, or no longer exists." };
  if (sale.sale_date === newDate) return { ok: true };
  if (sale.reschedule_count >= MAX_RESCHEDULES) {
    return { ok: false, message: rescheduleCapMessage };
  }

  const { error } = await supabase
    .from("sales")
    .update({
      sale_date: newDate,
      reschedule_count: sale.reschedule_count + 1,
      // Clearing the guard by hand rather than leaving it to the date compare:
      // the host has now answered this question, and the next forecast should
      // be judged on its own merits.
      weather_nudged_for: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", saleId);

  if (error) {
    console.error("rescheduleTo failed:", error.message);
    return { ok: false, message: "Couldn't move it just now." };
  }

  const told = await announceNewDate(supabase, saleId, newDate);
  if (told > 0) await flushAlerts();

  revalidatePath(`/host/${saleId}`);
  revalidatePath(`/s/${saleId}`);
  revalidatePath("/host");
  return { ok: true };
}

/**
 * "Keep the date." Silences the nudge for the date the sale is currently on,
 * without moving anything.
 *
 * Stamping the date rather than a boolean is what makes this self-resetting: if
 * the host later moves the sale for any other reason, `sale_date` no longer
 * matches and a fresh forecast for the new date can speak up again.
 */
export async function keepTheDate(saleId: string): Promise<ActionResult> {
  const { supabase, owned } = await ownedSale(saleId);
  if (!owned) return { ok: false, message: "That sale isn't yours." };

  const { data: sale } = await supabase
    .from("host_sales")
    .select("sale_date")
    .eq("id", saleId)
    .maybeSingle();
  if (!sale) return { ok: false, message: "That sale no longer exists." };

  const { error } = await supabase
    .from("sales")
    .update({ weather_nudged_for: sale.sale_date })
    .eq("id", saleId);

  if (error) return { ok: false, message: "Couldn't save that just now." };

  revalidatePath(`/host/${saleId}`);
  return { ok: true };
}
