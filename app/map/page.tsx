import Link from "next/link";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { MapView } from "./MapView";

export const metadata: Metadata = {
  title: "Sales near you — XLResale",
  description: "A live map of garage, yard, and estate sales happening near you this week.",
};

/**
 * The shopper map.
 *
 * Deliberately public. It is the page people will link to and the first thing a
 * new shopper sees, so it works signed out — via the browser's own location —
 * and gets better once there's an account with a saved home point.
 */
export default async function MapPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in shoppers get their pins server-rendered from their saved home
  // point, so the map has data on first paint and the coordinates never leave
  // the server. Signed-out visitors start empty and can opt into geolocation.
  const [{ data: profile }, { data: prefs }, { data: sales }] = user
    ? await Promise.all([
        supabase.from("profiles").select("home_address").eq("id", user.id).single(),
        supabase.from("notification_prefs").select("radius_miles").eq("profile_id", user.id).single(),
        supabase.rpc("sales_near_me", { in_days: 7 }),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  return (
    <>
      <header className="mx-auto flex w-full max-w-3xl items-center gap-4 px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
        <Link href={user ? "/shop" : "/login?next=/map"} className="ml-auto text-sm font-semibold hover:text-pink">
          {user ? "Shopping" : "Sign in"}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-24">
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
          Sales near you
        </h1>
        <p className="mt-3 text-ink-soft">
          Green means the garage door is open right now.
        </p>

        <div className="mt-6">
          <MapView
            initialSales={sales ?? []}
            hasHome={Boolean(profile?.home_address)}
            signedIn={Boolean(user)}
            radiusMiles={prefs?.radius_miles ?? 20}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded-full bg-green" aria-hidden /> Open now
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded-full bg-tangerine" aria-hidden /> Closing soon
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded-full bg-pink" aria-hidden /> Scheduled
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded-full bg-grey" aria-hidden /> Wrapped up
          </span>
        </div>
      </main>
    </>
  );
}
