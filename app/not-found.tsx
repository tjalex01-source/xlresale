import Link from "next/link";

import { Nub } from "@/components/Nub";
import { Wordmark } from "@/components/Wordmark";

export default function NotFound() {
  return (
    <>
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <Nub pose="404" motion="float" width={340} priority decorative />

        <p className="mt-10 font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-pink-ink">
          Error 404
        </p>
        <h1 className="mt-3 font-display text-[clamp(2rem,5vw,3.25rem)] font-extrabold leading-none tracking-[-0.02em]">
          Nub took a wrong turn.
        </h1>
        <p className="mt-4 max-w-md text-lg text-ink-soft">
          That page isn&rsquo;t here. It may have wrapped up and gone home.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-[15px] bg-pink px-[26px] py-[15px] text-[19px] font-bold text-white shadow-[0_6px_18px_rgb(255_46_99_/_0.32)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Back to the map
          </Link>
          <Link
            href="/login?next=/host/new"
            className="inline-flex items-center rounded-[15px] border-2 border-ink px-[24px] py-[13px] text-[19px] font-bold hover:bg-ink hover:text-canvas"
          >
            List a sale
          </Link>
        </div>
      </main>
    </>
  );
}
