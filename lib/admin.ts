import { redirect } from "next/navigation";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

/**
 * Gate for every admin page and every admin server action.
 *
 * Called at the top of each one, not just in the layout: a Server Action is its
 * own entry point and does not inherit a layout's checks, so a layout-only gate
 * would leave every action reachable by anyone who knows its id.
 *
 * `is_admin()` reads a table with RLS on and no policies, so this cannot be
 * spoofed from the client — see schema-additions-admin.sql.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");

  const { data: isAdmin } = await supabase.rpc("is_admin", {});
  if (!isAdmin) {
    // Deliberately a 404, not a 403: confirming that /admin exists tells an
    // attacker there is something here worth attacking.
    const { notFound } = await import("next/navigation");
    notFound();
  }

  return { supabase, user };
}

/** Same check for server actions, which return errors rather than redirecting. */
export async function assertAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "You're signed out." };

  const { data: isAdmin } = await supabase.rpc("is_admin", {});
  if (!isAdmin) return { ok: false, message: "Not allowed." };

  return { ok: true, userId: user.id };
}

/**
 * Record a destructive action.
 *
 * Written with the service role because admin_actions has no insert policy —
 * an audit trail an admin could edit through the API is not an audit trail.
 */
export async function logAdminAction(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  detail?: Record<string, Json>,
) {
  const admin = createServiceClient();
  await admin.from("admin_actions").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    detail: detail ?? null,
  });
}
