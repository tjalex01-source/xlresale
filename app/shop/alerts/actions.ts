"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { MAX_RADIUS_MILES } from "@/lib/prefs";

export type Result = { ok: true; message?: string } | { ok: false; message: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Add an interest: a category, a search term, or both.
 *
 * Categories are the more natural way to ask — most people know the KIND of
 * thing they want before they know the word for it — so a term is no longer
 * required. When both are given the term NARROWS the categories rather than
 * standing in for them.
 *
 * Terms are stored lowercase and trimmed so "Power Tools" and "power tools "
 * don't become two rows that both fire on the same sale.
 */
export async function addWishlist(_prev: Result | null, formData: FormData): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "You're signed out. Sign in and try again." };

  const term = String(formData.get("term") ?? "").trim().toLowerCase();
  const maxMiles = Number(formData.get("max_miles"));
  const categoryIds = formData
    .getAll("category_ids")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (!term && categoryIds.length === 0) {
    return { ok: false, message: "Pick a category, or type what you're after." };
  }
  if (term && term.length < 2) {
    return { ok: false, message: "Give it at least a couple of characters." };
  }
  if (term.length > 60) return { ok: false, message: "Keep it short — one thing per alert." };
  if (!(maxMiles >= 1 && maxMiles <= MAX_RADIUS_MILES)) {
    return { ok: false, message: `Pick a distance between 1 and ${MAX_RADIUS_MILES} miles.` };
  }

  if (term) {
    const { data: existing } = await supabase
      .from("wishlists")
      .select("id")
      .eq("shopper_id", user.id)
      .eq("term", term)
      .maybeSingle();

    if (existing) return { ok: false, message: `You're already watching for "${term}".` };
  }

  const { error } = await supabase.from("wishlists").insert({
    shopper_id: user.id,
    term: term || null,
    max_miles: Math.round(maxMiles),
    category_ids: categoryIds,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/shop/alerts");
  return { ok: true, message: term ? `Watching for "${term}".` : "Added." };
}

export async function removeWishlist(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "You're signed out." };

  const { error } = await supabase.from("wishlists").delete().eq("id", id).eq("shopper_id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/shop/alerts");
  return { ok: true };
}

/** Pause an alert without losing it — the usual case after finding the thing. */
export async function setWishlistActive(id: string, active: boolean): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "You're signed out." };

  const { error } = await supabase
    .from("wishlists")
    .update({ active })
    .eq("id", id)
    .eq("shopper_id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/shop/alerts");
  return { ok: true };
}

/**
 * Notification channels and the bulk-lot opt-in.
 *
 * Only email is offered: CLAUDE.md §6 defers push and SMS to v2, and SMS in
 * particular can't ship without recording A2P/TCPA consent, which is a
 * different piece of work than a checkbox.
 */
export async function saveAlertPrefs(_prev: Result | null, formData: FormData): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "You're signed out. Sign in and try again." };

  const bulkLots = formData.get("bulk_lots_enabled") === "on";

  // Only meaningful when the opt-in is on; storing categories for someone who
  // opted out would quietly resurrect their old picks if they ever opt back in.
  const categories = bulkLots
    ? formData
        .getAll("bulk_lot_categories")
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0)
    : [];

  const { error } = await supabase
    .from("notification_prefs")
    .update({
      email_enabled: formData.get("email_enabled") === "on",
      bulk_lots_enabled: bulkLots,
      bulk_lot_categories: categories,
    })
    .eq("profile_id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/shop/alerts");
  return { ok: true, message: "Saved." };
}

/**
 * Clears the unread badge. Explicit, so nothing is marked read by a stray
 * render — marking on view would clear the badge for alerts scrolled past.
 *
 * Returns void because it is bound straight to a <form action>, whose contract
 * is `(formData) => void | Promise<void>`. Nothing consumes a result here: the
 * page revalidates and the badge is simply gone.
 */
export async function markAlertsSeen(): Promise<void> {
  const { supabase, user } = await requireUser();
  if (!user) return;

  await supabase
    .from("wishlist_alerts")
    .update({ seen_at: new Date().toISOString() })
    .eq("shopper_id", user.id)
    .is("seen_at", null);

  revalidatePath("/shop/alerts");
  revalidatePath("/shop");
}
