import Link from "next/link";
import { getImageProps } from "next/image";

import { Wordmark } from "@/components/Wordmark";

const ALT =
  "XLResale's mascot waving from a little car piled high with garage-sale finds, driving past yard sales at golden hour.";

/**
 * The landing hero, built over the mascot render (DESIGN.md → Hero, and
 * reference/hero-frame.html).
 *
 * Art direction: the desktop render is 16:9 and the mascot sits centre-left,
 * so on a phone a `cover` crop of it loses him entirely. The 9:16 render is a
 * different composition — mascot right, open sky above for the headline — so
 * this uses <picture> with getImageProps rather than one image and a clever
 * object-position. getImageProps keeps Next's optimizer while letting the
 * browser download only the crop it will actually show.
 */
export function Hero({ liveCount }: { liveCount: number }) {
  const common = { alt: ALT, quality: 78, priority: true, sizes: "100vw" } as const;

  const desktop = getImageProps({ ...common, src: "/mascot/hero.png", width: 1456, height: 816 });
  const mobile = getImageProps({
    ...common,
    src: "/mascot/hero-mobile.png",
    width: 816,
    height: 1456,
  });

  return (
    <section className="relative min-h-[100svh] overflow-hidden">
      {/* Stacking is explicit and all non-negative: image 0, scrim 1, copy 10,
          nav 20. A negative z-index here drops the image behind the background
          that <body> propagates to the page canvas, and it vanishes. */}
      <picture>
        <source media="(max-width: 640px)" srcSet={mobile.props.srcSet} sizes="100vw" />
        {/* Mirrored at sm+ only. In the 16:9 render the mascot sits ~36% from
            the left — directly under the copy — and at this aspect ratio the
            image fills the width exactly, so object-position has nothing to pan.
            Flipping puts him at ~64%, clear of the text and driving toward it.
            The 9:16 mobile render already composes around a top-set headline,
            so it is left alone. */}
        <img
          {...desktop.props}
          className="absolute inset-0 z-0 h-full w-full object-cover object-[50%_58%] sm:-scale-x-100 sm:object-[50%_60%]"
          alt={ALT}
        />
      </picture>

      {/* Scrim. Desktop washes in from the left so dark type reads while the
          mascot stays clear to the right; mobile washes from the top, because
          there he sits low in frame and the copy sits over open sky. */}
      <div
        aria-hidden
        className="absolute inset-0 z-[1] hidden sm:block"
        style={{
          background:
            "linear-gradient(100deg, rgb(255 253 249 / 0.95) 0%, rgb(255 253 249 / 0.88) 26%, rgb(255 253 249 / 0.55) 44%, rgb(255 253 249 / 0.08) 62%, rgb(255 253 249 / 0) 74%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 z-[1] sm:hidden"
        style={{
          background:
            "linear-gradient(180deg, rgb(255 253 249 / 0.95) 0%, rgb(255 253 249 / 0.86) 34%, rgb(255 253 249 / 0.3) 62%, rgb(255 253 249 / 0) 100%)",
        }}
      />

      <nav className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 sm:px-[clamp(20px,5vw,56px)]">
        <Wordmark />
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-full border border-ink/10 bg-canvas/70 px-[18px] text-[15px] font-semibold backdrop-blur-sm transition-colors hover:bg-white"
        >
          Sign in
        </Link>
      </nav>

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1240px] flex-col justify-start px-5 pt-24 sm:justify-center sm:px-[clamp(20px,5vw,56px)] sm:pt-0">
        <div className="max-w-[560px] lg:max-w-[700px]">
          {liveCount > 0 ? (
            <p className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-ink/10 bg-white px-4 py-2 shadow-card">
              <span
                aria-hidden
                className="ping relative size-2.5 rounded-full bg-green"
                style={{ color: "var(--color-green)" }}
              />
              <span className="text-sm font-semibold">
                <b className="font-mono">{liveCount}</b>{" "}
                {liveCount === 1 ? "sale" : "sales"} open right now
              </span>
            </p>
          ) : (
            <Link
              href="/login?next=/host"
              className="mb-6 inline-flex min-h-11 items-center gap-2.5 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold shadow-card transition-transform hover:-translate-y-0.5"
            >
              <span aria-hidden className="size-2.5 rounded-full bg-pink" />
              No sales up yet — be the first to list one
            </Link>
          )}

          <h1 className="font-display text-[clamp(2.5rem,4.9vw,4.35rem)] font-extrabold leading-[0.98] tracking-[-0.03em]">
            Somebody&rsquo;s garage
            <br />
            is <span className="text-pink">open right now.</span>
          </h1>

          <p className="mt-[18px] max-w-[520px] text-[clamp(1.05rem,1.6vw,1.3rem)] leading-[1.5] text-ink-soft">
            Every other app dumps unverified pins on a map. We show you which sales are
            actually open &mdash; and build a route that reaches them before they close.
          </p>

          <div className="mt-[30px] flex flex-wrap gap-3">
            <Link
              href="/login"
              /* 19px, not the reference's 17px: white on pink measures 3.61:1,
                 which only passes as "large text" at >=18.66px bold. */
              className="inline-flex items-center rounded-[15px] bg-pink px-[26px] py-[15px] text-[19px] font-bold text-white shadow-[0_6px_18px_rgb(255_46_99_/_0.32)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Find sales near me
            </Link>
            <Link
              href="/login?next=/host"
              className="inline-flex items-center gap-2 rounded-[15px] bg-ink px-[26px] py-[15px] text-[19px] font-bold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              List a sale &middot; <span className="font-mono opacity-90">$5</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-1.5 text-[12px] uppercase tracking-[0.08em] text-muted sm:flex">
        <span>See how it works</span>
        <span aria-hidden className="scroll-bob h-[22px] w-px bg-muted" />
      </div>
    </section>
  );
}
