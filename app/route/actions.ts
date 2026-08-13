"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type Result = { ok: true; message?: string } | { ok: false; message: string };

/**
 * Persist the day's route.
 *
 * One row per shopper per day (unique index in schema-additions-buyer.sql), so
 * re-planning a Saturday overwrites that Saturday instead of leaving a pile of
 * near-identical routes nobody can tell apart.
 */
export async function saveRoute(routeDate: string, stopIds: string[]): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "You're signed out. Sign in and try again." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(routeDate)) return { ok: false, message: "Bad date." };
  if (stopIds.length === 0) return { ok: false, message: "Add a stop first." };

  const { error } = await supabase.from("saved_routes").upsert(
    {
      shopper_id: user.id,
      route_date: routeDate,
      stop_ids: stopIds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "shopper_id,route_date" },
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/route");
  return { ok: true, message: "Route saved." };
}
