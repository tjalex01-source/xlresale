import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { EditSaleForm, type EditableSale } from "./EditSaleForm";

export const metadata: Metadata = { title: "Edit your sale — XLResale" };

export default async function EditSalePage({ params }: PageProps<"/host/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/host/${id}/edit`);

  // host_sales is scoped to auth.uid(), so a row coming back is the ownership
  // proof and it carries the real address rather than the coarsened one.
  const [{ data: sale }, { data: cats }, { data: allCategories }, { count: watcherCount }] =
    await Promise.all([
      supabase
        .from("host_sales")
        .select(
          "id, title, description, address, sale_date, opens_at, closes_at, free_pile, free_pile_note, reschedule_count",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("sale_categories").select("category_id").eq("sale_id", id),
      supabase.from("categories").select("id, label").order("id"),
      supabase.from("sale_watchers").select("sale_id", { count: "exact", head: true }).eq("sale_id", id),
    ]);

  if (!sale) notFound();

  return (
    <>
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
        <Link href={`/host/${id}`} className="ml-auto text-sm font-semibold hover:text-pink">
          Back to the sale
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-24">
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
          Edit your sale
        </h1>
        <p className="mt-3 text-ink-soft">
          Move the date, change the address, fix the details. Rain happens &mdash; moving a sale is
          free and doesn&rsquo;t cost you a new listing.
        </p>

        <div className="mt-8">
          <EditSaleForm
            sale={sale as EditableSale}
            categories={allCategories ?? []}
            selectedCategoryIds={(cats ?? []).map((c) => c.category_id)}
            watcherCount={watcherCount ?? 0}
          />
        </div>
      </main>
    </>
  );
}
