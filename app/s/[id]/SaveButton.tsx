"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { setSaved } from "./actions";

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path
        d="M12 20.3s-7.5-4.6-7.5-9.6a4.3 4.3 0 0 1 7.5-2.9 4.3 4.3 0 0 1 7.5 2.9c0 5-7.5 9.6-7.5 9.6Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Save / unsave, with the new state shown immediately.
 *
 * The optimistic flip is local state rather than `useOptimistic`, because the
 * value has to survive after the transition settles — `useOptimistic` reverts
 * to its passed-in prop the moment the action finishes, and the prop only
 * updates on the next server render, which would make the heart visibly blink
 * back and forth on every tap.
 */
export function SaveButton({
  saleId,
  initialSaved,
  signedIn,
}: {
  saleId: string;
  initialSaved: boolean;
  signedIn: boolean;
}) {
  const [saved, setLocalSaved] = useState(initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link
        href={`/login?next=/s/${saleId}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-hair bg-panel px-4 text-sm font-semibold hover:border-pink hover:text-pink"
      >
        <Heart filled={false} />
        Sign in to save
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        aria-pressed={saved}
        onClick={() => {
          const next = !saved;
          setLocalSaved(next);
          setError(null);
          startTransition(async () => {
            const result = await setSaved(saleId, next);
            if (!result.ok) {
              setLocalSaved(!next); // put it back — the save didn't happen
              setError(result.message);
            }
          });
        }}
        className={`inline-flex min-h-11 items-center gap-2 rounded-[10px] border px-4 text-sm font-semibold disabled:opacity-60 ${
          saved
            ? "border-pink bg-pink-50 text-pink-ink"
            : "border-hair bg-panel hover:border-pink hover:text-pink"
        }`}
      >
        <Heart filled={saved} />
        {saved ? "Saved" : "Save this sale"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-pink-ink" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
