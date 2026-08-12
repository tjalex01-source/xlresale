"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import { Field, FormError, SubmitButton } from "@/components/form";
import { formatMoney } from "@/lib/pricing";
import { formatSaleDay } from "@/lib/sale-time";
import { addFind, removeFind, setFindPublic, type Result } from "./actions";
import type { Find } from "@/lib/database.types";

function Row({ find, username }: { find: Find; username: string | null }) {
  const [pending, startTransition] = useTransition();

  const paid = find.price_paid;
  const worth = find.est_value;
  const saved = paid !== null && worth !== null ? worth - paid : null;

  return (
    <li className="rounded-[16px] border border-hair bg-panel p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-lg font-bold">{find.title}</span>
        <span className="font-mono text-[13px] text-muted">{formatSaleDay(find.found_on)}</span>
      </div>

      {(paid !== null || worth !== null) && (
        <p className="mt-2 font-mono text-sm">
          {paid !== null && <>paid {formatMoney(paid)}</>}
          {paid !== null && worth !== null && " · "}
          {worth !== null && <>worth {formatMoney(worth)}</>}
          {saved !== null && saved > 0 && (
            <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-ink">
              +{formatMoney(saved)}
            </span>
          )}
        </p>
      )}

      {find.note && <p className="mt-2 text-sm text-ink-soft">{find.note}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void setFindPublic(find.id, !find.is_public))}
          className="min-h-11 rounded-[10px] border border-hair px-3 text-sm font-semibold hover:border-pink hover:text-pink disabled:opacity-60"
        >
          {find.is_public ? "Public" : "Private"}
        </button>

        {find.is_public && username && (
          <Link
            href={`/u/${username}`}
            className="text-sm font-semibold text-muted underline underline-offset-4 hover:text-pink"
          >
            See it on your profile
          </Link>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void removeFind(find.id))}
          className="ml-auto min-h-11 rounded-[10px] px-3 text-sm font-semibold text-muted hover:text-pink disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

export function FindsManager({
  finds,
  username,
  savedSales,
  today,
}: {
  finds: Find[];
  username: string | null;
  /** Sales this shopper saved, offered as "where did you get it?" */
  savedSales: { id: string; title: string }[];
  /** Today's date as YYYY-MM-DD, computed on the server so it matches the DB. */
  today: string;
}) {
  const [result, action] = useActionState<Result | null, FormData>(addFind, null);
  const [title, setTitle] = useState("");

  return (
    <div>
      {finds.length > 0 && (
        <ul className="mb-8 space-y-3">
          {finds.map((find) => (
            <Row key={find.id} find={find} username={username} />
          ))}
        </ul>
      )}

      <form action={action} className="space-y-4">
        <Field
          label="What did you get?"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Marantz 2230 receiver"
          maxLength={120}
          invalid={result?.ok === false}
        />

        <div className="flex flex-wrap gap-4">
          <div className="min-w-32 flex-1">
            <label htmlFor="price_paid" className="block text-sm font-semibold">
              You paid
            </label>
            <input
              id="price_paid"
              name="price_paid"
              inputMode="decimal"
              placeholder="$20"
              className="mt-1.5 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 font-mono text-base outline-none focus:border-pink"
            />
          </div>

          <div className="min-w-32 flex-1">
            <label htmlFor="est_value" className="block text-sm font-semibold">
              It&rsquo;s worth
            </label>
            <input
              id="est_value"
              name="est_value"
              inputMode="decimal"
              placeholder="$180"
              className="mt-1.5 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 font-mono text-base outline-none focus:border-pink"
            />
          </div>

          <div className="min-w-40 flex-1">
            <label htmlFor="found_on" className="block text-sm font-semibold">
              When
            </label>
            <input
              id="found_on"
              name="found_on"
              type="date"
              defaultValue={today}
              className="mt-1.5 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 font-mono text-base outline-none focus:border-pink"
            />
          </div>
        </div>

        {savedSales.length > 0 && (
          <div>
            <label htmlFor="sale_id" className="block text-sm font-semibold">
              Where <span className="font-normal text-muted">(optional)</span>
            </label>
            <select
              id="sale_id"
              name="sale_id"
              defaultValue=""
              className="mt-1.5 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 text-base outline-none focus:border-pink"
            >
              <option value="">Somewhere else</option>
              {savedSales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="note" className="block text-sm font-semibold">
            The story <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={500}
            placeholder="Last hour of the sale, they knocked it down to twenty because it needed a lamp."
            className="mt-1.5 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 text-base outline-none focus:border-pink"
          />
        </div>

        <label className="flex items-start gap-3">
          <input type="checkbox" name="is_public" defaultChecked className="mt-1 size-5 accent-pink" />
          <span className="text-sm">
            <span className="font-semibold">Show this on my profile.</span>{" "}
            {username ? (
              <>
                Public finds appear at <span className="font-mono text-[13px]">/u/{username}</span> for
                anyone with the link.
              </>
            ) : (
              <>Claim a handle on your account page to get a profile others can see.</>
            )}
          </span>
        </label>

        <SubmitButton pending="Saving…">Log this find</SubmitButton>

        {result?.ok === false && <FormError>{result.message}</FormError>}
        {result?.ok === true && result.message && (
          <p className="text-sm text-green-ink" role="status">
            {result.message}
          </p>
        )}
      </form>
    </div>
  );
}
