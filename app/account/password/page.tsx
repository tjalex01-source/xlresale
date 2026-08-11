import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = {
  title: "Set a new password — XLResale",
};

export default async function PasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Reached either from a reset link (which exchanged its code for a session at
  // /auth/callback) or from the account page while signed in. No session means
  // the link was stale.
  if (!user) redirect("/forgot-password?expired=1");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Link href="/" className="self-start hover:text-pink">
        <Wordmark />
      </Link>

      <h1 className="mt-8 font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
        Set a new password
      </h1>
      <p className="mt-3 font-mono text-sm text-ink-soft">{user.email}</p>

      <div className="mt-7">
        <PasswordForm />
      </div>
    </main>
  );
}
