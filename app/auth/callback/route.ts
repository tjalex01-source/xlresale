import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/safe-redirect";
import { DEFAULT_LANDING, landingFor } from "@/lib/focus";

/**
 * Where the magic link lands. Supabase sends the browser here with a one-time
 * `code`, which we trade for a session cookie.
 *
 * The link only works in the browser that requested it — the other half of the
 * exchange is a cookie set when the email was sent. Opening it on a phone after
 * requesting it on a laptop will fail, which is why the error copy says to
 * request a fresh link rather than blaming the user.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // A password reset arrives here asking for /account/password and has to get
  // it. Only the signup link's plain DEFAULT_LANDING means "nowhere in
  // particular", and that's the one the chooser is allowed to answer.
  const requested = next === DEFAULT_LANDING ? null : next;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // This is a brand-new account's very first arrival, so `focus` is null
      // and landingFor sends them to the chooser.
      const { data: profile } = await supabase
        .from("profiles")
        .select("focus")
        .eq("id", data.user.id)
        .single();

      // Only ever redirect within this site — an open redirect here would let a
      // crafted link bounce a freshly-authenticated user to somewhere hostile.
      // Resolved and origin-compared rather than string-tested; see safeRedirect
      // for why the obvious startsWith check isn't enough.
      return NextResponse.redirect(
        safeRedirect(requested, origin, landingFor(profile?.focus ?? null)),
      );
    }
  }

  const errorDescription =
    searchParams.get("error_description") ?? "That sign-in link didn't work.";

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(errorDescription)}`,
  );
}
