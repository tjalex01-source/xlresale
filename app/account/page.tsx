import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { FOCUS_OPTIONS, type ProfileFocus } from "@/lib/focus";
import { FocusChooser } from "@/components/FocusChooser";
import { Wordmark } from "@/components/Wordmark";
import { changeFocus, signOut } from "./actions";
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

type CardKey = "shopping" | "sales" | "home" | "profile" | "about" | "focus" | "password" | "data";

/**
 * The page in the order the person's own answer implies (lib/focus.ts).
 *
 * Every list holds every card. The answer moves things up and down and does not
 * remove anything — a shopper who decides to hold a sale finds "Your sales"
 * further down the page they already know, not somewhere new.
 *
 * `both` is the one that matters, because it's the answer most people will give:
 * shopping first, selling immediately under it. Not "show them everything at
 * once", which is the same undifferentiated page this replaces.
 */
const CARD_ORDER: Record<ProfileFocus, CardKey[]> = {
  shopping: ["shopping", "home", "profile", "about", "sales", "focus", "password", "data"],
  selling: ["sales", "profile", "about", "shopping", "home", "focus", "password", "data"],
  both: ["shopping", "sales", "home", "profile", "about", "focus", "password", "data"],
};

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
      .select("username, display_name, bio, is_public, home_address, focus")
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

  const focus = profile?.focus ?? null;
  // Never asked — an account made before the chooser existed. Buyer-first is
  // the safe assumption, and the "What brings you here" card below is sitting
  // right there to correct it.
  const order = CARD_ORDER[focus ?? "both"];

  const cards: Record<CardKey, React.ReactNode> = {
    shopping: (
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
    ),

    sales: (
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
    ),

    profile: (
      <Card title="Public profile">
        <HandleForm initial={profile?.username ?? null} />
      </Card>
    ),

    about: (
      <Card title="About you">
        <ProfileForm
          displayName={profile?.display_name ?? ""}
          bio={profile?.bio ?? ""}
          isPublic={profile?.is_public ?? true}
        />
      </Card>
    ),

    home: (
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
    ),

    focus: (
      <Card title="What brings you here">
        <p className="mt-1 text-sm text-ink-soft">
          Sets what this page shows first, and where signing in drops you.
          {focus
            ? ""
            : " You haven't picked yet, so it's showing you the shopping side."}
        </p>
        <FocusChooser action={changeFocus} current={focus} variant="compact" />
      </Card>
    ),

    password: (
      <Card title="Password">
        <p className="mt-1 text-sm text-ink-soft">Change the password you sign in with.</p>
        <Link
          href="/account/password"
          className="mt-4 inline-flex min-h-11 items-center rounded-[10px] border border-hair px-4 text-sm font-semibold hover:border-pink hover:text-pink"
        >
          Set a new password
        </Link>
      </Card>
    ),

    data: (
      <Card title="Your data">
        <p className="mt-1 text-sm text-ink-soft">
          What we collect and why, and how to remove it.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center rounded-[10px] border border-hair px-4 text-sm font-semibold hover:border-pink hover:text-pink"
          >
            Privacy
          </Link>
          <Link
            href="/account/delete"
            className="inline-flex min-h-11 items-center rounded-[10px] px-4 text-sm font-semibold text-muted hover:text-pink"
          >
            Delete my account
          </Link>
        </div>
      </Card>
    ),
  };

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
        {focus && (
          <p className="mt-1 text-sm text-muted">
            Here for {FOCUS_OPTIONS.find((o) => o.value === focus)!.label.toLowerCase()}.
          </p>
        )}

        {params.updated === "password" && (
          <p
            className="mt-5 rounded-[10px] bg-green-50 px-3.5 py-2.5 text-sm text-green-ink"
            role="status"
          >
            Password updated.
          </p>
        )}

        {/* Pinned above the ordering: being an admin isn't one of the three
            answers, and burying it under someone's shopping preferences would
            be a small daily annoyance for the one person who has it. */}
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

        {order.map((key) => (
          <Fragment key={key}>{cards[key]}</Fragment>
        ))}

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
