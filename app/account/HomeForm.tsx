"use client";

import { useActionState, useState } from "react";

import { AddressField, type PickedAddress } from "@/components/AddressField";
import { FormError, SubmitButton } from "@/components/form";
import { saveHome, type SaveResult } from "./actions";

const RADII = [2, 5, 10, 20, 40];

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
        <div className="mt-2 flex flex-wrap gap-2">
          {RADII.map((miles) => (
            <label
              key={miles}
              className="cursor-pointer rounded-[10px] border border-hair bg-panel px-4 py-2.5 font-mono text-sm font-bold has-[:checked]:border-pink has-[:checked]:bg-pink-50 has-[:checked]:text-pink-ink"
            >
              <input
                type="radio"
                name="radius_miles"
                value={miles}
                checked={radius === miles}
                onChange={() => setRadius(miles)}
                className="sr-only"
              />
              {miles} mi
            </label>
          ))}
        </div>
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
