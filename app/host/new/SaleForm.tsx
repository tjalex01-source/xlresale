"use client";

import { useActionState, useState } from "react";

import { AddressField, type PickedAddress } from "@/components/AddressField";
import { Field, FormError, SubmitButton } from "@/components/form";
import { createSaleDraft, type SaleDraftState } from "./actions";

/**
 * Until the Google Time Zone API is wired (it needs the same Maps key), the
 * host picks their zone. It matters: closing times are wall-clock local, and
 * the auto-close job reads this column.
 */
const ZONES = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

export function SaleForm({ categories }: { categories: { id: number; label: string }[] }) {
  const [state, action] = useActionState<SaleDraftState, FormData>(createSaleDraft, {
    status: "idle",
  });
  const [address, setAddress] = useState<PickedAddress | null>(null);
  const [freePile, setFreePile] = useState(false);

  const field = state.status === "error" ? state.field : undefined;

  return (
    <form action={action} className="space-y-6">
      <Field
        label="What are you selling?"
        name="title"
        required
        maxLength={120}
        placeholder="Multi-family — tools, vinyl & mid-century"
        hint="This is the headline shoppers see on the map."
        invalid={field === "title"}
      />

      <div>
        <label htmlFor="description" className="block text-sm font-semibold">
          Details <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          placeholder="Power tools, records, teak credenza, Pyrex, camping gear, kids bikes."
          className="mt-1.5 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 text-base outline-none placeholder:text-grey focus:border-pink"
        />
      </div>

      <AddressField value={address} onChange={setAddress} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Date"
          name="sale_date"
          type="date"
          required
          invalid={field === "sale_date"}
        />
        <div>
          <label htmlFor="time_zone" className="block text-sm font-semibold">
            Time zone
          </label>
          <select
            id="time_zone"
            name="time_zone"
            defaultValue="America/Chicago"
            className="mt-1.5 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 text-base outline-none focus:border-pink"
          >
            {ZONES.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Opens" name="opens_at" type="time" required invalid={field === "opens_at"} />
        <Field
          label="Closes"
          name="closes_at"
          type="time"
          required
          hint="Shoppers' routes are built around this."
          invalid={field === "closes_at"}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">What have you got?</legend>
        <p className="mt-1 text-sm text-muted">Pick any that fit. It drives the map filters.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <label
              key={c.id}
              className="cursor-pointer rounded-[10px] border border-hair bg-panel px-4 py-2.5 text-sm font-semibold has-[:checked]:border-pink has-[:checked]:bg-pink-50 has-[:checked]:text-pink-ink"
            >
              <input
                type="checkbox"
                name="category_ids"
                value={c.id}
                className="sr-only"
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-[16px] border border-hair bg-panel p-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="free_pile"
            checked={freePile}
            onChange={(e) => setFreePile(e.target.checked)}
            className="mt-1 size-5 accent-[var(--color-green)]"
          />
          <span>
            <span className="font-display text-lg font-bold">There&rsquo;s a free pile</span>
            <span className="mt-1 block text-sm text-ink-soft">
              Your pin gets a FREE badge, and shoppers can filter for it.
            </span>
          </span>
        </label>
        {freePile && (
          <input
            name="free_pile_note"
            maxLength={120}
            placeholder="Free box by the mailbox — help yourself"
            className="mt-3 w-full rounded-[10px] border border-hair bg-canvas px-3.5 py-2.5 text-base outline-none placeholder:text-grey focus:border-pink"
          />
        )}
      </div>

      {state.status === "error" && <FormError>{state.message}</FormError>}

      <div>
        <SubmitButton pending="Saving…">Save and add photos</SubmitButton>
        <p className="mt-3 text-sm text-muted">
          Nothing is charged yet. Your sale stays private until you publish it for $5.
        </p>
      </div>
    </form>
  );
}
