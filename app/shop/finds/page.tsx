import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { formatMoney } from "@/lib/pricing";
import { FindsManager } from "./FindsManager";

export const metadata: Metadata = { title: "Your finds — XLResale" };

export default async function FindsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shop/finds");

  const [{ data: profile }, { data: finds }, { data: saved }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    supabase
      .from("finds")
      .select("*")
      .eq("finder_id", user.id)
      .order("found_on", { ascending: false }),
    supabase
      .from("sale_watchers")
      .select("sales(id, title, sale_date)")
      .eq("shopper_id", user.id),
  ]);

  const savedSales = (saved ?? [])
    .flatMap((row) => (row.sales ? [row.sales as { id: string; title: string; sale_date: string }] : []))
    .sort((a, b) => b.sale_date.localeCompare(a.sale_date))
    .map(({ id, title }) => ({ id, title }));

  // Totals across every find that has both numbers — the "was it worth the
  // Saturday" answer, which is the reason to keep logging them.
  const scored = (finds ?? []).filter((f) => f.price_paid !== null && f.est_value !== null);
  const spent = scored.reduce((sum, f) => sum + (f.price_paid ?? 0), 0);
  const worth = scored.reduce((sum, f) => sum + (f.est_value ?? 0), 0);

  // Server-side so it matches the database's idea of today rather than a
  // browser clock in another timezone.
  const today = new Date().toLocaleDateString("en-CA");

  return (
    <>
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
        <Link href="/shop" className="ml-auto text-sm font-semibold hover:text-pink">
          Shopping
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-24">
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
          Your finds
        </h1>
        <p className="mt-3 text-ink-soft">
          The stuff you&rsquo;re glad you got up early for.
        </p>

        {scored.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-[16px] border border-hair bg-panel px-4 py-3">
              <p className="font-mono text-xs uppercase tracking-wide text-muted">Spent</p>
              <p className="font-display text-2xl font-extrabold">{formatMoney(spent)}</p>
            </div>
            <div className="rounded-[16px] border border-hair bg-panel px-4 py-3">
              <p className="font-mono text-xs uppercase tracking-wide text-muted">Worth</p>
              <p className="font-display text-2xl font-extrabold">{formatMoney(worth)}</p>
            </div>
            {worth > spent && (
              <div className="rounded-[16px] border border-green/30 bg-green-50 px-4 py-3">
                <p className="font-mono text-xs uppercase tracking-wide text-green-ink">Ahead by</p>
                <p className="font-display text-2xl font-extrabold text-green-ink">
                  {formatMoney(worth - spent)}
                </p>
              </div>
            )}
          </div>
        )}

        <section className="mt-8">
          <FindsManager
            finds={finds ?? []}
            username={profile?.username ?? null}
            savedSales={savedSales}
            today={today}
          />
        </section>
      </main>
    </>
  );
}
