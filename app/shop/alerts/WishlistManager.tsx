"use client";

import { useActionState, useState, useTransition } from "react";

import { Field, FormError, SubmitButton } from "@/components/form";
import { MAX_RADIUS_MILES } from "@/lib/prefs";
import { addWishlist, removeWishlist, setWishlistActive, type Result } from "./actions";
import type { Category, Wishlist } from "@/lib/database.types";

function Row({ item, categories }: { item: Wishlist; categories: Category[] }) {
  const [pending, startTransition] = useTransition();
  const category = categories.find((c) => c.id === item.category_id);

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-[14px] border border-hair bg-panel px-4 py-3 ${
        item.active ? "" : "opacity-60"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{item.term}</span>
        <span className="ml-2 font-mono text-[13px] text-muted">
          within {item.max_miles} mi{category ? ` · ${category.label}` : ""}
        </span>
      </span>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void setWishlistActive(item.id, !item.active))}
        className="min-h-11 rounded-[10px] border border-hair px-3 text-sm font-semibold hover:border-pink hover:text-pink disabled:opacity-60"
      >
        {item.active ? "Pause" : "Resume"}
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void removeWishlist(item.id))}
        className="min-h-11 rounded-[10px] px-3 text-sm font-semibold text-muted hover:text-pink disabled:opacity-60"
      >
        Remove
      </button>
    </li>
  );
}

export function WishlistManager({
  items,
  categories,
  defaultMiles,
}: {
  items: Wishlist[];
  categories: Category[];
  defaultMiles: number;
}) {
  const [result, action] = useActionState<Result | null, FormData>(addWishlist, null);
  // Controlled, because React resets the form after an action runs — on a
  // rejection an uncontrolled field would blank out the text they just typed.
  const [term, setTerm] = useState("");

  return (
    <div>
      {items.length > 0 && (
        <ul className="mb-6 space-y-2">
          {items.map((item) => (
            <Row key={item.id} item={item} categories={categories} />
          ))}
        </ul>
      )}

      <form action={action} className="space-y-4">
        <Field
          label="What are you after?"
          name="term"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="cast iron skillet"
          hint="One thing per alert. We'll email you when a sale near you lists it."
          maxLength={60}
          invalid={result?.ok === false}
        />

        <div className="flex flex-wrap gap-4">
          <div>
            <label htmlFor="max_miles" className="block text-sm font-semibold">
              Within
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id="max_miles"
                name="max_miles"
                type="number"
                min={1}
                max={MAX_RADIUS_MILES}
                defaultValue={defaultMiles}
                className="w-24 rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 font-mono text-base outline-none focus:border-pink"
              />
              <span className="text-sm text-muted">miles</span>
            </div>
          </div>

          <div className="min-w-48 flex-1">
            <label htmlFor="category_id" className="block text-sm font-semibold">
              Category <span className="font-normal text-muted">(optional)</span>
            </label>
            <select
              id="category_id"
              name="category_id"
              defaultValue=""
              className="mt-1.5 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 text-base outline-none focus:border-pink"
            >
              <option value="">Any</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <SubmitButton pending="Adding…">Add alert</SubmitButton>

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
