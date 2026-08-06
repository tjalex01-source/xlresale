import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { SALE_STATUS_META, SALE_STATUS_ORDER } from "@/lib/sale-status";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-sale">
        Phase 1 · accounts
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
        XLResale
      </h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        Garage, yard, and estate sales — see which ones are open right now, and plan a
        route that reaches them before they close.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        {user ? (
          <>
            <Link
              href="/account"
              className="rounded-xl bg-sale px-4 py-3 font-display text-base font-bold text-white transition-opacity hover:opacity-90"
            >
              Your account
            </Link>
            <span className="font-mono text-[13px] text-ink-soft">
              Signed in as {user.email}
            </span>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-xl bg-sale px-4 py-3 font-display text-base font-bold text-white transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
        )}
      </div>

      <section className="mt-10 rounded-2xl border border-hair bg-panel p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">Pin states</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The <code className="font-mono text-[13px]">sale_status</code> lifecycle both
          sides read.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {SALE_STATUS_ORDER.map((status) => {
            const meta = SALE_STATUS_META[status];
            return (
              <li
                key={status}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium"
                style={{ backgroundColor: meta.tint, color: meta.color }}
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                {meta.label}
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-8 font-mono text-[13px] text-asphalt">
        Next: Phase 2 — hosts create a sale.
      </p>
    </main>
  );
}
