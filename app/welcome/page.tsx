import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { landingFor } from "@/lib/focus";
import { chooseFocus } from "@/app/account/actions";
import { FocusChooser } from "@/components/FocusChooser";
import { Nub } from "@/components/Nub";
import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = {
  title: "What brings you here? — XLResale",
};

/**
 * Asked once, on a first sign-in.
 *
 * A wall of three buttons, which is only defensible because it is genuinely one
 * tap and there is no wrong answer. There's deliberately no "skip": a skip that
 * left the column null would put this same page in front of the same person at
 * every sign-in, which is the worse version of a wall.
 *
 * Answered already? This is not the place to change it — that control lives on
 * the account page, and landing here again just means going home.
 */
export default async function WelcomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/welcome");

  const { data: profile } = await supabase
    .from("profiles")
    .select("focus, display_name")
    .eq("id", user.id)
    .single();

  if (profile?.focus) redirect(landingFor(profile.focus));

  const name = profile?.display_name?.trim();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <Link href="/" className="self-start hover:text-pink">
        <Wordmark />
      </Link>

      <div className="mt-8 flex items-end gap-4">
        <h1 className="font-display text-[clamp(2rem,7vw,3rem)] font-extrabold leading-[0.95] tracking-[-0.02em]">
          {name ? `Hi ${name}.` : "You're in."}
          <br />
          What brings you here?
        </h1>
        <Nub pose="lean" motion="float" width={120} className="w-[76px] shrink-0 sm:w-[120px]" decorative />
      </div>

      <div className="mt-8">
        <FocusChooser action={chooseFocus} />
      </div>

      <p className="mt-6 text-sm text-muted">
        Nothing gets hidden either way. Change it any time.
      </p>
    </main>
  );
}
