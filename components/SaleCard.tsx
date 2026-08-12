import Link from "next/link";

import { TagPin } from "@/components/TagPin";
import { SALE_STATUS_META } from "@/lib/sale-status";
import { formatHours, formatMiles, formatSaleDay, shouldShowStatus } from "@/lib/sale-time";
import type { SaleStatus } from "@/lib/database.types";

/**
 * One sale, as a row in a list.
 *
 * Shared by the browse list and the saved list so a sale looks the same
 * wherever a shopper meets it — and so the map's preview card has one obvious
 * component to reuse when it lands.
 */
export function SaleCard({
  sale,
  distanceMiles,
  trailing,
}: {
  sale: {
    id: string;
    title: string;
    address: string;
    sale_date: string;
    opens_at: string;
    closes_at: string;
    status: SaleStatus;
    free_pile?: boolean;
    discount_percent?: number;
    discount_active?: boolean;
  };
  distanceMiles?: number | null;
  /** Optional control on the right, e.g. a remove button. */
  trailing?: React.ReactNode;
}) {
  const meta = SALE_STATUS_META[sale.status];

  return (
    <li className="flex items-start gap-4 rounded-[18px] border border-hair bg-panel p-4">
      <TagPin status={sale.status} size={34} />

      <div className="min-w-0 flex-1">
        <Link href={`/s/${sale.id}`} className="font-display text-lg font-bold leading-tight hover:text-pink">
          {sale.title}
        </Link>

        {shouldShowStatus(sale) && (
          <p className="mt-1 font-mono text-[13px]" style={{ color: meta.textColor }}>
            {meta.label}
          </p>
        )}

        <p className="mt-1 font-mono text-[13px] text-ink-soft">
          {formatSaleDay(sale.sale_date)} · {formatHours(sale.opens_at, sale.closes_at)}
          {typeof distanceMiles === "number" && <> · {formatMiles(distanceMiles)}</>}
        </p>

        <p className="mt-0.5 truncate text-sm text-muted">{sale.address}</p>

        {(sale.discount_active || sale.free_pile) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {sale.discount_active && (
              <span className="rounded-full bg-tangerine px-2.5 py-0.5 font-mono text-xs font-bold text-ink">
                {sale.discount_percent}% OFF
              </span>
            )}
            {sale.free_pile && (
              <span className="rounded-full bg-green px-2.5 py-0.5 font-mono text-xs font-bold text-ink">
                FREE
              </span>
            )}
          </div>
        )}
      </div>

      {trailing && <div className="shrink-0">{trailing}</div>}
    </li>
  );
}
