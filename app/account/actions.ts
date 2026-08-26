"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { validateUsername, usernameErrorMessage } from "@/lib/username";
import { MAX_RADIUS_MILES } from "@/lib/prefs";
import { isFocus, landingFor, type ProfileFocus } from "@/lib/focus";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export type SaveResult = { ok: true; message?: string } | { ok: false; message: string };


/** Every action here re-checks auth: a Server Action is its own entry point. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Claim or change the public handle.
 *
 * Accounts made before handles existed have none, so this is the only way they
 * can get a public profile. Changing one is allowed but breaks any shared link
 * to the old handle, which the form says out loud.
 */
export async function saveUsername(
  _prev: SaveResult | null,
  formData: FormData,
): Promise<SaveResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "You're signed out. Sign in and try again." };

  const username = String(formData.get("username") ?? "").trim();
  const problem = validateUsername(username);
  if (problem) return { ok: false, message: usernameErrorMessage(problem) };

  // RLS hides other people's rows and public_profiles only lists opted-in ones,
  // so neither can answer "is this taken?" — this reads one column as admin.
  const admin = createServiceClient();
  const { data: taken } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (taken && taken.id !== user.id) return { ok: false, message: "That handle is taken." };

  const { error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", user.id);

  if (error) {
    return {
      ok: false,
      message: /duplicate|unique/i.test(error.message)
        ? "That handle was just taken. Try another."
        : error.message,
    };
  }

  revalidatePath("/account");
  return { ok: true, message: `Your profile is at /u/${username}` };
}

export async function saveProfile(
  _prev: SaveResult | null,
  formData: FormData,
): Promise<SaveResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "You're signed out. Sign in and try again." };

  const displayName = String(formData.get("display_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const isPublic = formData.get("is_public") === "on";

  if (!displayName) return { ok: false, message: "Enter a name." };
  if (displayName.length > 60) return { ok: false, message: "That name is too long." };
  if (bio.length > 280) return { ok: false, message: "Keep the bio under 280 characters." };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, bio: bio || null, is_public: isPublic })
    .eq("id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/account");
  return { ok: true, message: "Saved." };
}

/* ---------------------------------------------------------------------------
   What brings you here — the first-run chooser (lib/focus.ts).
   --------------------------------------------------------------------------- */

/** Writes the answer. Returns it, or null if there wasn't a usable one. */
async function setFocus(formData: FormData): Promise<ProfileFocus | null> {
  const { supabase, user } = await requireUser();
  if (!user) return null;

  const value = formData.get("focus");
  // A Server Action is its own entry point, so this is the real validation
  // rather than a formality — the three buttons can't produce anything else.
  if (!isFocus(value)) return null;

  const { error } = await supabase.from("profiles").update({ focus: value }).eq("id", user.id);
  if (error) return null;

  revalidatePath("/account");
  return value;
}

/**
 * From `/welcome`: answer, then go to the home that answer implies.
 *
 * A failed write falls back to `/account` rather than looping on the chooser —
 * an unanswered question is a much smaller problem than a page somebody can't
 * get out of, and the same control is on the account page.
 */
export async function chooseFocus(formData: FormData) {
  const value = await setFocus(formData);
  redirect(value ? landingFor(value) : "/account");
}

/** From the account page: change it and stay put. The page reorders under you. */
export async function changeFocus(formData: FormData) {
  await setFocus(formData);
}

/**
 * Where "near me" is measured from, and where a route starts.
 *
 * Also the reason wishlist alerts can reach someone at all —
 * match_sale_to_wishlists() only matches profiles that have a home point.
 */
export async function saveHome(
  _prev: SaveResult | null,
  formData: FormData,
): Promise<SaveResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "You're signed out. Sign in and try again." };

  const address = String(formData.get("address") ?? "").trim();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const radius = Number(formData.get("radius_miles"));

  if (address && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
    return { ok: false, message: "Pick your address from the suggestions." };
  }

  if (formData.get("radius_miles") !== null && !(radius >= 1 && radius <= MAX_RADIUS_MILES)) {
    return { ok: false, message: `Pick a distance between 1 and ${MAX_RADIUS_MILES} miles.` };
  }

  if (address) {
    const { error } = await supabase
      .from("profiles")
      // lng first — PostGIS takes x,y. Reversed, everyone lands in the wrong place.
      .update({ home_address: address, home_point: `SRID=4326;POINT(${lng} ${lat})` })
      .eq("id", user.id);
    if (error) return { ok: false, message: error.message };
  }

  if (Number.isFinite(radius) && radius >= 1 && radius <= MAX_RADIUS_MILES) {
    const { error } = await supabase
      .from("notification_prefs")
      .update({ radius_miles: Math.round(radius) })
      .eq("profile_id", user.id);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath("/account");
  return { ok: true, message: "Saved." };
}
