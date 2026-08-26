"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { minutesToTime, timeToMinutes, type ScheduledStop } from "@/lib/route";

/**
 * The route, as a stack of torn-off receipts on an ink block.
 *
 * DESIGN.md calls these out as a signature element — "each route stop is a
 * perforated ticket… make it look like a real torn receipt" — and `.receipt`
 * paints its scallops in ink, so the surrounding block has to be ink for the
 * tear to read. That also gives the page the colour-block rhythm the design
 * system asks for instead of another stack of white cards.
 *
 * Three ways to reorder, because this is used one-handed in a car park:
 *   drag the grip   pointer events, so it works with a finger or a mouse
 *   swipe left      to drop a stop off the route
 *   arrows          the only one a keyboard or screen reader can use, so it
 *                   stays visible rather than hiding behind a hover
 */

const VERDICT = {
  ok: { chip: "bg-green-50 text-green-ink", mark: "✓" },
  tight: { chip: "bg-tangerine-50 text-tangerine-ink", mark: "◔" },
  miss: { chip: "bg-pink-50 text-pink-ink", mark: "✕" },
} as const;

/** How far left you have to pull before letting go actually removes it. */
const REMOVE_AT = 90;

export function StopList({
  stops,
  onReorder,
  onRemove,
}: {
  stops: ScheduledStop[];
  onReorder: (from: number, to: number) => void;
  onRemove: (id: string) => void;
}) {
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const dragFrom = useRef<number | null>(null);
  const swipe = useRef<{ id: string; x: number; y: number; axis: "" | "x" | "y" } | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [offsetById, setOffsetById] = useState<Record<string, number>>({});

  /* ---------- drag from the grip ---------- */

  const startDrag = (index: number, e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragFrom.current = index;
    setDraggingId(stops[index].stop.id);
  };

  const moveDrag = (e: React.PointerEvent) => {
    const from = dragFrom.current;
    if (from === null) return;

    // Re-measured every move: reordering changes the DOM, so cached rects go
    // stale immediately.
    const over = rowRefs.current.findIndex((el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return e.clientY >= r.top && e.clientY <= r.bottom;
    });

    if (over !== -1 && over !== from) {
      onReorder(from, over);
      dragFrom.current = over;
    }
  };

  const endDrag = () => {
    dragFrom.current = null;
    setDraggingId(null);
  };

  /* ---------- swipe the card to remove ---------- */

  const startSwipe = (id: string, e: React.PointerEvent) => {
    swipe.current = { id, x: e.clientX, y: e.clientY, axis: "" };
  };

  const moveSwipe = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s) return;

    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;

    // Decide once whether this gesture is a swipe or the page scrolling, and
    // then stick to it — otherwise a slightly diagonal scroll drags the card.
    if (!s.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (s.axis !== "x") return;

    setOffsetById((o) => ({ ...o, [s.id]: Math.min(0, dx) }));
  };

  const endSwipe = () => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;

    const dx = offsetById[s.id] ?? 0;
    setOffsetById((o) => ({ ...o, [s.id]: 0 }));
    if (dx < -REMOVE_AT) onRemove(s.id);
  };

  return (
    <ol className="space-y-3 rounded-[22px] bg-ink p-4">
      {stops.map((entry, index) => {
        const id = entry.stop.id;
        const style = VERDICT[entry.verdict.kind];
        const offset = offsetById[id] ?? 0;
        const arming = offset < -REMOVE_AT;

        return (
          <li
            key={id}
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
            className="relative"
          >
            {/* What shows through as the card slides away. */}
            <div
              aria-hidden
              className={`absolute inset-0 flex items-center justify-end rounded-[16px] pr-5 font-display text-sm font-bold ${
                arming ? "bg-pink text-white" : "bg-pink/30 text-white/80"
              }`}
            >
              Remove
            </div>

            <div
              onPointerDown={(e) => startSwipe(id, e)}
              onPointerMove={moveSwipe}
              onPointerUp={endSwipe}
              onPointerCancel={endSwipe}
              style={{
                transform: `translateX(${offset}px)`,
                transition: offset === 0 ? "transform 180ms" : undefined,
                touchAction: "pan-y",
              }}
              className={`receipt relative flex items-start gap-3 rounded-[16px] bg-canvas p-4 ${
                draggingId === id ? "opacity-90 shadow-lg" : ""
              }`}
            >
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-ink font-mono text-xs font-bold text-canvas">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/s/${id}`}
                  className="font-display text-lg font-bold leading-tight hover:text-pink"
                >
                  {entry.stop.title}
                </Link>

                <p className="mt-1 font-mono text-[13px] text-ink-soft">
                  {Math.round(entry.driveMinutes)} min · arrive {minutesToTime(entry.arriveAt)} ·
                  closes {minutesToTime(timeToMinutes(entry.stop.closes_at))}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-bold ${style.chip}`}>
                    {style.mark} {entry.verdict.label}
                  </span>
                  {entry.waitedMinutes > 0 && (
                    <span className="rounded-full bg-pink-50 px-2.5 py-0.5 font-mono text-xs font-bold text-pink-ink">
                      wait {Math.round(entry.waitedMinutes)} min
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-center gap-1">
                {/* touch-action:none so dragging from the grip doesn't scroll
                    the page instead. Everywhere else keeps pan-y. */}
                <button
                  type="button"
                  aria-label={`Drag ${entry.stop.title} to reorder`}
                  onPointerDown={(e) => startDrag(index, e)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  style={{ touchAction: "none" }}
                  className="grid size-9 cursor-grab place-items-center rounded-[8px] text-muted active:cursor-grabbing"
                >
                  <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="currentColor">
                    <circle cx="9" cy="6" r="1.6" />
                    <circle cx="15" cy="6" r="1.6" />
                    <circle cx="9" cy="12" r="1.6" />
                    <circle cx="15" cy="12" r="1.6" />
                    <circle cx="9" cy="18" r="1.6" />
                    <circle cx="15" cy="18" r="1.6" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => onReorder(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`Move ${entry.stop.title} earlier`}
                  className="grid size-8 place-items-center rounded-[8px] border border-hair text-sm hover:border-pink hover:text-pink disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onReorder(index, index + 1)}
                  disabled={index === stops.length - 1}
                  aria-label={`Move ${entry.stop.title} later`}
                  className="grid size-8 place-items-center rounded-[8px] border border-hair text-sm hover:border-pink hover:text-pink disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>
          </li>
        );
      })}

      <li className="pt-1 text-center font-mono text-[13px] text-canvas/60">
        drag the grip to reorder · swipe a stop left to drop it
      </li>
    </ol>
  );
}
