import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { ChipCategory } from "@/components/CategoryChips";

/**
 * The categories on a set of sales, keyed by sale id.
 *
 * One round trip for a whole list rather than one per row. It's a separate
 * query rather than part of `sales_near_me()` on purpose: that function's return
 * type is pinned by a migration, and a list of tags doesn't fit a flat row
 * without either an array column or a second migration every time this changes.
 *
 * `salecat_read` already restricts this to published sales and the caller's own
 * drafts, so nothing here needs to re-check visibility.
 */
export async function categoriesBySale(
  supabase: SupabaseClient<Database>,
  saleIds: string[],
): Promise<Map<string, ChipCategory[]>> {
  const byId = new Map<string, ChipCategory[]>();
  // PostgREST reads an empty `in.()` as a syntax error, and there is nothing to
  // ask for anyway.
  if (saleIds.length === 0) return byId;

  const { data } = await supabase
    .from("sale_categories")
    .select("sale_id, categories(id, label, color, position)")
    .in("sale_id", saleIds);

  const positions = new Map<number, number>();
  for (const row of data ?? []) {
    const category = row.categories;
    if (!category) continue;
    positions.set(category.id, category.position);
    const list = byId.get(row.sale_id) ?? [];
    list.push({ id: category.id, label: category.label, color: category.color });
    byId.set(row.sale_id, list);
  }

  // Ordered the way the picker orders them, so a sale's chips don't reshuffle
  // between the saved list and its own page and read as two different sales.
  for (const list of byId.values()) {
    list.sort((a, b) => (positions.get(a.id)! - positions.get(b.id)!) || a.id - b.id);
  }

  return byId;
}
