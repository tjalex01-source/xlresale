import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { TagPin } from "@/components/TagPin";
import { SaleRealtime } from "@/components/SaleRealtime";
import { SALE_STATUS_META } from "@/lib/sale-status";
import { effectivePrice, formatMoney } from "@/lib/pricing";
import { formatHours, formatSaleDay, shouldShowStatus } from "@/lib/sale-time";
import { SaveButton } from "./SaveButton";

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: sale } = await supabase.from("public_sales").select("title, address").eq("id", id).maybeSingle();

  if (!sale) return { title: "Sale not found — XLResale" };
  return {
    title: `${sale.title} — XLResale`,
    description: `Garage sale at ${sale.address}. See what's there and when it's open.`,
  };
}

export default async function SalePage({ params }: PageProps<"/s/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // public_sales applies the address-precision policy on the way out (see
  // schema-additions-address-policy.sql) — exact only while the sale is open,
  // block level otherwise. Anon can't reach the underlying columns at all.
  const { data: publicSale } = await supabase
    .from("public_sales")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // A host previewing their own draft isn't in the public view, so fall back to
  // their own row. This is also what makes "view as a shopper" honest: the host
  // sees the public view when the sale is published.
  const { data: ownSale } = publicSale
    ? { data: null }
    : await supabase
        .from("host_sales")
        .select(
          "id, host_id, title, description, address, sale_date, opens_at, closes_at, time_zone, status, listing_paid, free_pile, free_pile_note, discount_percent, discount_active",
        )
        .eq("id", id)
        .maybeSingle();

  const sale = publicSale
    ? { ...publicSale, listing_paid: true }
    : ownSale
      ? { ...ownSale, location_is_exact: true }
      : null;

  if (!sale) notFound();

  const [{ data: photos }, { data: items }, { data: cats }, { data: host }, { data: watching }] =
    await Promise.all([
      supabase.from("sale_photos").select("id, storage_path").eq("sale_id", id).order("position"),
      supabase
        .from("sale_items")
        .select("id, name, price, item_discount_percent, exclude_from_bulk, is_sold")
        .eq("sale_id", id)
        .order("position"),
      supabase.from("sale_categories").select("categories(slug, label, color)").eq("sale_id", id),
      supabase.from("public_profiles").select("username, bio").eq("id", sale.host_id).maybeSingle(),
      user
        ? supabase
            .from("sale_watchers")
            .select("sale_id")
            .eq("sale_id", id)
            .eq("shopper_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const meta = SALE_STATUS_META[sale.status];
  const isHost = user?.id === sale.host_id;
  const publicBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/sale-photos`;
  const categories = (cats ?? []).flatMap((row) => (row.categories ? [row.categories] : []));
  const forSale = (items ?? []).filter((i) => !i.is_sold);
  const sold = (items ?? []).filter((i) => i.is_sold);

  return (
    <>
      <SaleRealtime saleId={sale.id} />

      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
        <Link href="/shop" className="ml-auto text-sm font-semibold hover:text-pink">
          Your saved sales
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-24">
        {isHost && !sale.listing_paid && (
          <p className="rounded-[10px] bg-tangerine-50 px-4 py-3 text-sm font-semibold text-tangerine-ink">
            This is your draft. Nobody else can see this page until it&rsquo;s published.
          </p>
        )}

        <div className="mt-5 flex items-start gap-4">
          <TagPin status={sale.status} size={44} />
          <div className="min-w-0">
            {shouldShowStatus(sale) && (
              <p className="font-mono text-sm font-bold" style={{ color: meta.textColor }}>
                {meta.label}
              </p>
            )}
            <h1 className="mt-1 font-display text-[clamp(1.9rem,4vw,2.75rem)] font-extrabold leading-[1.05] tracking-[-0.02em]">
              {sale.title}
            </h1>
          </div>
        </div>

        <p className="mt-4 font-mono text-sm text-ink-soft">
          {formatSaleDay(sale.sale_date)} · {formatHours(sale.opens_at, sale.closes_at)}
        </p>
        <p className="mt-1 text-ink-soft">{sale.address}</p>

        {!sale.location_is_exact && (
          <p className="mt-2 rounded-[10px] bg-panel px-3.5 py-2.5 text-sm text-ink-soft">
            The full address appears here half an hour before the sale opens. Hosts&rsquo; exact
            addresses stay private until then.
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {sale.discount_active && (
            <span className="rounded-full bg-tangerine px-2.5 py-0.5 font-mono text-xs font-bold text-ink">
              {sale.discount_percent}% OFF
            </span>
          )}
          {sale.free_pile && (
            <span className="rounded-full bg-green px-2.5 py-0.5 font-mono text-xs font-bold text-ink">
              FREE PILE
            </span>
          )}
          {categories.map((c) => (
            <span
              key={c.slug}
              className="rounded-full px-2.5 py-0.5 font-mono text-xs font-bold text-ink"
              style={{ backgroundColor: `${c.color}22` }}
            >
              {c.label}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <SaveButton saleId={sale.id} initialSaved={Boolean(watching)} signedIn={Boolean(user)} />
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sale.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas hover:opacity-90"
          >
            Directions
          </a>
        </div>

        {sale.free_pile && (
          <section className="mt-6 rounded-[16px] border border-green/30 bg-green-50 p-4">
            <p className="font-display text-lg font-bold">Free stuff here</p>
            {sale.free_pile_note && <p className="mt-1 text-sm text-ink-soft">{sale.free_pile_note}</p>}
          </section>
        )}

        {sale.description && (
          <section className="mt-8">
            <h2 className="font-display text-xl font-bold">What&rsquo;s the deal</h2>
            <p className="mt-2 whitespace-pre-line text-ink-soft">{sale.description}</p>
          </section>
        )}

        {photos && photos.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl font-bold">Photos</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p) => (
                <Image
                  key={p.id}
                  src={`${publicBase}/${p.storage_path}`}
                  alt=""
                  width={400}
                  height={400}
                  className="aspect-square w-full rounded-[14px] object-cover"
                />
              ))}
            </div>
          </section>
        )}

        {(items?.length ?? 0) > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl font-bold">Some of what&rsquo;s there</h2>
            <p className="mt-1 text-sm text-ink-soft">
              A few highlights, not the whole garage. Prices update live as the host drops them.
            </p>

            <ul className="mt-4 space-y-2">
              {forSale.map((item) => {
                const now = effectivePrice(
                  item.price,
                  item.item_discount_percent,
                  sale.discount_percent,
                  sale.discount_active,
                  item.exclude_from_bulk,
                );
                const cut = now < item.price;
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-[14px] border border-hair bg-panel px-4 py-3"
                  >
                    <span className="min-w-0 flex-1 font-semibold">{item.name}</span>
                    {cut && (
                      <span className="font-mono text-sm text-muted line-through">
                        {formatMoney(item.price)}
                      </span>
                    )}
                    <span
                      className={`font-mono font-bold ${cut ? "text-tangerine-ink" : "text-ink"}`}
                    >
                      {formatMoney(now)}
                    </span>
                  </li>
                );
              })}

              {sold.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-[14px] border border-hair px-4 py-3 opacity-55"
                >
                  <span className="min-w-0 flex-1 font-semibold line-through">{item.name}</span>
                  <span className="font-mono text-sm font-bold text-muted">Sold</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="font-display text-xl font-bold">Who&rsquo;s hosting</h2>
          {host?.username ? (
            <p className="mt-2 text-ink-soft">
              <Link
                href={`/u/${host.username}`}
                className="font-semibold text-ink underline underline-offset-4 hover:text-pink"
              >
                @{host.username}
              </Link>
              {host.bio && <span> — {host.bio}</span>}
            </p>
          ) : (
            <p className="mt-2 text-ink-soft">This host keeps their profile private.</p>
          )}
        </section>

        {/* Required by CLAUDE.md §6: we take the listing fee, never a cut, and
            no money moves through the platform — so say so where the deal
            actually happens. */}
        <p className="mt-8 rounded-[14px] border border-hair bg-panel px-4 py-3 text-sm text-ink-soft">
          Pay the host directly — cash, Venmo, whatever you agree. XLResale doesn&rsquo;t handle
          payments and never takes a cut. Meet safely and trust your gut.
        </p>
      </main>
    </>
  );
}
