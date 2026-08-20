"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { formatSaleDay } from "@/lib/sale-time";

export type EditState =
  | { status: "idle" }
  | { status: "error"; message: string; field?: string }
  | { status: "saved"; message: string };

/** Generous, per CLAUDE.md §6 — a host rained out three weekends running is normal. */
const MAX_RESCHEDULES = 10;

/** Past this, it's somewhere else rather than a better geocode of the same driveway. */
const SIGNIFICANT_MOVE_MILES = 0.25;

const isTime = (v: string) => /^\d{2}:\d{2}$/.test(v);

/**
 * Edit a sale after it's been created.
 *
 * Two of these fields are not like the others. Changing the DATE or moving the
 * ADDRESS meaningfully invalidates what everyone who saved it already believes,
 * so both re-alert those shoppers through the same queue the wishlist matches
 * use (CLAUDE.md §6: "reusing the wishlist-alert plumbing").
 *
 * Nothing here touches listing_paid. Moving a sale is free and the listing
 * never expires — the abuse guard is a count, not an expiry.
 */
export async function updateSale(_prev: EditState | null, formData: FormData): Promise<EditState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "You're signed out. Sign in and try again." };

  const saleId = String(formData.get("sale_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const saleDate = String(formData.get("sale_date") ?? "");
  const opensAt = String(formData.get("opens_at") ?? "");
  const closesAt = String(formData.get("closes_at") ?? "");
  const freePile = formData.get("free_pile") === "on";
  const freePileNote = String(formData.get("free_pile_note") ?? "").trim();

  // Address is optional on edit: leaving the picker untouched means "keep it".
  const address = String(formData.get("address") ?? "").trim();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const hasNewAddress = Boolean(address) && Number.isFinite(lat) && Number.isFinite(lng);

  if (!title) return { status: "error", message: "Give your sale a title.", field: "title" };
  if (title.length > 120) return { status: "error", message: "That title is too long.", field: "title" };
  if (!saleDate) return { status: "error", message: "Pick the date.", field: "sale_date" };
  if (saleDate < new Date().toISOString().slice(0, 10)) {
    return { status: "error", message: "Pick today or a future date.", field: "sale_date" };
  }
  if (!isTime(opensAt) || !isTime(closesAt)) {
    return { status: "error", message: "Set your opening and closing times.", field: "opens_at" };
  }
  if (closesAt <= opensAt) {
    return { status: "error", message: "Closing time needs to be after opening time.", field: "closes_at" };
  }
  if (address && !hasNewAddress) {
    return {
      status: "error",
      message: "Pick the new address from the suggestions so we can move the pin.",
      field: "address",
    };
  }

  // host_sales is already scoped to auth.uid(), so finding the row IS the
  // ownership check.
  const { data: current } = await supabase
    .from("host_sales")
    .select("id, sale_date, reschedule_count, title")
    .eq("id", saleId)
    .maybeSingle();

  if (!current) return { status: "error", message: "That sale isn't yours, or no longer exists." };

  const dateChanged = current.sale_date !== saleDate;

  if (dateChanged && current.reschedule_count >= MAX_RESCHEDULES) {
    return {
      status: "error",
      message: `You've moved this sale ${MAX_RESCHEDULES} times. Get in touch and we'll sort it out.`,
      field: "sale_date",
    };
  }

  // Measured before the update, while the old point is still in the row.
  let movedMiles = 0;
  if (hasNewAddress) {
    const { data } = await supabase.rpc("sale_move_miles", {
      in_sale_id: saleId,
      in_lat: lat,
      in_lng: lng,
    });
    movedMiles = data ?? 0;
  }

  const { error } = await supabase
    .from("sales")
    .update({
      title,
      description: description || null,
      sale_date: saleDate,
      opens_at: opensAt,
      closes_at: closesAt,
      free_pile: freePile,
      free_pile_note: freePile && freePileNote ? freePileNote : null,
      reschedule_count: dateChanged ? current.reschedule_count + 1 : current.reschedule_count,
      // lng first — PostGIS takes x,y. Reversed, the sale lands in the wrong place.
      ...(hasNewAddress
        ? { address, location: `SRID=4326;POINT(${lng} ${lat})` }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", saleId);

  if (error) {
    console.error("updateSale failed:", error.message);
    return { status: "error", message: "Couldn't save that just now." };
  }

  const categoryIds = formData
    .getAll("category_ids")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n));

  // Replace rather than diff — the set is small and a wrong diff is worse than
  // two cheap statements.
  await supabase.from("sale_categories").delete().eq("sale_id", saleId);
  if (categoryIds.length) {
    await supabase
      .from("sale_categories")
      .insert(categoryIds.map((category_id) => ({ sale_id: saleId, category_id })));
  }

  // --- re-alert the people who saved it ---
  const notices: string[] = [];

  if (dateChanged) {
    const { data: count } = await supabase.rpc("notify_sale_watchers", {
      in_sale_id: saleId,
      in_kind: "rescheduled",
      in_note: `now ${formatSaleDay(saleDate)}`,
    });
    if (typeof count === "number" && count > 0) {
      notices.push(`${count} ${count === 1 ? "person" : "people"} told about the new date`);
    }
  }

  if (movedMiles > SIGNIFICANT_MOVE_MILES) {
    const { data: count } = await supabase.rpc("notify_sale_watchers", {
      in_sale_id: saleId,
      in_kind: "moved",
      in_note: `now at ${address}`,
    });
    if (typeof count === "number" && count > 0) {
      notices.push(`${count} ${count === 1 ? "person" : "people"} told about the new address`);
    }
  }

  // Send immediately rather than waiting for the nightly sweep — a date change
  // is only useful to someone who hears about it before they set off.
  if (notices.length) {
    const { sendPendingAlerts } = await import("@/lib/notify");
    await sendPendingAlerts();
  }

  revalidatePath(`/host/${saleId}`);
  revalidatePath(`/s/${saleId}`);
  revalidatePath("/host");

  return {
    status: "saved",
    message: notices.length ? `Saved. ${notices.join(", ")}.` : "Saved.",
  };
}
