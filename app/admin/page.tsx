import Link from "next/link";
import type { Metadata } from "next";

import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { formatSaleDay } from "@/lib/sale-time";

export const metadata: Metadata = { title: "Admin — XLResale" };

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-[16px] border border-hair bg-panel px-4 py-3">
      <p className="font-mono text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-3xl font-extrabold">{value}</p>
      {hint && <p className="mt-0.5 text-sm text-ink-soft">{hint}</p>}
    </div>
  );
}

export default async function AdminOverview() {
  await requireAdmin();

  // Service role for counts across every row. requireAdmin() has already run,
  // so this is a privileged read behind a verified gate, not a way around RLS.
  const admin = createServiceClient();

  const [accounts, sales, published, watchers, finds, wishlists, recent] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("sales").select("id", { count: "exact", head: true }),
    admin.from("sales").select("id", { count: "exact", head: true }).eq("listing_paid", true),
    admin.from("sale_watchers").select("sale_id", { count: "exact", head: true }),
    admin.from("finds").select("id", { count: "exact", head: true }),
    admin.from("wishlists").select("id", { count: "exact", head: true }),
    admin
      .from("admin_actions")
      .select("action, target_type, target_id, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <>
      <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
        Overview
      </h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Accounts" value={accounts.count ?? 0} />
        <Stat
          label="Sales"
          value={sales.count ?? 0}
          hint={`${published.count ?? 0} on the map`}
        />
        <Stat label="Saved sales" value={watchers.count ?? 0} />
        <Stat label="Finds logged" value={finds.count ?? 0} />
        <Stat label="Wishlist terms" value={wishlists.count ?? 0} />
        <Stat
          label="Drafts"
          value={(sales.count ?? 0) - (published.count ?? 0)}
          hint="Unpublished"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/admin/users"
          className="inline-flex min-h-11 items-center rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas hover:opacity-90"
        >
          Manage accounts
        </Link>
        <Link
          href="/admin/sales"
          className="inline-flex min-h-11 items-center rounded-[10px] border border-hair px-4 text-sm font-semibold hover:border-pink hover:text-pink"
        >
          Manage sales
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold">Recent admin actions</h2>
        {recent.data && recent.data.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {recent.data.map((entry, i) => (
              <li
                key={`${entry.created_at}-${i}`}
                className="flex flex-wrap items-baseline gap-x-3 rounded-[12px] border border-hair bg-panel px-4 py-2.5"
              >
                <span className="font-mono text-sm font-bold">{entry.action}</span>
                <span className="font-mono text-[13px] text-muted">
                  {entry.target_type} {String(entry.target_id).slice(0, 8)}
                </span>
                <span className="ml-auto font-mono text-[13px] text-muted">
                  {formatSaleDay(entry.created_at.slice(0, 10))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-[14px] border border-hair bg-panel px-4 py-5 text-sm text-ink-soft">
            Nothing yet. Suspensions and deletions are recorded here.
          </p>
        )}
      </section>
    </>
  );
}
