"use client";

import { useActionState, useMemo, useState } from "react";

import { FormError, SubmitButton } from "@/components/form";
import { saveAlertPrefs, type Result } from "./actions";
import type { PickerCategory } from "@/components/CategoryPicker";

function Check({
  name,
  value,
  defaultChecked,
  checked,
  onChange,
  children,
}: {
  name: string;
  value?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="mt-1 size-5 shrink-0 accent-pink"
      />
      <span className="text-sm">{children}</span>
    </label>
  );
}

export function AlertPrefs({
  emailEnabled,
  bulkLotsEnabled,
  bulkLotCategories,
  categories,
}: {
  emailEnabled: boolean;
  bulkLotsEnabled: boolean;
  bulkLotCategories: number[];
  categories: PickerCategory[];
}) {
  const [result, action] = useActionState<Result | null, FormData>(saveAlertPrefs, null);
  // Controlled so the category list can appear and disappear with the toggle.
  const [bulk, setBulk] = useState(bulkLotsEnabled);

  // Parents only. This was a flat map over everything, which was eight
  // checkboxes before the category tree landed and a hundred and one after it —
  // nobody is reading a hundred and one checkboxes to say what junk they'll
  // take. Bulk lots are a whole garage anyway; "Furniture" is as precise as the
  // question deserves.
  const topLevel = useMemo(
    () =>
      categories.filter((c) => c.parent_id === null).sort((a, b) => a.position - b.position),
    [categories],
  );

  return (
    <form action={action} className="mt-4 space-y-6">
      <div>
        <Check name="email_enabled" defaultChecked={emailEnabled}>
          <span className="font-semibold">Email me</span> when something on my list shows up nearby.
        </Check>
      </div>

      <div className="rounded-[16px] border border-hair bg-canvas p-4">
        <Check name="bulk_lots_enabled" checked={bulk} onChange={setBulk}>
          <span className="font-semibold">Tell me about bulk lots.</span> A host packing up who
          wants one person to take everything left. You deal with them directly.
        </Check>

        {bulk && (
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold">Anything in particular?</legend>
            <p className="mt-1 text-sm text-muted">Leave it blank to hear about everything.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {topLevel.map((c) => (
                <Check
                  key={c.id}
                  name="bulk_lot_categories"
                  value={String(c.id)}
                  defaultChecked={bulkLotCategories.includes(c.id)}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.label}
                  </span>
                </Check>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <div>
        <SubmitButton pending="Saving…">Save preferences</SubmitButton>
      </div>

      {result?.ok === false && <FormError>{result.message}</FormError>}
      {result?.ok === true && result.message && (
        <p className="text-sm text-green-ink" role="status">
          {result.message}
        </p>
      )}
    </form>
  );
}
