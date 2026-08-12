"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
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
