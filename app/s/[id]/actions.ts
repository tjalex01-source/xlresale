"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type SaveResult = { ok: true; saved: boolean } | { ok: false; message: string };

/**
 * Add or remove this sale from the shopper's saved list.
 *
 * A saved sale is a row in `sale_watchers`, which is the same table the host's
 * "N shoppers have you saved" panel counts. That is deliberate: saving is the
 * only signal a host gets that anyone is coming, so it has to be the one thing
 * a shopper does, not a separate private bookmark.
 *
 * `upsert` rather than `insert` because the button can be double-tapped on a
 * slow phone connection, and the primary key is (sale_id, shopper_id) — a
 * second insert would throw a duplicate-key error at someone who did nothing
 * wrong.
 */
export async function setSaved(saleId: string, saved: boolean): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "Sign in to save a sale." };

  if (saved) {
    const { error } = await supabase
      .from("sale_watchers")
      .upsert({ sale_id: saleId, shopper_id: user.id }, { onConflict: "sale_id,shopper_id" });
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await supabase
      .from("sale_watchers")
      .delete()
      .eq("sale_id", saleId)
      .eq("shopper_id", user.id);
    if (error) return { ok: false, message: error.message };
  }

  // Both the sale page (button state) and the dashboard (the list itself) show
  // this, and the host's watcher count reads the same rows.
  revalidatePath(`/s/${saleId}`);
  revalidatePath("/shop");

  return { ok: true, saved };
}
