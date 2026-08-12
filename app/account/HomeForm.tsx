"use client";

import { useActionState, useState } from "react";

import { AddressField, type PickedAddress } from "@/components/AddressField";
import { FormError, SubmitButton } from "@/components/form";
import { MAX_RADIUS_MILES, RADIUS_PRESETS } from "@/lib/prefs";
import { saveHome, type SaveResult } from "./actions";

export function HomeForm({
  currentAddress,
  radiusMiles,
}: {
  currentAddress: string | null;
  radiusMiles: number;
}) {
  const [result, action] = useActionState<SaveResult | null, FormData>(saveHome, null);
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  const [radius, setRadius] = useState(radiusMiles);
  // Someone who saved 65 miles should come back to "Other: 65", not to a row of
  // chips with nothing selected.
  const [custom, setCustom] = useState(!RADIUS_PRESETS.includes(radiusMiles));

  return (
    <form action={action} className="mt-4 space-y-5">
      {currentAddress && !picked && (
        <p className="text-sm">
          Currently <span className="font-semibold">{currentAddress}</span>
        </p>
      )}

      <AddressField value={picked} onChange={setPicked} />

      <fieldset>
        <legend className="text-sm font-semibold">How far will you drive?</legend>

        {/* One hidden field carries the value however it was chosen, so the
            chips and the custom box can't disagree about what gets submitted. */}
        <input type="hidden" name="radius_miles" value={radius} />

        <div className="mt-2 flex flex-wrap gap-2">
          {RADIUS_PRESETS.map((miles) => {
            const on = !custom && radius === miles;
            return (
              <button
                key={miles}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setCustom(false);
                  setRadius(miles);
                }}
                className={`inline-flex min-h-11 items-center rounded-[10px] border px-4 font-mono text-sm font-bold ${
                  on
                    ? "border-pink bg-pink-50 text-pink-ink"
                    : "border-hair bg-panel hover:border-pink"
                }`}
              >
                {miles} mi
              </button>
            );
          })}

          <button
            type="button"
            aria-pressed={custom}
            onClick={() => setCustom(true)}
            className={`inline-flex min-h-11 items-center rounded-[10px] border px-4 text-sm font-bold ${
              custom ? "border-pink bg-pink-50 text-pink-ink" : "border-hair bg-panel hover:border-pink"
            }`}
          >
            Other
          </button>
        </div>

        {custom && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="custom_radius" className="text-sm font-semibold">
              Miles
            </label>
            <input
              id="custom_radius"
              type="number"
              min={1}
              max={MAX_RADIUS_MILES}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-24 rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 font-mono text-base outline-none focus:border-pink"
            />
            <span className="text-sm text-muted">Up to {MAX_RADIUS_MILES}.</span>
          </div>
        )}
      </fieldset>

      <div>
        <SubmitButton pending="Saving…">Save location</SubmitButton>
      </div>

      {result?.ok === false && <FormError>{result.message}</FormError>}
      {result?.ok === true && (
        <p className="text-sm text-green-ink" role="status">
          {result.message}
        </p>
      )}
    </form>
  );
}
