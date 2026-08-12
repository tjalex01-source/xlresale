"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type SaleDraftState =
  | { status: "idle" }
  | { status: "error"; message: string; field?: string };

/** Same 20-minute grain the route planner works in. */
function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

/**
 * Creates the sale as an UNPAID draft. It stays off the public map until the
 * Stripe webhook flips listing_paid (CLAUDE.md §8) — this action must never set
 * that itself, and RLS wouldn't let it anyway.
 */
export async function createSaleDraft(
  _prev: SaleDraftState,
  formData: FormData,
): Promise<SaleDraftState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/host/new");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const saleDate = String(formData.get("sale_date") ?? "");
  const opensAt = String(formData.get("opens_at") ?? "");
  const closesAt = String(formData.get("closes_at") ?? "");
  const timeZone = String(formData.get("time_zone") ?? "").trim() || "America/Chicago";
  const freePile = formData.get("free_pile") === "on";
  const freePileNote = String(formData.get("free_pile_note") ?? "").trim();
  const categoryIds = formData
    .getAll("category_ids")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n));

  if (!title) return { status: "error", message: "Give your sale a title.", field: "title" };
  if (title.length > 120) return { status: "error", message: "That title is too long.", field: "title" };

  if (!address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      status: "error",
      message: "Pick your address from the suggestions so we can put it on the map.",
      field: "address",
    };
  }

  if (!saleDate) return { status: "error", message: "Pick the date.", field: "sale_date" };
  // Compared as plain dates: a sale is a calendar day, and today still counts.
  if (saleDate < new Date().toISOString().slice(0, 10)) {
    return { status: "error", message: "Pick today or a future date.", field: "sale_date" };
  }

  if (!isTime(opensAt) || !isTime(closesAt)) {
    return { status: "error", message: "Set your opening and closing times.", field: "opens_at" };
  }
  if (closesAt <= opensAt) {
    return {
      status: "error",
      message: "Closing time needs to be after opening time.",
      field: "closes_at",
    };
  }

  const { data: sale, error } = await supabase
    .from("sales")
    .insert({
      host_id: user.id,
      title,
      description: description || null,
      address,
      // PostGIS wants lng first. Getting this backwards puts sales in the wrong
      // hemisphere, and it looks plausible until you open the map.
      location: `SRID=4326;POINT(${lng} ${lat})`,
      sale_date: saleDate,
      opens_at: opensAt,
      closes_at: closesAt,
      time_zone: timeZone,
      free_pile: freePile,
      free_pile_note: freePile && freePileNote ? freePileNote : null,
    })
    .select("id")
    .single();

  if (error || !sale) {
    return { status: "error", message: error?.message ?? "Couldn't save that. Try again." };
  }

  if (categoryIds.length > 0) {
    await supabase
      .from("sale_categories")
      .insert(categoryIds.map((category_id) => ({ sale_id: sale.id, category_id })));
  }

  redirect(`/host/${sale.id}`);
}
