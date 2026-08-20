import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { SalePhotos } from "@/components/SalePhotos";
import { TagPin } from "@/components/TagPin";
import { SALE_STATUS_META } from "@/lib/sale-status";
import { GoLiveCard } from "./GoLiveCard";
import { FeaturedItems } from "./FeaturedItems";
import { FreePileToggle } from "./FreePileToggle";

export const metadata: Metadata = { title: "Your sale — XLResale" };

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-[22px] bg-panel p-5 shadow-card">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function SaleDashboard({ params }: PageProps<"/host/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/host/${id}`);

  // Ownership is checked explicitly: a paid sale is publicly readable, and this
  // is the editing view, not the public one.
  const { data: sale } = await supabase
    // host_sales is scoped to auth.uid() and always returns the real address.
    .from("host_sales")
    .select(
      "id, host_id, title, description, address, sale_date, opens_at, closes_at, status, listing_paid, free_pile, free_pile_note, discount_percent, discount_active",
    )
    .eq("id", id)
    .maybeSingle();

  if (!sale || sale.host_id !== user.id) notFound();

  const [{ data: photos }, { data: items }, { count: watcherCount }] = await Promise.all([
    supabase.from("sale_photos").select("id, storage_path").eq("sale_id", id).order("position"),
    supabase
      .from("sale_items")
      .select("id, name, price, item_discount_percent, exclude_from_bulk, is_sold")
      .eq("sale_id", id)
      .order("position"),
    supabase.from("sale_watchers").select("*", { count: "exact", head: true }).eq("sale_id", id),
  ]);

  const publicBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/sale-photos`;
  const meta = SALE_STATUS_META[sale.status];

  return (
    <>
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
        <Link href={`/s/${id}`} className="ml-auto text-sm font-semibold hover:text-pink">
          View as a shopper
        </Link>
        <Link href="/host" className="text-sm font-semibold hover:text-pink">
          All your sales
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-24">
        {!sale.listing_paid && (
          <p className="rounded-[10px] bg-tangerine-50 px-4 py-3 text-sm font-semibold text-tangerine-ink">
            Draft — not on the map yet.
          </p>
        )}

        <h1 className="mt-5 font-display text-[clamp(1.9rem,4vw,2.75rem)] font-extrabold leading-[1.05] tracking-[-0.02em]">
          {sale.title}
        </h1>
        <p className="mt-3 font-mono text-sm text-ink-soft">
          {sale.sale_date} · {formatTime(sale.opens_at)}–{formatTime(sale.closes_at)}
        </p>
        <p className="mt-1 text-ink-soft">{sale.address}</p>

        <div className="mt-6">
          <GoLiveCard saleId={sale.id} status={sale.status} watcherCount={watcherCount ?? 0} />
        </div>

        <Card
          title="How your pin looks"
          hint="What a shopper sees on the map right now."
        >
          <div className="flex items-center gap-4 rounded-[16px] border border-hair bg-canvas p-4">
            <TagPin status={sale.status} size={40} />
            <div>
              <p className="font-display text-lg font-bold leading-tight">{sale.title}</p>
              <p className="mt-0.5 text-sm" style={{ color: meta.textColor }}>
                {meta.label}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sale.discount_active && (
                  <span className="rounded-full bg-tangerine px-2.5 py-0.5 font-mono text-xs font-bold text-ink">
                    {sale.discount_percent}% OFF
                  </span>
                )}
                {sale.free_pile && (
                  <span className="rounded-full bg-green px-2.5 py-0.5 font-mono text-xs font-bold text-ink">
                    FREE
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Your featured items"
          hint="Your ten or twenty best. Tap one sold and it drops off the map."
        >
          <FeaturedItems
            saleId={sale.id}
            items={items ?? []}
            discountPercent={sale.discount_percent}
            discountActive={sale.discount_active}
          />
        </Card>

        <Card title="Free pile">
          <FreePileToggle
            saleId={sale.id}
            on={sale.free_pile}
            note={sale.free_pile_note ?? ""}
          />
        </Card>

        <Card title="Photos" hint="Sales with photos get more visits.">
          <SalePhotos
            saleId={sale.id}
            hostId={user.id}
            initial={photos ?? []}
            publicBase={publicBase}
          />
        </Card>

        {!sale.listing_paid && (
          <Card title="Publish" hint="$5 puts this on the map. Until then only you can see it.">
            <button
              type="button"
              disabled
              className="inline-flex items-center rounded-[15px] bg-pink px-[26px] py-[15px] text-[19px] font-bold text-white opacity-50"
            >
              Publish for $5
            </button>
            <p className="mt-3 font-mono text-[13px] text-muted">Payment goes in later.</p>
          </Card>
        )}
      </main>
    </>
  );
}
