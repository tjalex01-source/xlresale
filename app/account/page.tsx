import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { signOut } from "./actions";
import { HandleForm } from "./HandleForm";
import { HomeForm } from "./HomeForm";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = {
  title: "Your account — XLResale",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-[22px] bg-panel p-5 shadow-card">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const [{ data: profile }, { data: prefs }, { count: saleCount }, { data: isAdmin }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name, bio, is_public, home_address")
      .eq("id", user.id)
      .single(),
    supabase.from("notification_prefs").select("radius_miles").eq("profile_id", user.id).single(),
    supabase
      .from("sales")
      // Named column, not *: anon and authenticated no longer hold SELECT on
      // every column of sales, and PostgREST expands * before checking.
      .select("id", { count: "exact", head: true })
      .eq("host_id", user.id),
    // Returns false for everyone else, so the card below simply doesn't render
    // — /admin is a 404 to non-admins either way.
    supabase.rpc("is_admin", {}),
  ]);

  return (
    <>
      <header className="mx-auto w-full max-w-2xl px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-24">
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
          Your account
        </h1>
        <p className="mt-3 font-mono text-sm text-ink-soft">{user.email}</p>

        {params.updated === "password" && (
          <p
            className="mt-5 rounded-[10px] bg-green-50 px-3.5 py-2.5 text-sm text-green-ink"
            role="status"
          >
            Password updated.
          </p>
        )}

        {isAdmin && (
          <Card title="Admin">
            <p className="mt-1 text-sm text-ink-soft">
              Accounts, sales, and the record of what&rsquo;s been actioned.
            </p>
            <Link
              href="/admin"
              className="mt-4 inline-flex min-h-11 items-center rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas hover:opacity-90"
            >
              Open admin
            </Link>
          </Card>
        )}

        <Card title="Shopping">
          <p className="mt-1 text-sm text-ink-soft">
            Sales you&rsquo;ve saved, what&rsquo;s near you this week, your alerts, and your finds.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/shop"
              className="inline-flex min-h-11 items-center rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas hover:opacity-90"
            >
              Go shopping
            </Link>
            <Link
              href="/shop/alerts"
              className="inline-flex min-h-11 items-center rounded-[10px] border border-hair px-4 text-sm font-semibold hover:border-pink hover:text-pink"
            >
              What you&rsquo;re looking for
            </Link>
            <Link
              href="/shop/finds"
              className="inline-flex min-h-11 items-center rounded-[10px] border border-hair px-4 text-sm font-semibold hover:border-pink hover:text-pink"
            >
              Your finds
            </Link>
          </div>
        </Card>

        <Card title="Public profile">
          <HandleForm initial={profile?.username ?? null} />
        </Card>

        <Card title="About you">
          <ProfileForm
            displayName={profile?.display_name ?? ""}
            bio={profile?.bio ?? ""}
            isPublic={profile?.is_public ?? true}
          />
        </Card>

        <Card title="Where you shop from">
          <p className="mt-1 text-sm text-ink-soft">
            The centre of &ldquo;near me&rdquo; and where your route starts. Kept private &mdash;
            it never appears on your public profile.
          </p>
          <HomeForm
            currentAddress={profile?.home_address ?? null}
            radiusMiles={prefs?.radius_miles ?? 5}
          />
        </Card>

        <Card title="Your sales">
          {saleCount && saleCount > 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              You have{" "}
              <span className="font-mono text-ink">
                {saleCount} {saleCount === 1 ? "sale" : "sales"}
              </span>
              . Open the dashboard to go live, drop prices, or mark things sold.
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">You haven&rsquo;t listed a sale yet.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/host/new"
              className="inline-flex min-h-11 items-center rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas hover:opacity-90"
            >
              List a sale
            </Link>
            {/* The seller dashboard had no route into it from anywhere. */}
            <Link
              href="/host"
              className="inline-flex min-h-11 items-center rounded-[10px] border border-hair px-4 text-sm font-semibold hover:border-pink hover:text-pink"
            >
              Seller dashboard
            </Link>
          </div>
        </Card>

        <Card title="Password">
          <p className="mt-1 text-sm text-ink-soft">Change the password you sign in with.</p>
          <Link
            href="/account/password"
            className="mt-4 inline-flex min-h-11 items-center rounded-[10px] border border-hair px-4 text-sm font-semibold hover:border-pink hover:text-pink"
          >
            Set a new password
          </Link>
        </Card>

        <form action={signOut} className="mt-8">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-[10px] border border-hair bg-panel px-4 text-sm font-semibold hover:border-pink hover:text-pink"
          >
            Sign out
          </button>
        </form>
      </main>
    </>
  );
}
