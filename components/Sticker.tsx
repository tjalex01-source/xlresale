import type { SaleStatus } from "@/lib/database.types";
import { SALE_STATUS_META } from "@/lib/sale-status";

/**
 * A garage-sale price sticker.
 *
 * The neon circle stuck on everything in a driveway is the most recognizable
 * object in this world, so it carries the hero. Each one shows a real sale
 * status, which quietly teaches the color language — green is open now, gold is
 * closing, pink is later today, grey is done — without a legend anywhere.
 */
export function Sticker({
  status,
  headline,
  value,
  unit,
  tilt,
  index,
  className = "",
}: {
  status: SaleStatus;
  headline: string;
  value: string;
  unit: string;
  tilt: number;
  index: number;
  className?: string;
}) {
  const meta = SALE_STATUS_META[status];

  return (
    <div
      className={`sticker grid place-items-center rounded-full text-center ${className}`}
      style={
        {
          "--tilt": `${tilt}deg`,
          "--in-delay": `${0.08 * index + 0.15}s`,
          "--float-delay": `${index * 0.9}s`,
          backgroundColor: meta.tint,
          color: meta.textColor,
          border: `2.5px solid ${meta.color}`,
        } as React.CSSProperties
      }
    >
      <div className={meta.pulse ? "sticker-live rounded-full p-1" : "p-1"}>
        <p className="font-mono text-[9px] font-bold uppercase leading-none tracking-[0.12em] sm:text-[10px]">
          {headline}
        </p>
        <p className="mt-1 font-mono text-xl font-bold leading-none sm:text-2xl">{value}</p>
        <p className="mt-0.5 font-mono text-[9px] uppercase leading-none tracking-[0.1em] opacity-70">
          {unit}
        </p>
      </div>
    </div>
  );
}
