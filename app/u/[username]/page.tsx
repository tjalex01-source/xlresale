import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { EmptyState } from "@/components/EmptyState";

export const revalidate = 60;

/**
 * The public profile.
 *
 * Reads `public_profiles`, never `profiles` — the base row carries home_point
 * and home_address, which must never reach a public page. The view exposes only
 * handle, avatar, and bio, and only for profiles that opted to be public.
 */
async function getProfile(username: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_profiles")
    .select("id, username, avatar_url, bio")
    .eq("username", username)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Not found — XLResale" };

  return {
    title: `@${profile.username} — XLResale`,
    description: profile.bio ?? `${profile.username}'s finds on XLResale.`,
  };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const profile = await getProfile(username);
  // Every column on a view is nullable as far as the generated types are
  // concerned, so id and username are checked rather than asserted.
  if (!profile?.id || !profile.username) notFound();

  const supabase = await createClient();
  const { data: finds } = await supabase
    .from("finds")
    .select("id, title, note, price_paid, est_value, found_on")
    .eq("finder_id", profile.id)
    .eq("is_public", true)
    .order("found_on", { ascending: false })
    .limit(24);

  return (
    <>
      <header className="mx-auto w-full max-w-3xl px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-20">
        <div className="flex flex-wrap items-center gap-5">
          <span
            aria-hidden
            className="grid size-20 shrink-0 place-items-center rounded-full bg-violet-50 font-display text-3xl font-extrabold text-violet-ink"
          >
            {profile.username.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="font-display text-[clamp(1.9rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
              @{profile.username}
            </h1>
            {profile.bio && <p className="mt-2 max-w-prose text-ink-soft">{profile.bio}</p>}
          </div>
        </div>

        <section className="mt-12">
          <h2 className="font-display text-xl font-bold">Finds</h2>

          {finds && finds.length > 0 ? (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {finds.map((find) => {
                const paid = find.price_paid;
                const worth = find.est_value;
                const saved = paid != null && worth != null ? worth - paid : null;
                return (
                  <li key={find.id} className="rounded-[16px] bg-panel p-5 shadow-card">
                    <p className="font-display text-lg font-bold leading-snug">{find.title}</p>
                    {find.note && <p className="mt-1.5 text-sm text-ink-soft">{find.note}</p>}
                    <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      {paid != null && (
                        <span className="font-mono text-lg font-bold">${paid}</span>
                      )}
                      {worth != null && (
                        <span className="font-mono text-sm text-muted line-through">${worth}</span>
                      )}
                      {saved != null && saved > 0 && (
                        <span className="ml-auto rounded-full bg-green-50 px-3 py-1 font-mono text-xs font-bold text-green-ink">
                          saved ${saved}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="No finds yet">
              When @{profile.username} logs a bargain, it shows up here.
            </EmptyState>
          )}
        </section>
      </main>
    </>
  );
}
