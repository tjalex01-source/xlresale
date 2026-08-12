"use client";

import { useEffect, useRef, useState } from "react";
// The Loader class is deprecated in js-api-loader v2 in favour of this
// functional API; setOptions must run before the first importLibrary.
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export type PickedAddress = { address: string; lat: number; lng: number };

/**
 * Address entry, backed by Google Places Autocomplete.
 *
 * `sales.location` is NOT NULL, so a sale cannot be saved from a typed string
 * alone — coordinates have to come from a real place lookup. When the Maps key
 * is missing the field says so plainly and stays disabled, rather than letting
 * someone fill in the whole form and fail at the last step.
 *
 * Uses PlaceAutocompleteElement (the current widget) rather than the legacy
 * Autocomplete class. It handles its own session tokens, which is what keeps
 * Places billing to one charge per lookup (MAPS-COST-CONTROLS.md).
 */
export function AddressField({
  value,
  onChange,
}: {
  value: PickedAddress | null;
  onChange: (v: PickedAddress | null) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Whether the key exists is known at render time — it's inlined at build — so
  // it seeds the initial state rather than being set from inside the effect.
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const [status, setStatus] = useState<"loading" | "ready" | "no-key" | "error">(
    key ? "loading" : "no-key",
  );

  // Held in a ref so the effect doesn't depend on the callback's identity. A
  // parent re-render passing a fresh handler would otherwise tear down and
  // rebuild Google's widget, losing whatever the host had typed.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!key) return;

    let cancelled = false;
    let element: HTMLElement | null = null;

    (async () => {
      try {
        setOptions({ key, v: "weekly" });
        const places = await importLibrary("places");
        if (cancelled || !mountRef.current) return;

        const autocomplete = new places.PlaceAutocompleteElement();
        element = autocomplete as unknown as HTMLElement;
        element.classList.add("w-full");
        mountRef.current.replaceChildren(element);

        element.addEventListener("gmp-select", async (event: Event) => {
          const { placePrediction } = event as unknown as {
            placePrediction: { toPlace: () => google.maps.places.Place };
          };
          const place = placePrediction.toPlace();
          await place.fetchFields({ fields: ["formattedAddress", "location"] });

          const loc = place.location;
          if (!loc || !place.formattedAddress) return;
          onChangeRef.current({
            address: place.formattedAddress,
            lat: typeof loc.lat === "function" ? loc.lat() : (loc.lat as unknown as number),
            lng: typeof loc.lng === "function" ? loc.lng() : (loc.lng as unknown as number),
          });
        });

        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      element?.remove();
    };
  }, [key]);

  return (
    <div>
      <span className="block text-sm font-semibold">Address</span>

      {status === "no-key" && (
        <p className="mt-1.5 rounded-[10px] bg-tangerine-50 px-3.5 py-2.5 text-sm text-tangerine-ink">
          Address lookup isn&rsquo;t switched on yet. It needs the Google Maps key adding to the
          site before a sale can be placed on the map.
        </p>
      )}

      {status === "error" && (
        <p className="mt-1.5 rounded-[10px] bg-pink-50 px-3.5 py-2.5 text-sm text-pink-ink">
          Address lookup didn&rsquo;t load. Refresh and try again.
        </p>
      )}

      <div
        ref={mountRef}
        className={`mt-1.5 rounded-[10px] border border-hair bg-panel [&_gmp-place-autocomplete]:w-full ${
          status === "ready" ? "" : "hidden"
        }`}
      />

      {status === "loading" && (
        <p className="mt-1.5 text-sm text-muted">Loading address lookup&hellip;</p>
      )}

      {value && (
        <p className="mt-2 flex items-start gap-2 text-sm">
          <span aria-hidden className="mt-0.5 text-green">
            ✓
          </span>
          <span>
            {value.address}
            <button
              type="button"
              onClick={() => onChange(null)}
              className="ml-2 font-semibold underline underline-offset-4 hover:text-pink"
            >
              change
            </button>
          </span>
        </p>
      )}

      {/* What actually gets submitted. The visible widget is Google's element. */}
      <input type="hidden" name="address" value={value?.address ?? ""} />
      <input type="hidden" name="lat" value={value?.lat ?? ""} />
      <input type="hidden" name="lng" value={value?.lng ?? ""} />
    </div>
  );
}
