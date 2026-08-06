import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { DisplayNameForm } from "./DisplayNameForm";

export const metadata: Metadata = {
  title: "Your account — XLResale",
};

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, home_address, created_at")
    .eq("id", user.id)
    .single();

  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select("radius_miles")
    .eq("profile_id", user.id)
    .single();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link
        href="/"
        className="font-display text-xl font-extrabold tracking-[-0.02em] hover:text-sale"
      >
        XLResale
      </Link>

      <h1 className="mt-6 font-display text-3xl font-extrabold leading-[1.1] tracking-[-0.02em]">
        Your account
      </h1>
      <p className="mt-2 font-mono text-sm text-ink-soft">{user.email}</p>

      <section className="mt-8 rounded-2xl border border-hair bg-panel p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">Profile</h2>
        <DisplayNameForm initial={profile?.display_name ?? ""} />
      </section>

      <section className="mt-4 rounded-2xl border border-hair bg-panel p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">Where you shop from</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Your starting point for routes, and the center of &ldquo;near me.&rdquo;
        </p>
        <p className="mt-3 text-sm">
          {profile?.home_address ?? (
            <span className="text-asphalt">Not set yet — coming with the map.</span>
          )}
        </p>
        <p className="mt-3 font-mono text-[13px] text-asphalt">
          Search radius: {prefs?.radius_miles ?? 5} miles
        </p>
      </section>

      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="rounded-xl border border-hair bg-panel px-4 py-2.5 text-sm font-semibold hover:border-sale hover:text-sale"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
