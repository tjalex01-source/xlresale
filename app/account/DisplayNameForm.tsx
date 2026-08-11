"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateDisplayName, type UpdateProfileResult } from "./actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function DisplayNameForm({ initial }: { initial: string }) {
  const [result, action] = useActionState<UpdateProfileResult | null, FormData>(
    updateDisplayName,
    null,
  );

  return (
    <form action={action} className="mt-4">
      <label htmlFor="display_name" className="block text-sm font-semibold">
        Your name
      </label>
      <p className="mt-1 text-sm text-ink-soft">
        Shown to shoppers on the sales you host.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id="display_name"
          name="display_name"
          type="text"
          required
          maxLength={60}
          defaultValue={initial}
          className="min-w-0 flex-1 rounded-xl border border-hair bg-panel px-3.5 py-2.5 text-base outline-none placeholder:text-grey focus:border-pink"
        />
        <SaveButton />
      </div>

      {result?.ok === false && (
        <p className="mt-2 text-sm text-pink-ink" role="alert">
          {result.message}
        </p>
      )}
      {result?.ok === true && (
        <p className="mt-2 text-sm text-green-ink" role="status">
          Saved.
        </p>
      )}
    </form>
  );
}
