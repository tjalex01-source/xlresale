import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

/** Paths that require a signed-in user. */
const PROTECTED = ["/account", "/host"];

/** Paths that make no sense once you're signed in. */
const SIGNED_OUT_ONLY = ["/login", "/signup", "/forgot-password"];

/**
 * Refreshes the Supabase session on every request and gates protected routes.
 *
 * Auth tokens expire, and only a server round-trip can refresh them. If this
 * doesn't run, a signed-in user gets silently logged out once their token
 * lapses. The cookie juggling below is required by @supabase/ssr: the refreshed
 * cookies have to land on both the request (so the page sees them) and the
 * response (so the browser stores them).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates against Supabase. Don't swap this for getSession(),
  // which trusts the cookie without checking it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed so sign-in can return them there.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && SIGNED_OUT_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/account";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
