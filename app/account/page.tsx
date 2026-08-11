import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { signOut } from "./actions";
import { DisplayNameForm } from "./DisplayNameForm";

export const metadata: Metadata = {
  title: "Your account — XLResale",
};

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, home_address")
    .eq("id", user.id)
    .single();

  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select("radius_miles")
    .eq("profile_id", user.id)
    .single();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/" className="inline-block hover:text-pink">
        <Wordmark className="!text-xl" />
      </Link>

      <h1 className="mt-8 font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
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

      <section className="mt-8 rounded-[22px] bg-panel p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">Public profile</h2>
        {profile?.username ? (
          <p className="mt-2 text-sm text-ink-soft">
            Your handle is{" "}
            <span className="font-mono text-[13px] text-ink">@{profile.username}</span> —{" "}
            <Link
              href={`/u/${profile.username}`}
              className="font-semibold text-ink underline underline-offset-4 hover:text-pink"
            >
              view your profile
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">
            You don&rsquo;t have a handle yet.
          </p>
        )}
        <DisplayNameForm initial={profile?.display_name ?? ""} />
      </section>

      <section className="mt-4 rounded-[22px] bg-panel p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">Where you shop from</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Your starting point for routes, and the centre of &ldquo;near me.&rdquo;
        </p>
        <p className="mt-3 text-sm">
          {profile?.home_address ?? (
            <span className="text-grey-ink">Not set yet — coming with the map.</span>
          )}
        </p>
        <p className="mt-3 font-mono text-[13px] text-grey-ink">
          Search radius: {prefs?.radius_miles ?? 5} miles
        </p>
      </section>

      <section className="mt-4 rounded-[22px] bg-panel p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">Password</h2>
        <p className="mt-1 text-sm text-ink-soft">Change the password you sign in with.</p>
        <Link
          href="/account/password"
          className="mt-4 inline-flex min-h-11 items-center rounded-[10px] border border-hair px-4 text-sm font-semibold hover:border-pink hover:text-pink"
        >
          Set a new password
        </Link>
      </section>

      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-[10px] border border-hair bg-panel px-4 text-sm font-semibold hover:border-pink hover:text-pink"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
