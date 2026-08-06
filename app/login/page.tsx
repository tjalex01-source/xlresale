import Link from "next/link";
import type { Metadata } from "next";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — XLResale",
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const rawNext = typeof params.next === "string" ? params.next : "/account";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/account";
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Link
        href="/"
        className="font-display text-2xl font-extrabold tracking-[-0.02em] hover:text-sale"
      >
        XLResale
      </Link>

      <h1 className="mt-6 font-display text-3xl font-extrabold leading-[1.1] tracking-[-0.02em]">
        Sign in
      </h1>
      <p className="mt-2 text-ink-soft">
        Same account whether you&rsquo;re hosting a sale or hunting one.
      </p>

      {error && (
        <p className="mt-5 rounded-xl bg-sale-tint px-3.5 py-2.5 text-sm text-sale-deep" role="alert">
          {error} Request a fresh link below.
        </p>
      )}

      <div className="mt-6">
        <LoginForm next={next} />
      </div>
    </main>
  );
}
