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

  const { pathname, searchParams } = request.nextUrl;

  // Safety net for auth codes that land somewhere they can't be used.
  // Supabase falls back to the site root when a redirect target isn't on its
  // allow-list, which strands the code on a page with nothing to exchange it —
  // exactly what a password reset did when the allow-list covered the apex but
  // not www. Route any stray code to the handler instead of losing it.
  const code = searchParams.get("code");
  if (code && pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    const next = searchParams.get("next");
    url.search = "";
    url.searchParams.set("code", code);
    if (next?.startsWith("/") && !next.startsWith("//")) url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  if (!user && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed so sign-in can return them there.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && SIGNED_OUT_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone();
    // Honour where they were trying to go. Without this, a link like
    // /login?next=/host/new — which is what the landing page CTAs are — silently
    // dumps an already-signed-in visitor on their account page instead of the
    // thing they clicked.
    const next = searchParams.get("next");
    url.pathname = next?.startsWith("/") && !next.startsWith("//") ? next : "/account";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
