"use server";

import { revalidatePath } from "next/cache";

import { createServiceClient } from "@/lib/supabase/server";
import { assertAdmin, logAdminAction } from "@/lib/admin";

export type Result = { ok: true; message?: string } | { ok: false; message: string };

/** Supabase's "indefinite" ban: a duration far enough out to mean forever. */
const FOREVER = "876000h";

/**
 * Suspend or restore an account.
 *
 * Banning is reversible and leaves everything the person made intact, which is
 * why it is the default response to a problem rather than deletion.
 */
export async function setUserBanned(userId: string, banned: boolean): Promise<Result> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  if (userId === auth.userId) {
    return { ok: false, message: "You can't suspend your own account." };
  }

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: banned ? FOREVER : "none",
  });

  if (error) return { ok: false, message: error.message };

  await logAdminAction(auth.userId, banned ? "user.suspend" : "user.restore", "user", userId);

  revalidatePath("/admin/users");
  return { ok: true, message: banned ? "Account suspended." : "Account restored." };
}

/**
 * Delete an account outright.
 *
 * Everything they made goes with it — profile, sales, saves, finds — via the
 * foreign keys' ON DELETE CASCADE. There is no undo, so the UI asks twice and
 * this refuses to touch an admin or the caller.
 */
export async function deleteUser(userId: string): Promise<Result> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  if (userId === auth.userId) {
    return { ok: false, message: "You can't delete your own account from here." };
  }

  const admin = createServiceClient();

  // Refuse to delete another admin. Two admins deleting each other is not a
  // situation any UI should let you get into by mistake.
  const { data: targetIsAdmin } = await admin
    .from("admins")
    .select("profile_id")
    .eq("profile_id", userId)
    .maybeSingle();

  if (targetIsAdmin) {
    return { ok: false, message: "That's an admin account. Remove admin access first." };
  }

  // Captured before deletion so the audit row says who this was, not just an id
  // that now points at nothing.
  const { data: profile } = await admin
    .from("profiles")
    .select("username, display_name")
    .eq("id", userId)
    .maybeSingle();

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, message: error.message };

  await logAdminAction(auth.userId, "user.delete", "user", userId, {
    username: profile?.username ?? null,
    display_name: profile?.display_name ?? null,
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "Account deleted." };
}

/**
 * Take a sale off the public map, or put it back.
 *
 * Flips `listing_paid`, which is the same flag the map, the browse list, and
 * every RPC filter on. Note this is the one place outside the Stripe webhook
 * that writes it (CLAUDE.md §13 says payment state is server-truth) — which is
 * exactly what it is here: a server-side admin decision, never a client write.
 */
export async function setSalePublished(saleId: string, published: boolean): Promise<Result> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const admin = createServiceClient();
  const { error } = await admin.from("sales").update({ listing_paid: published }).eq("id", saleId);

  if (error) return { ok: false, message: error.message };

  await logAdminAction(
    auth.userId,
    published ? "sale.restore" : "sale.unpublish",
    "sale",
    saleId,
  );

  revalidatePath("/admin/sales");
  return { ok: true, message: published ? "Back on the map." : "Taken off the map." };
}

export async function deleteSale(saleId: string): Promise<Result> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const admin = createServiceClient();

  const { data: sale } = await admin
    .from("sales")
    .select("title, address, host_id")
    .eq("id", saleId)
    .maybeSingle();

  const { error } = await admin.from("sales").delete().eq("id", saleId);
  if (error) return { ok: false, message: error.message };

  await logAdminAction(auth.userId, "sale.delete", "sale", saleId, {
    title: sale?.title ?? null,
    host_id: sale?.host_id ?? null,
  });

  revalidatePath("/admin/sales");
  return { ok: true, message: "Sale deleted." };
}
