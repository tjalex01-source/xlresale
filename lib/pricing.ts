/**
 * Effective price for a featured item.
 *
 * This mirrors `public.item_effective_price()` from schema-additions-seller.sql
 * exactly — it exists so the dashboard can reprice instantly on a tap without a
 * round trip. The database stays the authority; if these ever disagree, the SQL
 * function is right and this is the bug.
 *
 * The rules, from that file's header:
 *   1. Base price is the item's own price.
 *   2. Apply the item's own drop, if any.
 *   3. Apply the sale-wide drop too, unless the item is locked out of it.
 *   4. When both apply, the LOWER price wins — never quietly raise a hand-cut
 *      price because a shallower sale-wide discount came along.
 *   5. Locked items ignore the sale-wide discount entirely.
 */
export function effectivePrice(
  basePrice: number,
  itemDiscountPercent: number,
  saleDiscountPercent: number,
  saleDiscountActive: boolean,
  excludedFromBulk: boolean,
): number {
  const own = basePrice * (1 - itemDiscountPercent / 100);
  const bulk =
    saleDiscountActive && !excludedFromBulk
      ? basePrice * (1 - saleDiscountPercent / 100)
      : basePrice;
  return Math.round(Math.min(own, bulk) * 100) / 100;
}

export function formatMoney(value: number): string {
  return `$${value.toFixed(2).replace(/\.00$/, "")}`;
}

/** One-tap tiers from DESIGN.md / the host-dashboard reference. */
export const DISCOUNT_TIERS = [10, 25, 50, 75] as const;
