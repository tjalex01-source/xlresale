import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { legKey, type LegTimes } from "@/lib/route";
import { allow, LIMITS } from "@/lib/rate-limit";

/**
 * Real road drive times between every pair of route points.
 *
 * This is the only paid Google call in the shopper experience and it bills per
 * element — (n+1)² of them — so MAPS-COST-CONTROLS.md §1 governs everything
 * here: the client asks once per set of stops, caches the answer, and does all
 * reordering against the cache. Nothing on this path may be called from a drag
 * handler.
 *
 * Server-side so GOOGLE_MAPS_SERVER_KEY never ships to the browser, and
 * sign-in gated so an anonymous script can't spend the budget.
 */

/** (12 + home)² = 169 elements, the most one request may ever bill. */
const MAX_STOPS = 12;

interface Waypoint {
  id: string;
  lat: number;
  lng: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to get drive times." }, { status: 401 });
  }

  // Checked before anything else costs money. Per-user first so one person
  // hammering it gets told off without eating into everyone else's allowance,
  // then the global ceiling that keeps a busy day inside the Google quota.
  if (!(await allow(`route-matrix:${user.id}`, LIMITS.routeMatrixPerUser.limit, LIMITS.routeMatrixPerUser.windowSeconds))) {
    return NextResponse.json(
      { error: "That's a lot of routes in one go. Try again in a bit." },
      { status: 429 },
    );
  }
  if (!(await allow("route-matrix:global", LIMITS.routeMatrixGlobal.limit, LIMITS.routeMatrixGlobal.windowSeconds))) {
    return NextResponse.json(
      { error: "Drive times are resting for today. Estimates still work." },
      { status: 429 },
    );
  }

  const key = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) {
    return NextResponse.json({ error: "No Google Maps server key configured." }, { status: 503 });
  }

  let points: Waypoint[];
  try {
    const body = await request.json();
    points = body?.points;
  } catch {
    return NextResponse.json({ error: "Bad request body." }, { status: 400 });
  }

  if (!Array.isArray(points) || points.length < 2) {
    return NextResponse.json({ error: "Need at least two points." }, { status: 400 });
  }
  if (points.length > MAX_STOPS + 1) {
    return NextResponse.json(
      { error: `That's more than ${MAX_STOPS} stops. Trim the route and try again.` },
      { status: 400 },
    );
  }
  if (
    points.some(
      (p) =>
        typeof p?.id !== "string" ||
        !Number.isFinite(p?.lat) ||
        !Number.isFinite(p?.lng) ||
        Math.abs(p.lat) > 90 ||
        Math.abs(p.lng) > 180,
    )
  ) {
    return NextResponse.json({ error: "Bad coordinates." }, { status: 400 });
  }

  const waypoints = points.map((p) => ({
    waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } },
  }));

  const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      // Asking for only the four fields we use is required by the API and also
      // keeps the response small.
      "X-Goog-FieldMask": "originIndex,destinationIndex,duration,condition",
    },
    body: JSON.stringify({
      origins: waypoints,
      destinations: waypoints,
      travelMode: "DRIVE",
      // Cheapest tier. Live traffic would price this into a different bracket
      // for a Saturday-morning estimate that doesn't need it.
      routingPreference: "TRAFFIC_UNAWARE",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();

    // Name the two failures that actually happen, because "Google rejected it"
    // sends someone hunting through a console with nothing to go on.
    let hint: string;
    if (/API_KEY_HTTP_REFERRER_BLOCKED|blocked/i.test(detail)) {
      // A referrer-restricted browser key can't be used from a server, where
      // there is no referrer to send. This needs its own IP-restricted key in
      // GOOGLE_MAPS_SERVER_KEY (CLAUDE.md §12, MAPS-COST-CONTROLS.md §3).
      hint =
        "Drive times need a separate server key. Add GOOGLE_MAPS_SERVER_KEY in Vercel — the browser key is referrer-restricted and can't be used server-side.";
    } else if (/SERVICE_DISABLED|has not been used|is disabled/i.test(detail)) {
      hint = "Enable the Routes API in Google Cloud Console → APIs & Services → Library.";
    } else {
      hint = "Google rejected the drive-time request.";
    }

    // The reason is worth having in the server log even though the client only
    // ever sees the hint.
    console.error("route-matrix rejected:", detail.slice(0, 500));
    return NextResponse.json({ error: hint }, { status: 502 });
  }

  const elements: {
    originIndex: number;
    destinationIndex: number;
    duration?: string;
    condition?: string;
  }[] = await response.json();

  const legs: LegTimes = {};
  for (const element of elements) {
    // A pair with no road connection comes back without a duration; leaving it
    // out lets the planner fall back to its straight-line estimate for that
    // one leg instead of treating the drive as instant.
    if (element.condition !== "ROUTE_EXISTS" || !element.duration) continue;

    const from = points[element.originIndex];
    const to = points[element.destinationIndex];
    if (!from || !to || from.id === to.id) continue;

    legs[legKey(from.id, to.id)] = Number.parseFloat(element.duration) / 60;
  }

  return NextResponse.json({ legs, elementCount: points.length ** 2 });
}
