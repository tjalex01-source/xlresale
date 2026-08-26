import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { RoutePlanner } from "./RoutePlanner";

export const metadata: Metadata = { title: "Plan your route — XLResale" };

export default async function RoutePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/route");

  const [{ data: homeRows }, { data: saved }, { data: routes }] = await Promise.all([
    supabase.rpc("my_home_point"),
    supabase.rpc("my_saved_sales"),
    supabase.from("saved_routes").select("route_date, stop_ids").eq("shopper_id", user.id),
  ]);

  const home = homeRows?.[0] ? { lat: homeRows[0].lat, lng: homeRows[0].lng } : null;

  const initialRoutes = Object.fromEntries(
    (routes ?? []).map((r) => [r.route_date, r.stop_ids]),
  );

  const today = new Date().toLocaleDateString("en-CA");

  return (
    <>
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
        <Link href="/map" className="ml-auto text-sm font-semibold hover:text-pink">
          Map
        </Link>
        <Link href="/shop" className="text-sm font-semibold hover:text-pink">
          Shopping
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-24">
        {/* No subhead: the verdict chips on every stop demonstrate "beats the
            closing time" far better than a sentence claiming it does. */}
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
          Plan your route
        </h1>

        <div className="mt-6">
          <RoutePlanner
            savedSales={saved ?? []}
            home={home}
            initialRoutes={initialRoutes}
            today={today}
          />
        </div>
      </main>
    </>
  );
}
