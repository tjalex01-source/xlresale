/**
 * Time-aware route planning — the moat (CLAUDE.md §10).
 *
 * This is a Vehicle Routing Problem with Time Windows, not shortest-path: a
 * valid route arrives at every stop before it closes, and only then tries to
 * minimise driving. A route that saves eight minutes but misses a sale is a
 * worse route, and the ordering below encodes exactly that priority.
 *
 * Everything here is pure. Leg times come in as a lookup so the same code runs
 * against free haversine estimates while someone is still adding stops, and
 * against real road times once they commit — see MAPS-COST-CONTROLS.md §1,
 * which is why no function in this file knows that Google exists.
 */

/** Minutes browsing at each sale. CLAUDE.md §10: default 20. */
export const DWELL_MINUTES = 20;

/** Under this much slack, "you'll make it" isn't an honest thing to say. */
export const TIGHT_MINUTES = 20;

/** Assumed average speed for straight-line estimates, in mph. */
const ESTIMATE_MPH = 26;

export interface RouteStop {
  id: string;
  title: string;
  lat: number;
  lng: number;
  /** "HH:MM:SS" or "HH:MM" — wall-clock local to the sale. */
  opens_at: string;
  closes_at: string;
}

export interface Point {
  lat: number;
  lng: number;
}

/** Drive minutes between two ids. Key format: `${fromId}>${toId}`. */
export type LegTimes = Record<string, number>;

export const legKey = (from: string, to: string) => `${from}>${to}`;

/** "13:30:00" → 810. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** 810 → "1:30pm". */
export function minutesToTime(mins: number): string {
  const wrapped = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

export function haversineMiles(a: Point, b: Point): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Straight-line fallback leg times.
 *
 * These exist so reordering stops costs nothing. They are genuinely rough and
 * can err in either direction: the distance is always short (roads are never
 * straighter than the crow flies) but ESTIMATE_MPH is a conservative
 * town-driving figure, so a highway leg comes out slower than reality. Measured
 * against the real matrix on a 10.9-mile leg, the estimate said 25 minutes and
 * the road said 19.7.
 *
 * The practical consequence is that a route can look like it misses a sale when
 * the real drive would have made it, which is why the UI offers real drive
 * times rather than quietly trusting these.
 */
export function estimateLegs(home: Point, stops: RouteStop[]): LegTimes {
  const legs: LegTimes = {};
  const nodes: { id: string; lat: number; lng: number }[] = [
    { id: "home", ...home },
    ...stops.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng })),
  ];

  for (const from of nodes) {
    for (const to of nodes) {
      if (from.id === to.id) continue;
      legs[legKey(from.id, to.id)] = (haversineMiles(from, to) / ESTIMATE_MPH) * 60;
    }
  }
  return legs;
}

export type VerdictKind = "ok" | "tight" | "miss";

export interface ScheduledStop {
  stop: RouteStop;
  /** Drive minutes from the previous stop (or home for the first). */
  driveMinutes: number;
  /** When you actually start shopping — after any wait for it to open. */
  arriveAt: number;
  /** Minutes spent waiting because you got there before it opened. */
  waitedMinutes: number;
  verdict: { kind: VerdictKind; label: string };
}

export interface Schedule {
  stops: ScheduledStop[];
  totalDriveMinutes: number;
  totalMiles: number;
  /** When you'd finish the last sale. */
  endsAt: number;
  missCount: number;
}

/**
 * Walk the route in order and work out when you land at each stop.
 *
 * Mirrors the prototype's `schedule()` (reference/design-reference.html) —
 * including the detail that arriving early means waiting, not shopping early,
 * so the wait pushes everything downstream.
 */
export function scheduleRoute(
  order: RouteStop[],
  {
    home,
    departAt,
    legs,
    dwellMinutes = DWELL_MINUTES,
  }: { home: Point; departAt: number; legs: LegTimes; dwellMinutes?: number },
): Schedule {
  let clock = departAt;
  let previousId = "home";
  let previousPoint: Point = home;
  let totalMiles = 0;

  const stops: ScheduledStop[] = order.map((stop) => {
    const driveMinutes = legs[legKey(previousId, stop.id)] ?? 0;
    totalMiles += haversineMiles(previousPoint, stop);

    const rawArrival = clock + driveMinutes;
    const opens = timeToMinutes(stop.opens_at);
    const closes = timeToMinutes(stop.closes_at);

    const waitedMinutes = Math.max(0, opens - rawArrival);
    const arriveAt = Math.max(rawArrival, opens);

    // Judged on when you PULL UP, not on when the doors open. Arriving after
    // closing is a miss even if the wait maths would otherwise tidy it up.
    let verdict: ScheduledStop["verdict"];
    if (rawArrival > closes) {
      verdict = { kind: "miss", label: "closes before you get there" };
    } else if (closes - rawArrival < TIGHT_MINUTES) {
      verdict = { kind: "tight", label: "cutting it close" };
    } else {
      verdict = { kind: "ok", label: `${Math.round(closes - arriveAt)} min to spare` };
    }

    clock = arriveAt + dwellMinutes;
    previousId = stop.id;
    previousPoint = stop;

    return { stop, driveMinutes, arriveAt, waitedMinutes, verdict };
  });

  return {
    stops,
    totalDriveMinutes: stops.reduce((sum, s) => sum + s.driveMinutes, 0),
    totalMiles,
    endsAt: stops.length ? clock - dwellMinutes + dwellMinutes : departAt,
    missCount: stops.filter((s) => s.verdict.kind === "miss").length,
  };
}

/**
 * How bad a route is. Lower wins.
 *
 * Misses dominate by a margin no amount of driving can cross, which is the
 * whole point — this is what makes the planner time-aware rather than just a
 * travelling-salesman solver. Tight stops break ties, so given two routes that
 * reach everything, the one with more breathing room wins.
 */
function cost(schedule: Schedule): number {
  const tight = schedule.stops.filter((s) => s.verdict.kind === "tight").length;
  return schedule.missCount * 100_000 + tight * 500 + schedule.totalDriveMinutes;
}

/**
 * Order the stops: greedy nearest-neighbour seed, then a 2-opt improvement
 * pass (CLAUDE.md §10).
 *
 * The seed is built by earliest-closing-first among the near ones rather than
 * pure nearest-neighbour: a sale that shuts at 11 has to be picked up early or
 * it is lost, and plain nearest-neighbour has no way to know that.
 */
export function optimizeOrder(
  stops: RouteStop[],
  options: { home: Point; departAt: number; legs: LegTimes; dwellMinutes?: number },
): RouteStop[] {
  if (stops.length < 2) return [...stops];

  // --- greedy seed ---
  const remaining = [...stops];
  const seeded: RouteStop[] = [];
  let currentId = "home";
  let clock = options.departAt;
  const dwell = options.dwellMinutes ?? DWELL_MINUTES;

  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Infinity;

    remaining.forEach((candidate, i) => {
      const drive = options.legs[legKey(currentId, candidate.id)] ?? 0;
      const arrival = clock + drive;
      const closes = timeToMinutes(candidate.closes_at);
      // Slack left over if we went here next. Negative means we'd miss it, and
      // the penalty makes closing time outrank proximity.
      const slack = closes - arrival;
      const score = slack < 0 ? 100_000 + drive : drive + Math.max(0, slack) * 0.35;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    });

    const next = remaining.splice(bestIndex, 1)[0];
    const drive = options.legs[legKey(currentId, next.id)] ?? 0;
    clock = Math.max(clock + drive, timeToMinutes(next.opens_at)) + dwell;
    currentId = next.id;
    seeded.push(next);
  }

  // --- 2-opt: reverse each segment, keep any reversal that scores better ---
  let best = seeded;
  let bestCost = cost(scheduleRoute(best, options));
  let improved = true;

  // Bounded because this runs on a phone. 15 stops is the ceiling §10 sets for
  // solving client-side, and the loop is O(n²) per pass.
  let passes = 0;
  while (improved && passes < 12) {
    improved = false;
    passes += 1;

    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        const candidateCost = cost(scheduleRoute(candidate, options));
        if (candidateCost < bestCost - 0.001) {
          best = candidate;
          bestCost = candidateCost;
          improved = true;
        }
      }
    }
  }

  return best;
}
