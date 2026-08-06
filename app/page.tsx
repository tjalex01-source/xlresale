import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Sticker } from "@/components/Sticker";

/**
 * The landing page.
 *
 * Structure note: the sections are marked with clock times rather than 01/02/03
 * because time is the actual information in this product. A sale exists between
 * two hours and dies at the second one — that's the whole reason the route
 * planner exists, so the page is organized the way a Saturday is.
 */
const STICKERS = [
  { status: "live", headline: "Open now", value: "1.2", unit: "miles", tilt: -8 },
  { status: "winding_down", headline: "Closing", value: "1:00", unit: "pm", tilt: 6 },
  { status: "scheduled", headline: "Opens", value: "8:00", unit: "am", tilt: -4 },
  { status: "closed", headline: "Wrapped up", value: "—", unit: "yesterday", tilt: 9 },
] as const;

const ROUTE = [
  {
    time: "9:12 am",
    title: "Tools, vinyl & mid-century",
    verdict: "ok",
    note: "48 min to spare",
    drive: "6 min",
  },
  {
    time: "9:58 am",
    title: "Estate sale — glassware",
    verdict: "tight",
    note: "cutting it close",
    drive: "12 min",
  },
  {
    time: "11:04 am",
    title: "Moving sale — everything goes",
    verdict: "miss",
    note: "closes before you arrive",
    drive: "9 min",
  },
] as const;

/* Text sits on a tint here, so these use the -deep variants. See sale-status.ts. */
const VERDICT = {
  ok: { mark: "✓", color: "var(--color-live-deep)", tint: "var(--color-live-tint)" },
  tight: { mark: "◔", color: "var(--color-gold-deep)", tint: "var(--color-gold-tint)" },
  miss: { mark: "✕", color: "var(--color-sale-deep)", tint: "var(--color-sale-tint)" },
} as const;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-5">
        <span className="font-display text-xl font-extrabold tracking-[-0.02em]">XLResale</span>
        <nav className="ml-auto flex items-center gap-1 text-sm font-semibold">
          {user ? (
            <Link href="/account" className="inline-flex min-h-11 items-center rounded-full px-4 hover:bg-sale-tint hover:text-sale">
              Your account
            </Link>
          ) : (
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-full px-4 hover:bg-sale-tint hover:text-sale">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <main>
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="relative overflow-hidden">
          {/* Concentric rings, like the rings of a radius search. Decorative. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 top-0 h-[560px] w-[560px] rounded-full opacity-[0.35] sm:-right-24"
            style={{
              background:
                "radial-gradient(circle, transparent 38%, var(--color-live-tint) 39% 41%, transparent 42%, transparent 56%, var(--color-gold-tint) 57% 59%, transparent 60%, transparent 74%, var(--color-sale-tint) 75% 77%, transparent 78%)",
            }}
          />

          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-16 pt-8 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-14">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-live-tint px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-live-deep">
                <span aria-hidden className="sticker-live size-2 rounded-full bg-live" />
                14 sales open right now
              </p>

              <h1 className="mt-5 font-display text-[clamp(2.4rem,5.2vw,4rem)] font-extrabold leading-[0.95] tracking-[-0.035em] text-balance">
                Somebody&rsquo;s garage
                <br />
                is open{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">right now.</span>
                  <span
                    aria-hidden
                    className="absolute inset-x-[-4px] bottom-[0.1em] z-0 h-[0.32em] -rotate-1 rounded-full bg-gold"
                  />
                </span>
              </h1>

              <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
                Every other app dumps unverified pins on a map. We show you which sales are
                actually open, and build a route that reaches them before they close.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={user ? "/account" : "/login"}
                  className="rounded-full bg-sale px-7 py-3.5 font-display text-xl font-bold text-white shadow-card transition-transform hover:-translate-y-0.5 hover:shadow-float"
                >
                  Find sales near me
                </Link>
                <Link
                  href="/login?next=/host"
                  className="rounded-full border-2 border-ink px-6 py-3 font-display text-lg font-bold hover:bg-ink hover:text-paper"
                >
                  List a sale &middot; $5
                </Link>
              </div>
            </div>

            {/* The signature: a scatter of price stickers, one per sale status. */}
            <div className="relative">
              <ul className="grid grid-cols-2 justify-items-center gap-4 sm:gap-6 lg:gap-3">
                {STICKERS.map((s, i) => (
                  <li key={s.status} className="contents">
                    <Sticker
                      status={s.status}
                      headline={s.headline}
                      value={s.value}
                      unit={s.unit}
                      tilt={s.tilt}
                      index={i}
                      className={`size-[122px] sm:size-[148px] ${
                        i % 2 === 1 ? "lg:translate-y-7" : ""
                      }`}
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-asphalt-deep">
                Every pin, color-coded by what it&rsquo;s doing
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Live status                                                      */}
        {/* ---------------------------------------------------------------- */}
        <section className="border-y border-hair bg-panel">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 lg:grid-cols-2 lg:py-20">
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-sale-deep">
                7:14 am &middot; the garage door goes up
              </p>
              <h2 className="mt-3 font-display text-[clamp(1.9rem,4vw,2.8rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
                Green means go.
              </h2>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">
                The host taps <strong className="font-semibold text-ink">Go live</strong> when they
                open up. Your map turns green the same second. No more driving across town to a
                folded table and an empty driveway.
              </p>
            </div>

            <ul className="space-y-3">
              {[
                { status: "live" as const, label: "Open now", detail: "Host is out there. Go." },
                {
                  status: "winding_down" as const,
                  label: "Closing soon",
                  detail: "Last call — make an offer.",
                },
                {
                  status: "scheduled" as const,
                  label: "Open today",
                  detail: "Listed, not started yet.",
                },
                {
                  status: "closed" as const,
                  label: "Wrapped up",
                  detail: "Done for the day.",
                },
              ].map(({ status, label, detail }) => (
                <li
                  key={status}
                  className="flex items-center gap-4 rounded-2xl border border-hair px-5 py-4"
                >
                  <span
                    aria-hidden
                    className={`size-3.5 shrink-0 rounded-full ${status === "live" ? "sticker-live" : ""}`}
                    style={{ backgroundColor: `var(--color-${status === "live" ? "live" : status === "winding_down" ? "gold" : status === "scheduled" ? "sale" : "asphalt"})` }}
                  />
                  <span className="font-display text-lg font-bold">{label}</span>
                  <span className="ml-auto text-right text-sm text-ink-soft">{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Route planner                                                    */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-sale-deep">
              9:02 am &middot; four stops, three hours
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.9rem,4vw,2.8rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
              A route that beats the clock.
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">
              Shortest distance is the wrong answer when the good one closes at eleven. Drag your
              stops around and every arrival time recalculates against that sale&rsquo;s closing
              time — so you know what you&rsquo;ll make before you turn the key.
            </p>
          </div>

          <ol className="space-y-3">
            {ROUTE.map((stop) => {
              const v = VERDICT[stop.verdict];
              return (
                <li
                  key={stop.title}
                  className="rounded-2xl border border-hair bg-panel p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-lg font-bold">{stop.time}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-asphalt-deep">
                      {stop.drive} drive
                    </span>
                  </div>
                  <p className="mt-1.5 font-display text-lg font-bold leading-snug">{stop.title}</p>
                  <p
                    className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold"
                    style={{ backgroundColor: v.tint, color: v.color }}
                  >
                    <span aria-hidden>{v.mark}</span>
                    {stop.note}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Hosts                                                            */}
        {/* ---------------------------------------------------------------- */}
        <section className="bg-ink text-paper">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-20">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
              Hosting one?
            </p>
            <div className="mt-3 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <h2 className="font-display text-[clamp(1.9rem,4.4vw,3rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
                Five dollars puts your driveway
                <br className="hidden sm:block" /> on every map in town.
              </h2>
              <div>
                <p className="text-lg leading-relaxed text-[#C9C1D6]">
                  Post your hours, tag what you&rsquo;re selling, add photos. Tap{" "}
                  <strong className="font-semibold text-paper">Go live</strong> Saturday morning and
                  watch the shoppers who have you on their route.
                </p>
                <Link
                  href="/login?next=/host"
                  className="mt-6 inline-block rounded-full bg-gold px-7 py-3.5 font-display text-lg font-bold text-ink transition-transform hover:-translate-y-0.5"
                >
                  List your sale
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-10 text-sm text-asphalt-deep">
        <span className="font-display font-bold text-ink">XLResale</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em]">
          Garage &middot; yard &middot; estate sales
        </span>
        <Link
          href="/login"
          className="ml-auto inline-flex min-h-11 items-center font-semibold hover:text-sale"
        >
          Sign in
        </Link>
      </footer>
    </>
  );
}
