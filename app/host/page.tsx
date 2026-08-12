import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { TagPin } from "@/components/TagPin";
import { EmptyState } from "@/components/EmptyState";
import { SALE_STATUS_META } from "@/lib/sale-status";

export const metadata: Metadata = { title: "Your sales — XLResale" };

export default async function HostIndex() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/host");

  const { data: sales } = await supabase
    .from("sales")
    .select("id, title, sale_date, status, listing_paid, discount_active, discount_percent")
    .eq("host_id", user.id)
    .order("sale_date", { ascending: false });

  return (
    <>
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
        <Link href="/account" className="ml-auto text-sm font-semibold hover:text-pink">
          Your account
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-24">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
            Your sales
          </h1>
          <Link
            href="/host/new"
            className="ml-auto inline-flex min-h-11 items-center rounded-[10px] bg-pink px-5 font-display text-lg font-bold text-white hover:-translate-y-0.5"
          >
            List a sale
          </Link>
        </div>

        {sales && sales.length > 0 ? (
          <ul className="mt-8 space-y-3">
            {sales.map((sale) => {
              const meta = SALE_STATUS_META[sale.status];
              return (
                <li key={sale.id}>
                  <Link
                    href={`/host/${sale.id}`}
                    className="flex items-center gap-4 rounded-[22px] bg-panel p-5 shadow-card transition-transform hover:-translate-y-0.5"
                  >
                    <TagPin status={sale.status} size={32} />
                    <span className="min-w-0">
                      <span className="block font-display text-lg font-bold leading-snug">
                        {sale.title}
                      </span>
                      <span className="mt-0.5 block font-mono text-sm text-muted">
                        {sale.sale_date}
                      </span>
                    </span>
                    <span className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
                      {!sale.listing_paid && (
                        <span className="rounded-full bg-tangerine-50 px-2.5 py-1 font-mono text-xs font-bold text-tangerine-ink">
                          DRAFT
                        </span>
                      )}
                      {sale.discount_active && (
                        <span className="rounded-full bg-tangerine px-2.5 py-1 font-mono text-xs font-bold text-ink">
                          {sale.discount_percent}% OFF
                        </span>
                      )}
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-bold"
                        style={{ backgroundColor: meta.tint, color: meta.textColor }}
                      >
                        {meta.label}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="No sales yet"
            action={
              <Link
                href="/host/new"
                className="inline-flex min-h-11 items-center rounded-[10px] bg-pink px-5 font-display text-lg font-bold text-white"
              >
                List your first sale
              </Link>
            }
          >
            Clearing out the garage? Five dollars puts you on the map.
          </EmptyState>
        )}
      </main>
    </>
  );
}
