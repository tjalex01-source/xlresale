import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { SaleCard } from "@/components/SaleCard";
import { formatSaleDay } from "@/lib/sale-time";
import type { SaleStatus } from "@/lib/database.types";
import { AlertPrefs } from "./AlertPrefs";
import { WishlistManager } from "./WishlistManager";
import { markAlertsSeen } from "./actions";

export const metadata: Metadata = { title: "What you're looking for — XLResale" };

type AlertSale = {
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

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-[22px] bg-panel p-5 shadow-card">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AlertsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shop/alerts");

  const [{ data: wishlists }, { data: categories }, { data: prefs }, { data: alerts }] =
    await Promise.all([
      supabase
        .from("wishlists")
        .select("*")
        .eq("shopper_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("id"),
      supabase
        .from("notification_prefs")
        .select("email_enabled, radius_miles, bulk_lots_enabled, bulk_lot_categories")
        .eq("profile_id", user.id)
        .single(),
      supabase
        .from("wishlist_alerts")
        .select(
          "id, matched_term, seen_at, created_at, sales(id, title, address, sale_date, opens_at, closes_at, status, free_pile, discount_percent, discount_active)",
        )
        .eq("shopper_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const unseen = (alerts ?? []).filter((a) => !a.seen_at).length;

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
          What you&rsquo;re looking for
        </h1>
        <p className="mt-3 text-ink-soft">
          Tell us the thing you&rsquo;d drive across town for. When someone lists it near you,
          you&rsquo;ll hear about it.
        </p>

        {(alerts?.length ?? 0) > 0 && (
          <Card
            title="Matches"
            hint={unseen > 0 ? `${unseen} you haven't looked at yet.` : "Everything you've been sent."}
          >
            <ul className="space-y-3">
              {(alerts ?? []).flatMap((alert) => {
                const sale = alert.sales as AlertSale | null;
                if (!sale) return [];
                return [
                  <div key={alert.id}>
                    {alert.matched_term && (
                      <p className="mb-1 font-mono text-[13px] text-muted">
                        matched &ldquo;{alert.matched_term}&rdquo; · {formatSaleDay(alert.created_at.slice(0, 10))}
                        {!alert.seen_at && (
                          <span className="ml-2 rounded-full bg-pink px-2 py-0.5 text-xs font-bold text-white">
                            new
                          </span>
                        )}
                      </p>
                    )}
                    <ul>
                      <SaleCard sale={sale} />
                    </ul>
                  </div>,
                ];
              })}
            </ul>

            {unseen > 0 && (
              <form action={markAlertsSeen} className="mt-4">
                <button
                  type="submit"
                  className="min-h-11 rounded-[10px] border border-hair px-4 text-sm font-semibold hover:border-pink hover:text-pink"
                >
                  Mark all as read
                </button>
              </form>
            )}
          </Card>
        )}

        <Card title="Your alerts">
          <WishlistManager
            items={wishlists ?? []}
            categories={categories ?? []}
            defaultMiles={prefs?.radius_miles ?? 5}
          />
        </Card>

        <Card title="How we reach you">
          <AlertPrefs
            emailEnabled={prefs?.email_enabled ?? true}
            bulkLotsEnabled={prefs?.bulk_lots_enabled ?? false}
            bulkLotCategories={prefs?.bulk_lot_categories ?? []}
            categories={categories ?? []}
          />
        </Card>
      </main>
    </>
  );
}
