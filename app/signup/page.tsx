import Link from "next/link";
import type { Metadata } from "next";

import { Wordmark } from "@/components/Wordmark";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = {
  title: "Create an account — XLResale",
};

export default function SignUpPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Link href="/" className="self-start hover:text-pink">
        <Wordmark />
      </Link>

      <h1 className="mt-8 font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
        Create an account
      </h1>
      <p className="mt-3 text-ink-soft">
        One account, whether you&rsquo;re hosting a sale or hunting one.
      </p>

      <div className="mt-7">
        <SignUpForm />
      </div>

      <p className="mt-6 text-sm text-ink-soft">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-4 hover:text-pink">
          Sign in
        </Link>
      </p>
    </main>
  );
}
