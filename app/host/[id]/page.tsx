import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { SalePhotos } from "@/components/SalePhotos";
import { SALE_STATUS_META } from "@/lib/sale-status";
import { TagPin } from "@/components/TagPin";

export const metadata: Metadata = {
  title: "Your sale — XLResale",
};

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

export default async function SaleDraftPage({ params }: PageProps<"/host/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/host/${id}`);

  // RLS already restricts writes to the host, but a sale that's been paid for is
  // publicly readable — so ownership is checked explicitly before showing the
  // editing view.
  const { data: sale } = await supabase
    .from("sales")
    .select(
      "id, host_id, title, description, address, sale_date, opens_at, closes_at, status, listing_paid, free_pile, free_pile_note",
    )
    .eq("id", id)
    .maybeSingle();

  if (!sale || sale.host_id !== user.id) notFound();

  const { data: photos } = await supabase
    .from("sale_photos")
    .select("id, storage_path")
    .eq("sale_id", id)
    .order("position");

  const publicBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/sale-photos`;
  const meta = SALE_STATUS_META[sale.status];

  return (
    <>
      <header className="mx-auto w-full max-w-2xl px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
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

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <TagPin status={sale.status} size={24} />
            <span className="text-sm font-semibold">{meta.label}</span>
          </span>
          <span className="font-mono text-sm">
            {sale.sale_date} · {formatTime(sale.opens_at)}–{formatTime(sale.closes_at)}
          </span>
        </div>

        <p className="mt-3 text-ink-soft">{sale.address}</p>
        {sale.description && <p className="mt-4 leading-relaxed">{sale.description}</p>}

        {sale.free_pile && (
          <p className="mt-4 inline-block rounded-full bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-ink">
            Free pile{sale.free_pile_note ? ` — ${sale.free_pile_note}` : ""}
          </p>
        )}

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Photos</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Sales with photos get more visits. Add a few of the good stuff.
          </p>
          <div className="mt-4">
            <SalePhotos
              saleId={sale.id}
              hostId={user.id}
              initial={photos ?? []}
              publicBase={publicBase}
            />
          </div>
        </section>

        <section className="mt-12 rounded-[16px] border border-hair bg-panel p-5">
          <h2 className="font-display text-xl font-bold">Publish</h2>
          <p className="mt-2 text-ink-soft">
            $5 puts this on the map. Until then only you can see it.
          </p>
          <button
            type="button"
            disabled
            className="mt-5 inline-flex items-center rounded-[15px] bg-pink px-[26px] py-[15px] text-[19px] font-bold text-white opacity-50"
          >
            Publish for $5
          </button>
          <p className="mt-3 font-mono text-[13px] text-muted">Payment goes in next.</p>
        </section>
      </main>
    </>
  );
}
