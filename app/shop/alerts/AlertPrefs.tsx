"use client";

import { useActionState, useState } from "react";

import { FormError, SubmitButton } from "@/components/form";
import { saveAlertPrefs, type Result } from "./actions";
import type { Category } from "@/lib/database.types";

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
  categories: Category[];
}) {
  const [result, action] = useActionState<Result | null, FormData>(saveAlertPrefs, null);
  // Controlled so the category list can appear and disappear with the toggle.
  const [bulk, setBulk] = useState(bulkLotsEnabled);

  return (
    <form action={action} className="mt-4 space-y-6">
      <div className="space-y-3">
        <Check name="email_enabled" defaultChecked={emailEnabled}>
          <span className="font-semibold">Email me</span> when something on my list shows up nearby.
        </Check>
        <p className="text-sm text-muted">
          Push and text messages come later. Email is the only channel wired up right now.
        </p>
      </div>

      <div className="rounded-[16px] border border-hair bg-canvas p-4">
        <Check name="bulk_lots_enabled" checked={bulk} onChange={setBulk}>
          <span className="font-semibold">Tell me about bulk lots.</span> When a host is packing up
          and wants one person to take everything that&rsquo;s left, we&rsquo;ll let you know the
          price. You deal with them directly.
        </Check>

        {bulk && (
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold">What do you actually want?</legend>
            <p className="mt-1 text-sm text-muted">
              Leave all unticked to hear about everything.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {categories.map((c) => (
                <Check
                  key={c.id}
                  name="bulk_lot_categories"
                  value={String(c.id)}
                  defaultChecked={bulkLotCategories.includes(c.id)}
                >
                  {c.label}
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
