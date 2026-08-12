import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { SaleForm } from "./SaleForm";

export const metadata: Metadata = {
  title: "List a sale — XLResale",
};

export default async function NewSalePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/host/new");

  const { data: categories } = await supabase
    .from("categories")
    .select("id, label")
    .order("id");

  return (
    <>
      <header className="mx-auto w-full max-w-2xl px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-24">
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
          List your sale
        </h1>
        <p className="mt-3 text-lg text-ink-soft">
          Takes a couple of minutes. You can change any of it later.
        </p>

        <div className="mt-8">
          <SaleForm categories={categories ?? []} />
        </div>
      </main>
    </>
  );
}
