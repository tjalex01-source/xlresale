import Link from "next/link";
import type { Metadata } from "next";

import { Wordmark } from "@/components/Wordmark";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = {
  title: "Reset your password — XLResale",
};

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Link href="/" className="self-start hover:text-pink">
        <Wordmark />
      </Link>

      <h1 className="mt-8 font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
        Reset your password
      </h1>
      <p className="mt-3 text-ink-soft">
        We&rsquo;ll email you a link to set a new one.
      </p>

      <div className="mt-7">
        <ResetForm />
      </div>

      <p className="mt-6 text-sm text-ink-soft">
        <Link
          href="/login"
          className="font-semibold text-ink underline underline-offset-4 hover:text-pink"
        >
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
