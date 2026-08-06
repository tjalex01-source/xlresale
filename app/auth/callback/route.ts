import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

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
  const next = searchParams.get("next") ?? "/account";

  // Only ever redirect within this site — an open redirect here would let a
  // crafted link bounce a freshly-authenticated user to somewhere hostile.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  const errorDescription =
    searchParams.get("error_description") ?? "That sign-in link didn't work.";

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(errorDescription)}`,
  );
}
