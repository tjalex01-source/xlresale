import { createServiceClient } from "@/lib/supabase/server";

/**
 * Fixed-window rate limiting, counted in Postgres.
 *
 * Not in memory: Vercel runs several instances and recycles them, so an
 * in-process counter enforces nothing in particular — it just makes the graph
 * look reassuring. The counter lives in one row and is incremented in a single
 * statement, so two requests arriving together can't both read a stale count
 * and both decide they're fine.
 *
 * Called with the service role because `rate_limits` has RLS on and no
 * policies — a limit a client can reset is not a limit.
 */
export async function allow(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const admin = createServiceClient();
  const { data, error } = await admin.rpc("rate_limit_hit", {
    in_bucket: bucket,
    in_limit: limit,
    in_window_seconds: windowSeconds,
  });

  if (error) {
    // Fail OPEN, deliberately. These limits protect a budget, not a secret;
    // a database hiccup shouldn't take the feature down for everyone. The
    // per-API daily quota in Google Cloud is the hard ceiling underneath.
    console.error("rate_limit_hit failed:", error.message);
    return true;
  }

  return data === true;
}

/** Limits, in one place so they're easy to find and reason about. */
export const LIMITS = {
  /**
   * Drive times cost real money per element, and the Routes API daily quota is
   * 200 requests. Per-person is generous — nobody plans 20 routes an hour —
   * while the global ceiling keeps the whole day's spend inside the quota even
   * if lots of people show up at once.
   */
  routeMatrixPerUser: { limit: 20, windowSeconds: 3600 },
  routeMatrixGlobal: { limit: 150, windowSeconds: 86_400 },

  /** Cheap, but no reason for one account to register devices in a loop. */
  pushSubscribePerUser: { limit: 20, windowSeconds: 3600 },
} as const;
