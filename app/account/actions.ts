"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export type UpdateProfileResult = { ok: true } | { ok: false; message: string };

export async function updateDisplayName(
  _prev: UpdateProfileResult | null,
  formData: FormData,
): Promise<UpdateProfileResult> {
  const supabase = await createClient();

  // The proxy gates the page, but a Server Action is its own entry point —
  // check here too rather than trusting that the caller came through it.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You're signed out. Sign in and try again." };

  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!displayName) return { ok: false, message: "Enter a name." };
  if (displayName.length > 60) return { ok: false, message: "That name is too long." };

  // RLS restricts this to the caller's own row; host_id isn't ours to set.
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/account");
  return { ok: true };
}
