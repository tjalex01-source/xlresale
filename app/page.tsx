import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Hero } from "@/components/Hero";
import { Nub } from "@/components/Nub";
import { NubReveal } from "@/components/NubReveal";
import { TagPin } from "@/components/TagPin";
import { Wordmark } from "@/components/Wordmark";
import { SALE_STATUS_META, SALE_STATUS_ORDER } from "@/lib/sale-status";

export const revalidate = 60;

const ROUTE = [
  {
    stop: 1,
    time: "9:12 am",
    title: "Tools, vinyl & mid-century",
    drive: "6 min",
    closes: "1:00 pm",
    verdict: "ok",
    note: "48 min to spare",
  },
  {
    stop: 2,
    time: "9:58 am",
    title: "Estate sale — glassware",
    drive: "12 min",
    closes: "10:30 am",
    verdict: "tight",
    note: "cutting it close",
  },
  {
    stop: 3,
    time: "11:04 am",
    title: "Moving sale — everything goes",
    drive: "9 min",
    closes: "11:00 am",
    verdict: "miss",
    note: "closes before you arrive",
  },
] as const;

/* Chips sit on a tint, so these use the -ink variants. See lib/sale-status.ts. */
const VERDICT = {
  ok: { mark: "✓", color: "var(--color-green-ink)", tint: "var(--color-green-50)" },
  tight: { mark: "◔", color: "var(--color-tangerine-ink)", tint: "var(--color-tangerine-50)" },
  miss: { mark: "✕", color: "var(--color-pink-ink)", tint: "var(--color-pink-50)" },
} as const;

const CATEGORIES = [
  { label: "Tools", tint: "var(--color-pink-50)", color: "var(--color-pink-ink)", tilt: -3 },
  { label: "Vinyl / Media", tint: "var(--color-violet-50)", color: "var(--color-violet-ink)", tilt: 2 },
  { label: "Furniture", tint: "var(--color-tangerine-50)", color: "var(--color-tangerine-ink)", tilt: -2 },
  { label: "Baby & Kids", tint: "var(--color-green-50)", color: "var(--color-green-ink)", tilt: 3 },
  { label: "Clothing", tint: "var(--color-pink-50)", color: "var(--color-pink-ink)", tilt: 1 },
  { label: "Outdoors", tint: "var(--color-green-50)", color: "var(--color-green-ink)", tilt: -3 },
  { label: "Collectibles", tint: "var(--color-tangerine-50)", color: "var(--color-tangerine-ink)", tilt: 2 },
  { label: "Home & Kitchen", tint: "var(--color-violet-50)", color: "var(--color-violet-ink)", tilt: -1 },
] as const;

export default async function Home() {
  const supabase = await createClient();

  // The pill says "open right now", so it has to be true. RLS keeps this to
  // paid, published sales — the same set a shopper would see on the map.
  const [{ data: userData }, { count }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("sales")
      .select("*", { count: "exact", head: true })
      .eq("status", "live")
      .eq("listing_paid", true),
  ]);
  const user = userData.user;

  return (
    <>
      <Hero liveCount={count ?? 0} />

      <main>
        {/* ---------------------------------------------------------------- */}
        {/* Live status — canvas                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 sm:py-24 lg:grid-cols-2 lg:items-center lg:py-32">
          <div>
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-pink-ink">
              7:14 am &middot; the garage door goes up
            </p>
            <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-none tracking-[-0.02em]">
              Green means go.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
              The host taps <strong className="font-semibold text-ink">Go live</strong> when they
              open up, and your map turns green the same second. No more driving across town to a
              folded table and an empty driveway.
            </p>

            {/* He points at the green pin — the live state this section is about. */}
            <Nub
              pose="point"
              motion="float"
              width={150}
              className="mt-8 w-[108px] lg:w-[150px]"
              decorative
            />
          </div>

          <ul className="space-y-3">
            {SALE_STATUS_ORDER.map((status) => {
              const meta = SALE_STATUS_META[status];
              return (
                <li
                  key={status}
                  className="flex items-center gap-4 rounded-[22px] bg-panel px-5 py-4 shadow-card"
                >
                  <TagPin status={status} size={30} />
                  <span className="font-display text-lg font-bold">{meta.label}</span>
                  <span className="ml-auto text-right text-sm text-muted">{meta.detail}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Route planner — bold ink block, receipt cards                     */}
        {/* ---------------------------------------------------------------- */}
        <section className="bg-ink text-canvas">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 sm:py-24 lg:grid-cols-[0.95fr_1.05fr] lg:py-32">
            <div>
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-tangerine">
                9:02 am &middot; four stops, three hours
              </p>
              <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-none tracking-[-0.02em]">
                A route that beats
                <br className="hidden sm:block" /> the clock.
              </h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-[#C9C4D4]">
                Shortest distance is the wrong answer when the good one closes at eleven. Drag your
                stops around and every arrival time recalculates against that sale&rsquo;s closing
                time &mdash; so you know what you&rsquo;ll make before you turn the key.
              </p>
            </div>

            <ol className="space-y-4">
              {ROUTE.map((stop) => {
                const v = VERDICT[stop.verdict];
                return (
                  <li key={stop.stop} className="receipt rounded-t-[16px] bg-panel p-5 pb-7 text-ink">
                    <div className="flex items-center gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink font-mono text-xs font-bold text-canvas">
                        {stop.stop}
                      </span>
                      <p className="font-display text-lg font-bold leading-snug">{stop.title}</p>
                    </div>

                    <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-dashed border-hair pt-3">
                      <div>
                        <dt className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted">
                          Arrive
                        </dt>
                        <dd className="font-mono text-lg font-bold">{stop.time}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted">
                          Drive
                        </dt>
                        <dd className="font-mono text-lg font-bold">{stop.drive}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted">
                          Closes
                        </dt>
                        <dd className="font-mono text-lg font-bold">{stop.closes}</dd>
                      </div>
                      <p
                        className="ml-auto self-end rounded-full px-3 py-1.5 text-sm font-semibold"
                        style={{ backgroundColor: v.tint, color: v.color }}
                      >
                        <span aria-hidden>{v.mark}</span> {stop.note}
                      </p>
                    </dl>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Categories — violet tint, sticker chips                          */}
        {/* ---------------------------------------------------------------- */}
        <section className="bg-violet-50">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-violet-ink">
                  10:20 am &middot; you know what you came for
                </p>
                <h2 className="mt-4 max-w-2xl font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-none tracking-[-0.02em]">
                  Filter for the good stuff.
                </h2>
              </div>
              {/* The page's one attention-grabbing beat: he hops for the box the
                  first time you scroll past. DESIGN.md says spend the budget here. */}
              <NubReveal className="inline-block">
                <Nub pose="grab" width={130} className="w-[92px] sm:w-[130px]" decorative />
              </NubReveal>
            </div>
            <ul className="mt-8 flex flex-wrap gap-3">
              {CATEGORIES.map((c) => (
                <li
                  key={c.label}
                  className="sticker-chip rounded-[10px] px-4 py-2.5 font-semibold shadow-[0_2px_8px_rgb(23_19_31_/_0.08)]"
                  style={
                    {
                      "--tilt": `${c.tilt}deg`,
                      backgroundColor: c.tint,
                      color: c.color,
                    } as React.CSSProperties
                  }
                >
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Hosts — bold tangerine block                                     */}
        {/* ---------------------------------------------------------------- */}
        <section className="bg-tangerine text-ink">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24 lg:py-32">
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em]">
              Hosting one?
            </p>
            {/* items-center, not items-end: Nub makes the right column taller,
                and bottom-aligning left a dead gap under the eyebrow. */}
            <div className="mt-4 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <h2 className="font-display text-[clamp(2rem,4.4vw,3.25rem)] font-bold leading-none tracking-[-0.02em]">
                Five dollars puts your driveway
                <br className="hidden sm:block" /> on every map in town.
              </h2>
              <div>
                <Nub
                  pose="lean"
                  motion="float"
                  width={140}
                  className="mb-4 w-[104px] lg:w-[140px]"
                  decorative
                />
                <p className="text-lg leading-relaxed">
                  Post your hours, tag what you&rsquo;re selling, add photos. Tap{" "}
                  <strong className="font-semibold">Go live</strong> Saturday morning and watch the
                  shoppers who already have you on their route.
                </p>
                <div className="mt-7 flex items-center gap-3">
                  {/* Hand-drawn accent pointing at the CTA (DESIGN.md → signatures). */}
                  <svg
                    viewBox="0 0 58 34"
                    aria-hidden
                    className="hidden h-9 w-14 shrink-0 sm:block"
                    fill="none"
                  >
                    <path
                      d="M2 6c10 14 26 20 46 20"
                      stroke="var(--color-ink)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    pathLength={1}
                    />
                    <path
                      d="M38 18c4 3 8 6 10 8M48 26c-3 1-7 2-10 2"
                      stroke="var(--color-ink)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <Link
                    href="/login?next=/host/new"
                    className="inline-flex items-center rounded-[15px] bg-ink px-[26px] py-[15px] text-[17px] font-bold text-canvas transition-transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    List your sale
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-12">
        <Wordmark className="!text-xl" />
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-grey-ink">
          Garage &middot; yard &middot; estate sales
        </span>
        <Link
          href={user ? "/account" : "/login"}
          className="ml-auto inline-flex min-h-11 items-center font-semibold hover:text-pink-ink"
        >
          {user ? "Your account" : "Sign in"}
        </Link>
      </footer>
    </>
  );
}
