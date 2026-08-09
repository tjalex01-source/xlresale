import type { SaleStatus } from "@/lib/database.types";
import { SALE_STATUS_META } from "@/lib/sale-status";

/**
 * The map marker: a little price tag on a stake, never Google's red teardrop
 * (DESIGN.md → Signature elements). The hole punch at the top is what makes it
 * read as a tag rather than a generic badge.
 *
 * `live` gets a ringing halo — the only element on the page allowed to loop.
 */
export function TagPin({
  status,
  size = 44,
  className = "",
}: {
  status: SaleStatus;
  size?: number;
  className?: string;
}) {
  const meta = SALE_STATUS_META[status];

  return (
    <span
      className={`relative inline-grid place-items-center ${className}`}
      style={{ width: size, height: size * 1.3 }}
    >
      {meta.pulse && (
        <span
          aria-hidden
          className="ping absolute left-1/2 top-[38%] size-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ color: meta.color }}
        />
      )}
      <svg
        viewBox="0 0 40 52"
        width={size}
        height={size * 1.3}
        aria-hidden
        className="relative drop-shadow-[0_4px_10px_rgb(23_19_31_/_0.18)]"
      >
        <path
          d="M6 3h28a5 5 0 0 1 5 5v24a5 5 0 0 1-5 5h-8.5L20 49l-5.5-12H6a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5z"
          fill={meta.color}
        />
        <circle cx="12" cy="13" r="3.4" fill="var(--color-canvas)" opacity="0.9" />
      </svg>
    </span>
  );
}
