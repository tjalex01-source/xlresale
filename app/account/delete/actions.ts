"use server";

import { redirect } from "next/navigation";

import { createClient, createServiceClient } from "@/lib/supabase/server";

export type DeleteState = { status: "idle" } | { status: "error"; message: string };

/**
 * Delete your own account.
 *
 * The whole point of a deletion path is that it belongs to the person whose
 * data it is — an admin-only delete is a support ticket, not a right.
 *
 * Everything cascades from auth.users through profiles: sales and their photos,
 * items and categories; saved sales, routes, wishlists, alerts, finds, push
 * subscriptions. There is no soft-delete and no shadow copy.
 *
 * The one thing that survives is admin_actions, with actor_id nulled — a record
 * of a moderation decision has to outlast the moderator. (That column was NOT
 * NULL *and* ON DELETE SET NULL, which contradict; deleting any admin who had
 * ever acted would have failed outright. Fixed in
 * schema-additions-account.sql.)
 */
export async function deleteMyAccount(
  _prev: DeleteState | null,
  formData: FormData,
): Promise<DeleteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "error", message: "You're signed out. Sign in and try again." };

  // Typed confirmation rather than a second button. This is irreversible and
  // takes their sales down with it; a mis-tap should not be able to do it.
  const typed = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (typed !== "delete") {
    return { status: "error", message: `Type "delete" to confirm.` };
  }

  const admin = createServiceClient();

  // An admin deleting themselves would leave nobody able to moderate. Ask them
  // to hand it over first rather than discovering it afterwards.
  const { data: isAdmin } = await admin
    .from("admins")
    .select("profile_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (isAdmin) {
    return {
      status: "error",
      message: "This is an admin account. Remove admin access before deleting it.",
    };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("self-delete failed:", error.message);
    return { status: "error", message: "Couldn't delete the account. Try again shortly." };
  }

  // The session's user no longer exists; clear the cookie so the next request
  // isn't holding a token for a deleted account.
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
