import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

/**
 * Server-side Supabase client bound to the request's cookies, so the session
 * (and therefore RLS) follows the signed-in user. Use this in Server
 * Components, Route Handlers, and Server Actions.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, which cannot set cookies. Safe to
            // ignore when middleware is refreshing the session.
          }
        },
      },
    },
  );
}

/**
 * Privileged client that bypasses RLS. Server-only, and deliberately narrow in
 * use: the Stripe webhook setting `listing_paid` is the one place v1 needs it
 * (CLAUDE.md §8, §13). Payment state is server-truth — the client never writes
 * it. Do not reach for this to work around a policy; fix the policy instead.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}
