"use client";

import { useState, useTransition } from "react";

import { setFreePile } from "./actions";

export function FreePileToggle({
  saleId,
  on,
  note,
}: {
  saleId: string;
  on: boolean;
  note: string;
}) {
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(on);
  const [text, setText] = useState(note);
  const [saved, setSaved] = useState(false);

  function save(nextOn: boolean, nextNote: string) {
    setSaved(false);
    start(async () => {
      await setFreePile(saleId, nextOn, nextNote);
      setSaved(true);
    });
  }

  return (
    <div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          onChange={(e) => {
            setEnabled(e.target.checked);
            save(e.target.checked, text);
          }}
          className="mt-1 size-5 accent-[var(--color-green)]"
        />
        <span>
          <span className="font-semibold">There&rsquo;s a free pile</span>
          <span className="mt-0.5 block text-sm text-ink-soft">
            Adds a FREE badge to your pin and puts you in the &ldquo;free stuff&rdquo; filter.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={text}
            maxLength={120}
            onChange={(e) => setText(e.target.value)}
            placeholder="Free box by the mailbox — help yourself"
            className="min-w-[12rem] flex-1 rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 text-base outline-none placeholder:text-grey focus:border-pink"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => save(true, text)}
            className="inline-flex min-h-11 items-center rounded-[10px] border border-hair px-4 text-sm font-semibold hover:border-pink disabled:opacity-60"
          >
            Save note
          </button>
        </div>
      )}

      {saved && !pending && (
        <p className="mt-2 text-sm text-green-ink" role="status">
          Saved.
        </p>
      )}
    </div>
  );
}
