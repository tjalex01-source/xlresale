import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { DeleteAccountForm } from "./DeleteAccountForm";

export const metadata: Metadata = { title: "Delete your account — XLResale" };

export default async function DeleteAccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/delete");

  // Shown BEFORE they confirm, not after. Someone deleting an account should
  // find out here that it takes three live sales with it, not by discovering
  // the pins gone.
  const { data: footprint } = await supabase.rpc("my_account_footprint");
  const f = footprint?.[0];

  const items = [
    { label: "sales you're hosting", n: Number(f?.sales_count ?? 0) },
    { label: "saved sales", n: Number(f?.saved_count ?? 0) },
    { label: "finds you've logged", n: Number(f?.finds_count ?? 0) },
    { label: "alerts you're watching for", n: Number(f?.wishlists_count ?? 0) },
    { label: "devices set up for notifications", n: Number(f?.devices_count ?? 0) },
  ].filter((i) => i.n > 0);

  return (
    <>
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
        <Link href="/account" className="ml-auto text-sm font-semibold hover:text-pink">
          Back to your account
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-24">
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
          Delete your account
        </h1>
        <p className="mt-3 text-ink-soft">
          This removes your account and everything on it, straight away. There&rsquo;s no undo and
          we don&rsquo;t keep a copy.
        </p>

        <section className="mt-8 rounded-[22px] bg-panel p-5 shadow-card">
          <h2 className="font-display text-xl font-bold">What goes with it</h2>
          {items.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-ink-soft">
              {items.map((i) => (
                <li key={i.label}>
                  <span className="font-mono font-bold text-ink">{i.n}</span> {i.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-ink-soft">
              Nothing much &mdash; your profile and sign-in details.
            </p>
          )}

          {Number(f?.sales_count ?? 0) > 0 && (
            <p className="mt-4 rounded-[10px] bg-tangerine-50 px-3.5 py-2.5 text-sm text-tangerine-ink">
              Your sales come off the map immediately, including any that people have saved. If you
              only want a sale hidden for now, take it off the map from its dashboard instead
              &mdash; that&rsquo;s reversible.
            </p>
          )}

          <p className="mt-4 text-sm text-muted">
            Signed in as <span className="font-mono">{user.email}</span>.
          </p>
        </section>

        <section className="mt-6 rounded-[22px] border border-pink/40 bg-panel p-5">
          <DeleteAccountForm />
        </section>

        <p className="mt-6 text-sm text-ink-soft">
          Changed your mind?{" "}
          <Link href="/account" className="font-semibold text-ink underline underline-offset-4">
            Go back
          </Link>
          .
        </p>
      </main>
    </>
  );
}
