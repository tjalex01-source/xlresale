import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

/**
 * Browser-side Supabase client. Uses the anon key, so every read and write is
 * subject to RLS — that is the security layer (CLAUDE.md §13). Never import the
 * service-role key into anything that ships to the browser.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
