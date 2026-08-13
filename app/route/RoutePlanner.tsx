"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";

import { formatSaleDay } from "@/lib/sale-time";
import {
  DWELL_MINUTES,
  estimateLegs,
  legKey,
  minutesToTime,
  optimizeOrder,
  scheduleRoute,
  timeToMinutes,
  type LegTimes,
  type RouteStop,
} from "@/lib/route";
import { saveRoute } from "./actions";
import type { UpcomingSale } from "@/lib/database.types";

const VERDICT_STYLE = {
  ok: { chip: "bg-green-50 text-green-ink", mark: "✓" },
  tight: { chip: "bg-tangerine-50 text-tangerine-ink", mark: "◔" },
  miss: { chip: "bg-pink-50 text-pink-ink", mark: "✕" },
} as const;

const toStop = (s: UpcomingSale): RouteStop => ({
  id: s.id,
  title: s.title,
  lat: s.lat,
  lng: s.lng,
  opens_at: s.opens_at,
  closes_at: s.closes_at,
});

export function RoutePlanner({
  savedSales,
  home,
  initialRoutes,
  today,
}: {
  savedSales: UpcomingSale[];
  home: { lat: number; lng: number } | null;
  /** Previously saved orders, keyed by date. */
  initialRoutes: Record<string, string[]>;
  today: string;
}) {
  const days = useMemo(
    () => [...new Set(savedSales.map((s) => s.sale_date))].sort(),
    [savedSales],
  );

  // Both seeded from the same day. Deriving the day here and the order from
  // days[0] would load yesterday's saved route onto today's tab whenever the
  // first saved day has already been and gone.
  const initialDay = useMemo(
    () => days.find((d) => d >= today) ?? days[0] ?? today,
    [days, today],
  );

  const [day, setDay] = useState(initialDay);
  const [order, setOrder] = useState<string[]>(() => initialRoutes[initialDay] ?? []);
  const [departAt, setDepartAt] = useState("08:00");
  const [roadLegs, setRoadLegs] = useState<{ key: string; legs: LegTimes } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const dayCandidates = useMemo(
    () => savedSales.filter((s) => s.sale_date === day),
    [savedSales, day],
  );

  const chosen = useMemo(
    () => order.flatMap((id) => {
      const sale = dayCandidates.find((s) => s.id === id);
      return sale ? [toStop(sale)] : [];
    }),
    [order, dayCandidates],
  );

  /** Identity of the current stop SET — order deliberately excluded. */
  const stopSetKey = useMemo(() => [...order].sort().join(","), [order]);
  const roadLegsFresh = roadLegs?.key === stopSetKey && chosen.length > 1;

  // Straight-line estimates cost nothing, so they back every drag and reorder.
  // Real road times replace them only once the shopper asks (MAPS-COST-CONTROLS
  // §1: one paid call per stop set, everything else reads the cache).
  const legs: LegTimes = useMemo(() => {
    const estimated = home ? estimateLegs(home, chosen) : {};
    return roadLegsFresh ? { ...estimated, ...roadLegs.legs } : estimated;
  }, [home, chosen, roadLegsFresh, roadLegs]);

  const schedule = useMemo(
    () =>
      home
        ? scheduleRoute(chosen, { home, departAt: timeToMinutes(departAt), legs })
        : null,
    [chosen, home, departAt, legs],
  );

  const fetchRoadTimes = useCallback(async () => {
    if (!home || chosen.length < 2) return;
    setFetching(true);
    setError(null);

    try {
      const response = await fetch("/api/route-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: [
            { id: "home", lat: home.lat, lng: home.lng },
            ...chosen.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng })),
          ],
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error ?? "Couldn't get drive times.");
        return;
      }
      setRoadLegs({ key: stopSetKey, legs: body.legs });
    } catch {
      setError("Couldn't reach the drive-time service.");
    } finally {
      setFetching(false);
    }
  }, [home, chosen, stopSetKey]);

  const move = (index: number, delta: number) => {
    setOrder((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  if (!home) {
    return (
      <div className="rounded-[16px] bg-tangerine-50 px-4 py-4 text-sm text-tangerine-ink">
        A route has to start somewhere. Set your home address on your{" "}
        <Link href="/account" className="font-bold underline underline-offset-4">
          account page
        </Link>{" "}
        and come back.
      </div>
    );
  }

  return (
    <div>
      {days.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={day === d}
              onClick={() => {
                setDay(d);
                setOrder(initialRoutes[d] ?? []);
                setRoadLegs(null);
              }}
              className={`inline-flex min-h-11 items-center rounded-[10px] border px-4 text-sm font-bold ${
                day === d ? "border-pink bg-pink-50 text-pink-ink" : "border-hair bg-panel hover:border-pink"
              }`}
            >
              {formatSaleDay(d)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4 rounded-[16px] border border-hair bg-panel p-4">
        <div>
          <label htmlFor="depart" className="block text-sm font-semibold">
            Leaving at
          </label>
          <input
            id="depart"
            type="time"
            value={departAt}
            onChange={(e) => setDepartAt(e.target.value)}
            className="mt-1.5 rounded-[10px] border border-hair bg-canvas px-3.5 py-2.5 font-mono text-base outline-none focus:border-pink"
          />
        </div>
        <p className="text-sm text-muted">
          {DWELL_MINUTES} minutes at each sale. Times are estimates until you pull real drive
          times.
        </p>
      </div>

      {/* ---- the route ---- */}
      <section className="mt-6">
        <h2 className="font-display text-xl font-bold">Your route</h2>

        {chosen.length === 0 ? (
          <p className="mt-3 rounded-[14px] border border-hair bg-panel px-4 py-5 text-sm text-ink-soft">
            Add a stop from below and the timings appear here.
          </p>
        ) : (
          <>
            <ol className="mt-3 space-y-2">
              {schedule?.stops.map((entry, index) => {
                const style = VERDICT_STYLE[entry.verdict.kind];
                return (
                  <li
                    key={entry.stop.id}
                    className="flex items-start gap-3 rounded-[16px] border border-hair bg-panel p-4"
                  >
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-ink font-mono text-xs font-bold text-canvas">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/s/${entry.stop.id}`}
                        className="font-display text-lg font-bold leading-tight hover:text-pink"
                      >
                        {entry.stop.title}
                      </Link>

                      <p className="mt-1 font-mono text-[13px] text-ink-soft">
                        {Math.round(entry.driveMinutes)} min drive · arrive{" "}
                        {minutesToTime(entry.arriveAt)} · closes{" "}
                        {minutesToTime(timeToMinutes(entry.stop.closes_at))}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-bold ${style.chip}`}
                        >
                          {style.mark} {entry.verdict.label}
                        </span>
                        {entry.waitedMinutes > 0 && (
                          <span className="rounded-full bg-pink-50 px-2.5 py-0.5 font-mono text-xs font-bold text-pink-ink">
                            wait {Math.round(entry.waitedMinutes)} min for it to open
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${entry.stop.title} earlier`}
                        className="grid size-9 place-items-center rounded-[8px] border border-hair hover:border-pink hover:text-pink disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === chosen.length - 1}
                        aria-label={`Move ${entry.stop.title} later`}
                        className="grid size-9 place-items-center rounded-[8px] border border-hair hover:border-pink hover:text-pink disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrder((c) => c.filter((id) => id !== entry.stop.id))}
                        aria-label={`Remove ${entry.stop.title}`}
                        className="grid size-9 place-items-center rounded-[8px] text-muted hover:text-pink"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>

            {schedule && (
              <div className="mt-4 rounded-[16px] bg-panel p-4">
                <p className="font-mono text-sm">
                  {Math.round(schedule.totalDriveMinutes)} min driving ·{" "}
                  {schedule.totalMiles.toFixed(1)} mi · done by{" "}
                  {minutesToTime(schedule.endsAt)}
                </p>
                {schedule.missCount > 0 && (
                  <p className="mt-2 text-sm font-semibold text-pink-ink">
                    {schedule.missCount === 1
                      ? "One sale closes before you get there."
                      : `${schedule.missCount} sales close before you get there.`}{" "}
                    Try Optimise, an earlier start, or drop a stop.
                  </p>
                )}
                <p className="mt-2 text-sm text-muted">
                  {roadLegsFresh
                    ? "Using real road drive times."
                    : "Using straight-line estimates — real roads take longer."}
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setOrder(
                    optimizeOrder(chosen, { home, departAt: timeToMinutes(departAt), legs }).map(
                      (s) => s.id,
                    ),
                  )
                }
                disabled={chosen.length < 2}
                className="inline-flex min-h-11 items-center rounded-[10px] bg-pink px-4 text-sm font-bold text-white hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                ⚡ Optimise for closing times
              </button>

              <button
                type="button"
                onClick={fetchRoadTimes}
                disabled={fetching || chosen.length < 2 || roadLegsFresh}
                className="inline-flex min-h-11 items-center rounded-[10px] border border-hair bg-panel px-4 text-sm font-semibold hover:border-pink hover:text-pink disabled:opacity-50"
              >
                {fetching ? "Asking Google…" : roadLegsFresh ? "Drive times loaded" : "Get real drive times"}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  startSaving(async () => {
                    const result = await saveRoute(day, order);
                    setSaveMessage(result.ok ? (result.message ?? "Saved.") : result.message);
                  })
                }
                className="inline-flex min-h-11 items-center rounded-[10px] border border-hair bg-panel px-4 text-sm font-semibold hover:border-pink hover:text-pink disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save this route"}
              </button>
            </div>

            {error && (
              <p className="mt-3 rounded-[10px] bg-pink-50 px-3.5 py-2.5 text-sm text-pink-ink" role="alert">
                {error}
              </p>
            )}
            {saveMessage && (
              <p className="mt-3 text-sm text-green-ink" role="status">
                {saveMessage}
              </p>
            )}
          </>
        )}
      </section>

      {/* ---- what's available to add ---- */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-bold">Saved for {formatSaleDay(day)}</h2>

        {dayCandidates.length === 0 ? (
          <p className="mt-3 rounded-[14px] border border-hair bg-panel px-4 py-5 text-sm text-ink-soft">
            Nothing saved for this day.{" "}
            <Link href="/map" className="font-semibold text-ink underline underline-offset-4">
              Find sales on the map
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {dayCandidates.map((sale) => {
              const on = order.includes(sale.id);
              return (
                <li
                  key={sale.id}
                  className="flex items-center gap-3 rounded-[14px] border border-hair bg-panel px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{sale.title}</p>
                    <p className="font-mono text-[13px] text-muted">
                      {minutesToTime(timeToMinutes(sale.opens_at))}–
                      {minutesToTime(timeToMinutes(sale.closes_at))} ·{" "}
                      {sale.distance_miles.toFixed(1)} mi
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setOrder((c) => (on ? c.filter((id) => id !== sale.id) : [...c, sale.id]))
                    }
                    className={`min-h-11 shrink-0 rounded-[10px] border px-4 text-sm font-bold ${
                      on
                        ? "border-pink bg-pink-50 text-pink-ink"
                        : "border-hair hover:border-pink hover:text-pink"
                    }`}
                  >
                    {on ? "On route" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
