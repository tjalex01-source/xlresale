import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { SaleCard } from "@/components/SaleCard";
import { EmptyState } from "@/components/EmptyState";
import { isPast } from "@/lib/sale-time";
import type { SaleStatus } from "@/lib/database.types";

export const metadata: Metadata = { title: "Shopping — XLResale" };

/** A saved sale, as the join below returns it. */
type SavedSale = {
  id: string;
  title: string;
  address: string;
  sale_date: string;
  opens_at: string;
  closes_at: string;
  status: SaleStatus;
  free_pile: boolean;
  discount_percent: number;
  discount_active: boolean;
};

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {action}
      </div>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function ShopPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shop");

  const [{ data: profile }, { data: saved }, { data: nearby }, { count: unseenAlerts }, { count: findCount }] =
    await Promise.all([
      supabase.from("profiles").select("home_address").eq("id", user.id).single(),
      supabase
        .from("sale_watchers")
        .select(
          "sales(id, title, address, sale_date, opens_at, closes_at, status, free_pile, discount_percent, discount_active)",
        )
        .eq("shopper_id", user.id),
      // Reads the caller's own home point server-side; see sales_near_me() in
      // schema-additions-buyer.sql. Returns nothing until a home is set.
      supabase.rpc("sales_near_me", { in_days: 7 }),
      supabase
        .from("wishlist_alerts")
        .select("*", { count: "exact", head: true })
        .eq("shopper_id", user.id)
        .is("seen_at", null),
      supabase.from("finds").select("*", { count: "exact", head: true }).eq("finder_id", user.id),
    ]);

  const savedSales: SavedSale[] = (saved ?? [])
    .flatMap((row) => (row.sales ? [row.sales as SavedSale] : []))
    .sort((a, b) => a.sale_date.localeCompare(b.sale_date));

  const savedUpcoming = savedSales.filter((s) => !isPast(s.sale_date));
  const savedPast = savedSales.filter((s) => isPast(s.sale_date));

  // Anything already saved is dropped from the browse list — it's on the list
  // above, and showing it twice makes "saved" feel like it did nothing.
  const savedIds = new Set(savedSales.map((s) => s.id));
  const toBrowse = (nearby ?? []).filter((s) => !savedIds.has(s.id));

  const hasHome = Boolean(profile?.home_address);

  return (
    <>
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
        <Link href="/account" className="ml-auto text-sm font-semibold hover:text-pink">
          Account
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-24">
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
          Shopping
        </h1>
        <p className="mt-3 text-ink-soft">
          Sales you&rsquo;ve saved, what&rsquo;s coming up near you, and what you&rsquo;re hunting for.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/map"
            className="inline-flex min-h-11 items-center rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas hover:opacity-90"
          >
            Open the map
          </Link>
          <Link
            href="/route"
            className="inline-flex min-h-11 items-center rounded-[10px] border border-hair bg-panel px-4 text-sm font-semibold hover:border-pink hover:text-pink"
          >
            Plan a route
          </Link>
          <Link
            href="/shop/alerts"
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-hair bg-panel px-4 text-sm font-semibold hover:border-pink hover:text-pink"
          >
            What you&rsquo;re looking for
            {unseenAlerts ? (
              <span className="rounded-full bg-pink px-2 py-0.5 font-mono text-xs font-bold text-white">
                {unseenAlerts}
              </span>
            ) : null}
          </Link>
          <Link
            href="/shop/finds"
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-hair bg-panel px-4 text-sm font-semibold hover:border-pink hover:text-pink"
          >
            Your finds
            {findCount ? (
              <span className="font-mono text-xs text-muted">{findCount}</span>
            ) : null}
          </Link>
        </div>

        {!hasHome && (
          <p className="mt-6 rounded-[14px] bg-tangerine-50 px-4 py-3 text-sm text-tangerine-ink">
            Set where you shop from and how far you&rsquo;ll drive, and this page fills up.{" "}
            <Link href="/account" className="font-bold underline underline-offset-4">
              Set your location
            </Link>
          </p>
        )}

        <Section
          title="Saved"
          hint={
            savedUpcoming.length > 0
              ? "The host can see how many people have saved their sale — it's what tells them not to pack up early."
              : undefined
          }
        >
          {savedUpcoming.length > 0 ? (
            <ul className="space-y-3">
              {savedUpcoming.map((sale) => (
                <SaleCard key={sale.id} sale={sale} />
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing saved yet">
              Save a sale and it lands here, with the host&rsquo;s live status attached.
            </EmptyState>
          )}
        </Section>

        <Section
          title="Near you"
          hint={hasHome ? "The next seven days, closest first." : undefined}
        >
          {toBrowse.length > 0 ? (
            <ul className="space-y-3">
              {toBrowse.map((sale) => (
                <SaleCard key={sale.id} sale={sale} distanceMiles={sale.distance_miles} />
              ))}
            </ul>
          ) : (
            <p className="rounded-[14px] border border-hair bg-panel px-4 py-6 text-center text-sm text-ink-soft">
              {hasHome
                ? "No sales listed near you in the next week. Widen your radius on your account page, or check back — Saturday fills up fast."
                : "Set your location to see what's nearby."}
            </p>
          )}
        </Section>

        {savedPast.length > 0 && (
          <Section title="Already happened">
            <ul className="space-y-3 opacity-70">
              {savedPast.map((sale) => (
                <SaleCard key={sale.id} sale={sale} />
              ))}
            </ul>
          </Section>
        )}
      </main>
    </>
  );
}
