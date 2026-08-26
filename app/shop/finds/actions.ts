"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { FINDS_BUCKET } from "@/lib/finds";

export type Result = { ok: true; message?: string } | { ok: false; message: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Money in, as a number of dollars — or null when the box was left empty. */
function parseMoney(raw: FormDataEntryValue | null): number | null | "bad" {
  const text = String(raw ?? "").trim().replace(/^\$/, "");
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return "bad";
  return Math.round(value * 100) / 100;
}

/**
 * The storage path of a photo the browser already uploaded.
 *
 * The upload itself is bounded by the storage policy — it only accepts writes
 * under `<auth.uid()>/`. This re-checks the same shape before writing it to a
 * row, because the path arrives as a plain form field and the row is what every
 * reader trusts afterwards: a value like `<someone-else-id>/x.jpg` would render
 * their photo under this person's name, or point a find at a file they can
 * delete out from under it.
 */
function parsePhotoPath(raw: FormDataEntryValue | null, userId: string): string | null | "bad" {
  const path = String(raw ?? "").trim();
  if (!path) return null;

  // Split rather than interpolate the id into a pattern: the two halves get
  // checked for what they are, and no part of the input reaches a RegExp.
  const slash = path.indexOf("/");
  if (slash === -1) return "bad";
  if (path.slice(0, slash) !== userId) return "bad";

  const file = path.slice(slash + 1);
  // <uuid>.<ext> exactly — no second slash, so no traversal and no nesting.
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{1,5}$/.test(file)) return "bad";

  return path;
}

/**
 * Log a find.
 *
 * This is the growth loop from CLAUDE.md §6 — a public find renders on the
 * finder's profile and is meant to be shared. `is_public` therefore defaults to
 * the checkbox, and the form says plainly where a public find shows up; a
 * bargain someone is quietly proud of should never become a post they didn't
 * know they made.
 */
export async function addFind(_prev: Result | null, formData: FormData): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "You're signed out. Sign in and try again." };

  const title = String(formData.get("title") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const foundOn = String(formData.get("found_on") ?? "").trim();
  const saleId = String(formData.get("sale_id") ?? "").trim();

  if (!title) return { ok: false, message: "What did you find?" };
  if (title.length > 120) return { ok: false, message: "That title's a bit long." };
  if (note.length > 500) return { ok: false, message: "Keep the note under 500 characters." };

  const paid = parseMoney(formData.get("price_paid"));
  const worth = parseMoney(formData.get("est_value"));
  if (paid === "bad") return { ok: false, message: "What you paid should be a number." };
  if (worth === "bad") return { ok: false, message: "What it's worth should be a number." };

  const photoPath = parsePhotoPath(formData.get("photo_path"), user.id);
  if (photoPath === "bad") return { ok: false, message: "That photo didn't attach. Try again." };

  const { error } = await supabase.from("finds").insert({
    finder_id: user.id,
    title,
    note: note || null,
    price_paid: paid,
    est_value: worth,
    photo_path: photoPath,
    // A date input gives "YYYY-MM-DD", which is exactly what the column wants.
    // Empty falls back to the column default rather than sending an empty
    // string, which Postgres rejects as a date.
    ...(foundOn ? { found_on: foundOn } : {}),
    ...(saleId ? { sale_id: saleId } : {}),
    is_public: formData.get("is_public") === "on",
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/shop/finds");
  revalidatePath("/shop");
  return { ok: true, message: "Logged." };
}

export async function removeFind(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "You're signed out." };

  // Read the path before the row goes, or the object is orphaned in a public
  // bucket with nothing left pointing at it and no way to find it again.
  const { data: existing } = await supabase
    .from("finds")
    .select("photo_path")
    .eq("id", id)
    .eq("finder_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("finds").delete().eq("id", id).eq("finder_id", user.id);
  if (error) return { ok: false, message: error.message };

  // After the row, so a failed delete can't take the photo with it.
  if (existing?.photo_path) {
    await supabase.storage.from(FINDS_BUCKET).remove([existing.photo_path]);
  }

  revalidatePath("/shop/finds");
  revalidatePath("/shop");
  return { ok: true };
}

/** Flip a find between public (on the profile) and private (only the finder). */
export async function setFindPublic(id: string, isPublic: boolean): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "You're signed out." };

  const { error } = await supabase
    .from("finds")
    .update({ is_public: isPublic })
    .eq("id", id)
    .eq("finder_id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/shop/finds");
  return { ok: true };
}
