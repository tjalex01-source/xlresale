"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

import { createClient } from "@/lib/supabase/client";
import { tagPinDataUri } from "@/lib/map-pin";
import { SALE_STATUS_META } from "@/lib/sale-status";
import { formatHours, formatMiles, formatSaleDay, shouldShowStatus } from "@/lib/sale-time";
import type { UpcomingSale } from "@/lib/database.types";

/** Fallback view when there's nothing to fit to: roughly Tyler, TX. */
const FALLBACK_CENTER = { lat: 32.35, lng: -95.3 };

export function MapView({
  initialSales,
  hasHome,
  signedIn,
  radiusMiles,
}: {
  initialSales: UpcomingSale[];
  hasHome: boolean;
  signedIn: boolean;
  radiusMiles: number;
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  const mountRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  // Markers are keyed by sale id and reused. MAPS-COST-CONTROLS.md §2: the map
  // is instantiated once and updated in place — every fresh init is a billable
  // Dynamic Maps load, so nothing here may tear the map down.
  const markersRef = useRef(new Map<string, google.maps.Marker>());
  const selectedRef = useRef<string | null>(null);

  const [sales, setSales] = useState(initialSales);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "no-key" | "error">(
    key ? "loading" : "no-key",
  );
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const days = useMemo(() => [...new Set(sales.map((s) => s.sale_date))].sort(), [sales]);
  const visible = useMemo(() => (day ? sales.filter((s) => s.sale_date === day) : sales), [day, sales]);

  // Derived rather than stored, so a pin hidden by the day filter closes its
  // own card. Holding the selection as state would need an effect to clear it,
  // which is a cascading render for something the data already answers.
  const selected = useMemo(
    () => visible.find((s) => s.id === selectedId) ?? null,
    [visible, selectedId],
  );

  /** Ask the browser where we are, then fetch sales around that point. */
  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateError("This browser won't share your location.");
      return;
    }
    setLocating(true);
    setLocateError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("sales_near_upcoming", {
          in_lat: pos.coords.latitude,
          in_lng: pos.coords.longitude,
          in_miles: radiusMiles,
          in_days: 7,
        });
        setLocating(false);
        if (error) {
          setLocateError(error.message);
          return;
        }
        setSales(data ?? []);
        if (!data?.length) setLocateError("No sales listed near you in the next week.");
      },
      () => {
        setLocating(false);
        setLocateError("Couldn't get your location. You can set a home address on your account instead.");
      },
      { timeout: 10_000 },
    );
  }, [radiusMiles]);

  // Create the map exactly once. Empty deps is load-bearing, not an oversight:
  // re-running this would bill another map load on every filter change.
  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    (async () => {
      try {
        setOptions({ key, v: "weekly" });
        const { Map } = await importLibrary("maps");
        if (cancelled || !mountRef.current || mapRef.current) return;

        mapRef.current = new Map(mountRef.current, {
          center: FALLBACK_CENTER,
          zoom: 11,
          // Every control is another thing to mis-tap on a phone in a car.
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  // Sync markers to the data. Adds what's new, drops what's gone, and leaves
  // everything else alone so the map itself is never touched.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;

    let cancelled = false;

    (async () => {
      const { Marker } = await importLibrary("marker");
      if (cancelled || !mapRef.current) return;

      const markers = markersRef.current;
      const wanted = new Set(sales.map((s) => s.id));

      for (const [id, marker] of markers) {
        if (!wanted.has(id)) {
          marker.setMap(null);
          markers.delete(id);
        }
      }

      for (const sale of sales) {
        if (markers.has(sale.id)) continue;
        const marker = new Marker({
          map,
          position: { lat: sale.lat, lng: sale.lng },
          title: sale.title,
          icon: {
            url: tagPinDataUri(sale.status),
            scaledSize: new google.maps.Size(40, 52),
            anchor: new google.maps.Point(20, 49),
          },
        });
        marker.addListener("click", () => setSelectedId(sale.id));
        markers.set(sale.id, marker);
      }

      // Frame everything on the first batch only. Refitting on each filter tap
      // would yank the map out from under someone who just panned it.
      if (sales.length > 0 && !map.get("xlFitted")) {
        const bounds = new google.maps.LatLngBounds();
        sales.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
        map.fitBounds(bounds, 64);
        map.set("xlFitted", true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sales, status]);

  // The day filter only toggles visibility — no map calls, no marker rebuilds.
  useEffect(() => {
    const shown = new Set(visible.map((s) => s.id));
    for (const [id, marker] of markersRef.current) marker.setVisible(shown.has(id));
  }, [visible]);

  // Outline the selected pin so the card and the map agree on what's chosen.
  useEffect(() => {
    const markers = markersRef.current;
    const previous = selectedRef.current;

    if (previous && previous !== selected?.id) {
      const sale = sales.find((s) => s.id === previous);
      const marker = markers.get(previous);
      if (sale && marker) {
        marker.setIcon({
          url: tagPinDataUri(sale.status),
          scaledSize: new google.maps.Size(40, 52),
          anchor: new google.maps.Point(20, 49),
        });
      }
    }

    if (selected) {
      const marker = markers.get(selected.id);
      marker?.setIcon({
        url: tagPinDataUri(selected.status, true),
        scaledSize: new google.maps.Size(46, 60),
        anchor: new google.maps.Point(23, 57),
      });
      mapRef.current?.panTo({ lat: selected.lat, lng: selected.lng });
    }

    selectedRef.current = selected?.id ?? null;
  }, [selected, sales]);

  if (status === "no-key") {
    return (
      <p className="rounded-[16px] bg-tangerine-50 px-4 py-3 text-sm text-tangerine-ink">
        The map needs a Google Maps key. Add{" "}
        <span className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_KEY</span> in Vercel and redeploy.
      </p>
    );
  }

  return (
    <div>
      {days.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={day === null}
            onClick={() => setDay(null)}
            className={`inline-flex min-h-11 items-center rounded-[10px] border px-4 text-sm font-bold ${
              day === null ? "border-pink bg-pink-50 text-pink-ink" : "border-hair bg-panel hover:border-pink"
            }`}
          >
            All week
          </button>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={day === d}
              onClick={() => setDay(d)}
              className={`inline-flex min-h-11 items-center rounded-[10px] border px-4 text-sm font-bold ${
                day === d ? "border-pink bg-pink-50 text-pink-ink" : "border-hair bg-panel hover:border-pink"
              }`}
            >
              {formatSaleDay(d)}
            </button>
          ))}
        </div>
      )}

      <div className="relative overflow-hidden rounded-[22px] border border-hair">
        <div ref={mountRef} className="h-[58vh] min-h-80 w-full bg-panel" />

        {status === "loading" && (
          <p className="absolute inset-0 grid place-items-center text-sm text-muted">
            Loading the map…
          </p>
        )}
        {status === "error" && (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-pink-ink">
            The map didn&rsquo;t load. Check that the Maps JavaScript API is enabled and the key
            allows this site.
          </p>
        )}
      </div>

      {selected ? (
        <article className="mt-4 rounded-[18px] border border-hair bg-panel p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/s/${selected.id}`}
                className="font-display text-lg font-bold leading-tight hover:text-pink"
              >
                {selected.title}
              </Link>
              {shouldShowStatus(selected) && (
                <p
                  className="mt-1 font-mono text-[13px]"
                  style={{ color: SALE_STATUS_META[selected.status].textColor }}
                >
                  {SALE_STATUS_META[selected.status].label}
                </p>
              )}
              <p className="mt-1 font-mono text-[13px] text-ink-soft">
                {formatSaleDay(selected.sale_date)} ·{" "}
                {formatHours(selected.opens_at, selected.closes_at)} ·{" "}
                {formatMiles(selected.distance_miles)}
              </p>
              <p className="mt-0.5 truncate text-sm text-muted">{selected.address}</p>

              {(selected.discount_active || selected.free_pile) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.discount_active && (
                    <span className="rounded-full bg-tangerine px-2.5 py-0.5 font-mono text-xs font-bold text-ink">
                      {selected.discount_percent}% OFF
                    </span>
                  )}
                  {selected.free_pile && (
                    <span className="rounded-full bg-green px-2.5 py-0.5 font-mono text-xs font-bold text-ink">
                      FREE
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Close preview"
              className="grid size-11 shrink-0 place-items-center rounded-[10px] text-muted hover:text-ink"
            >
              ✕
            </button>
          </div>

          <Link
            href={`/s/${selected.id}`}
            className="mt-3 inline-flex min-h-11 items-center rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas hover:opacity-90"
          >
            See the sale
          </Link>
        </article>
      ) : (
        sales.length > 0 && (
          <p className="mt-4 text-sm text-ink-soft">
            {visible.length} {visible.length === 1 ? "sale" : "sales"}
            {day ? ` on ${formatSaleDay(day)}` : " in the next week"}. Tap a pin.
          </p>
        )
      )}

      {sales.length === 0 && status === "ready" && (
        <div className="mt-4 rounded-[16px] border border-hair bg-panel px-4 py-5 text-sm">
          {hasHome ? (
            <p className="text-ink-soft">
              Nothing listed near you in the next week. Widen your radius on your{" "}
              <Link href="/account" className="font-semibold text-ink underline underline-offset-4">
                account page
              </Link>
              .
            </p>
          ) : (
            <>
              <p className="text-ink-soft">
                {signedIn
                  ? "Set a home address on your account, or use your current location just for now."
                  : "Use your current location to see what's nearby."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={locate}
                  disabled={locating}
                  className="inline-flex min-h-11 items-center rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas hover:opacity-90 disabled:opacity-60"
                >
                  {locating ? "Finding you…" : "Use my location"}
                </button>
                {signedIn && (
                  <Link
                    href="/account"
                    className="inline-flex min-h-11 items-center rounded-[10px] border border-hair px-4 text-sm font-semibold hover:border-pink hover:text-pink"
                  >
                    Set a home address
                  </Link>
                )}
              </div>
              {locateError && (
                <p className="mt-3 text-sm text-pink-ink" role="alert">
                  {locateError}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
