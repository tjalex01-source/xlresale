"use client";

import { useState, useTransition } from "react";

import { setSaleHidden } from "./actions";

/**
 * The host's own takedown.
 *
 * Deliberately not buried behind a confirm-and-explain flow. If someone feels
 * unsafe mid-sale, the control has to be one tap — the friction belongs on
 * putting it *back*, not on taking it down.
 */
export function TakedownCard({ saleId, initialHidden }: { saleId: string; initialHidden: boolean }) {
  const [hidden, setHidden] = useState(initialHidden);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (next: boolean) =>
    startTransition(async () => {
      const result = await setSaleHidden(saleId, next);
      setMessage(result.message);
      if (result.ok) setHidden(result.hidden);
    });

  return (
    <div>
      {hidden ? (
        <>
          <p className="rounded-[10px] bg-pink-50 px-3.5 py-2.5 text-sm font-semibold text-pink-ink">
            This sale is off the map. Nobody can find it.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => toggle(false)}
            className="mt-4 inline-flex min-h-11 items-center rounded-[10px] border border-hair px-4 text-sm font-semibold hover:border-pink hover:text-pink disabled:opacity-50"
          >
            {pending ? "Working…" : "Put it back on the map"}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            Takes your sale off the map straight away &mdash; the pin, the listing, the alerts, all
            of it. Your listing isn&rsquo;t refunded or deleted, and you can put it back whenever
            you want.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => toggle(true)}
            className="mt-4 inline-flex min-h-11 items-center rounded-[10px] border border-pink px-4 text-sm font-bold text-pink-ink hover:bg-pink-50 disabled:opacity-50"
          >
            {pending ? "Working…" : "Take it off the map now"}
          </button>
        </>
      )}

      {message && (
        <p className="mt-3 text-sm text-ink-soft" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
