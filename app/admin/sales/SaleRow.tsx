"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { deleteSale, setSalePublished } from "../actions";
import { SALE_STATUS_META } from "@/lib/sale-status";
import type { SaleStatus } from "@/lib/database.types";

export interface AdminSale {
  id: string;
  title: string;
  address: string;
  saleDate: string;
  status: SaleStatus;
  published: boolean;
  hostHandle: string | null;
  hostId: string;
  watcherCount: number;
}

export function SaleRow({ sale }: { sale: AdminSale }) {
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  if (gone) return null;

  return (
    <li className="rounded-[16px] border border-hair bg-panel p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <Link href={`/s/${sale.id}`} className="font-display text-lg font-bold hover:text-pink">
              {sale.title}
            </Link>
            {!sale.published && (
              <span className="rounded-full bg-tangerine-50 px-2 py-0.5 font-mono text-xs font-bold text-tangerine-ink">
                OFF THE MAP
              </span>
            )}
          </p>

          <p
            className="mt-1 font-mono text-[13px]"
            style={{ color: SALE_STATUS_META[sale.status].textColor }}
          >
            {SALE_STATUS_META[sale.status].label}
          </p>

          <p className="mt-1 font-mono text-[13px] text-ink-soft">
            {sale.saleDate} · {sale.watcherCount} saved ·{" "}
            {sale.hostHandle ? `@${sale.hostHandle}` : sale.hostId.slice(0, 8)}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted">{sale.address}</p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await setSalePublished(sale.id, !sale.published);
                setMessage(result.ok ? (result.message ?? "Done.") : result.message);
              })
            }
            className="min-h-11 rounded-[10px] border border-hair px-3 text-sm font-semibold hover:border-pink hover:text-pink disabled:opacity-50"
          >
            {sale.published ? "Take off map" : "Put back"}
          </button>

          {confirmingDelete ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteSale(sale.id);
                    if (result.ok) setGone(true);
                    else setMessage(result.message);
                  })
                }
                className="min-h-11 rounded-[10px] bg-pink px-3 text-sm font-bold text-white disabled:opacity-50"
              >
                Delete for good
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="min-h-11 rounded-[10px] px-3 text-sm font-semibold text-muted hover:text-ink"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="min-h-11 rounded-[10px] px-3 text-sm font-semibold text-muted hover:text-pink"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <p className="mt-3 rounded-[10px] bg-pink-50 px-3.5 py-2.5 text-sm text-pink-ink">
          Deletes the sale, its photos, items, and everyone&rsquo;s saves of it. Taking it off the
          map is reversible — this isn&rsquo;t.
        </p>
      )}

      {message && (
        <p className="mt-3 text-sm text-ink-soft" role="status">
          {message}
        </p>
      )}
    </li>
  );
}
