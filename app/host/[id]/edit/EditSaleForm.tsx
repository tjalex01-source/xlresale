"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { AddressField, type PickedAddress } from "@/components/AddressField";
import { Field, FormError, SubmitButton } from "@/components/form";
import { updateSale, type EditState } from "./actions";

export interface EditableSale {
  id: string;
  title: string;
  description: string | null;
  address: string;
  sale_date: string;
  opens_at: string;
  closes_at: string;
  free_pile: boolean;
  free_pile_note: string | null;
  reschedule_count: number;
}

/** "13:00:00" from Postgres; the time input wants "13:00". */
const toTimeInput = (t: string) => t.slice(0, 5);

export function EditSaleForm({
  sale,
  categories,
  selectedCategoryIds,
  watcherCount,
}: {
  sale: EditableSale;
  categories: { id: number; label: string }[];
  selectedCategoryIds: number[];
  watcherCount: number;
}) {
  const [state, action] = useActionState<EditState | null, FormData>(updateSale, null);
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  const [date, setDate] = useState(sale.sale_date);
  const [freePile, setFreePile] = useState(sale.free_pile);

  const field = state?.status === "error" ? state.field : undefined;
  const dateChanged = date !== sale.sale_date;
  const addressChanging = picked !== null;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="sale_id" value={sale.id} />

      <Field
        label="Title"
        name="title"
        defaultValue={sale.title}
        maxLength={120}
        required
        invalid={field === "title"}
      />

      <div>
        <label htmlFor="description" className="block text-sm font-semibold">
          What&rsquo;s there
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={sale.description ?? ""}
          className="mt-1.5 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 text-base outline-none focus:border-pink"
        />
      </div>

      {/* ---- date ---- */}
      <div>
        <label htmlFor="sale_date" className="block text-sm font-semibold">
          Date
        </label>
        <input
          id="sale_date"
          name="sale_date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className={`mt-1.5 rounded-[10px] border bg-panel px-3.5 py-2.5 font-mono text-base outline-none focus:border-pink ${
            field === "sale_date" ? "border-pink" : "border-hair"
          }`}
        />
        {dateChanged && watcherCount > 0 && (
          <p className="mt-2 rounded-[10px] bg-tangerine-50 px-3.5 py-2.5 text-sm text-tangerine-ink">
            {watcherCount} {watcherCount === 1 ? "person has" : "people have"} saved this sale.
            Moving it will let them know.
          </p>
        )}
        {sale.reschedule_count > 0 && (
          <p className="mt-2 font-mono text-[13px] text-muted">
            Moved {sale.reschedule_count} {sale.reschedule_count === 1 ? "time" : "times"} so far.
            Moving a sale is always free.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <Field
          label="Opens"
          name="opens_at"
          type="time"
          defaultValue={toTimeInput(sale.opens_at)}
          required
          invalid={field === "opens_at"}
        />
        <Field
          label="Closes"
          name="closes_at"
          type="time"
          defaultValue={toTimeInput(sale.closes_at)}
          required
          invalid={field === "closes_at"}
        />
      </div>

      {/* ---- address ---- */}
      <div>
        <p className="text-sm font-semibold">Address</p>
        <p className="mt-1 text-sm text-ink-soft">
          Currently <span className="font-semibold text-ink">{sale.address}</span>. Leave this alone
          to keep it.
        </p>
        <div className="mt-2">
          <AddressField value={picked} onChange={setPicked} />
        </div>
        {addressChanging && watcherCount > 0 && (
          <p className="mt-2 rounded-[10px] bg-tangerine-50 px-3.5 py-2.5 text-sm text-tangerine-ink">
            If the new address is more than a few streets away, the{" "}
            {watcherCount === 1 ? "person who saved" : `${watcherCount} people who saved`} this sale
            will be told where it moved to.
          </p>
        )}
      </div>

      {/* ---- categories ---- */}
      <fieldset>
        <legend className="text-sm font-semibold">What kind of stuff</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((c) => (
            <label
              key={c.id}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-hair bg-panel px-3.5 text-sm font-semibold has-checked:border-pink has-checked:bg-pink-50 has-checked:text-pink-ink"
            >
              <input
                type="checkbox"
                name="category_ids"
                value={c.id}
                defaultChecked={selectedCategoryIds.includes(c.id)}
                className="size-4 accent-pink"
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* ---- free pile ---- */}
      <div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="free_pile"
            checked={freePile}
            onChange={(e) => setFreePile(e.target.checked)}
            className="mt-1 size-5 accent-pink"
          />
          <span className="text-sm">
            <span className="font-semibold">There&rsquo;s a free pile.</span> Shoppers see a green
            FREE badge on your pin.
          </span>
        </label>
        {freePile && (
          <input
            name="free_pile_note"
            defaultValue={sale.free_pile_note ?? ""}
            placeholder="Box of scrap lumber by the curb — take it."
            maxLength={140}
            className="mt-3 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 text-base outline-none focus:border-pink"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending="Saving…">Save changes</SubmitButton>
        <Link href={`/host/${sale.id}`} className="text-sm font-semibold text-muted hover:text-pink">
          Back to the sale
        </Link>
      </div>

      {state?.status === "error" && <FormError>{state.message}</FormError>}
      {state?.status === "saved" && (
        <p className="text-sm text-green-ink" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
