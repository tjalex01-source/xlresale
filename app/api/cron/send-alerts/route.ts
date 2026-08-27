import { NextResponse } from "next/server";

import { sendPendingAlerts } from "@/lib/notify";
import { sendWeatherNudges } from "@/lib/weather-nudge";

/**
 * The daily sweep.
 *
 * Two jobs share one route on purpose. Vercel's lower plans cap how many cron
 * jobs a project may have, and both of these want to run once a day at the same
 * sort of time — so they're one endpoint rather than a second entry competing
 * for the allowance. The path keeps its original name because a cron is already
 * configured against it.
 *
 * 1. Unsent wishlist alerts. These are normally sent the instant a sale is
 *    published, so this is the safety net: it catches anything queued while the
 *    inline send failed, or by a publish that didn't go through the app at all
 *    (an admin restore, a row edited in the SQL editor — the trigger fires
 *    either way).
 *
 * 2. Weather nudges. Checks the forecast for every upcoming sale and emails
 *    hosts who are about to be rained off, which is the "proactively" half of
 *    CLAUDE.md §6 — the dashboard card only reaches a host who visits it.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Vercel Cron sends the secret as a bearer token. Without CRON_SECRET set,
  // refuse rather than run — an open endpoint that sends email to strangers is
  // worse than one that doesn't run.
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  // Sequential, not Promise.all: both talk to Resend, and a weather nudge that
  // fails should not take the alert sweep's report down with it.
  const alerts = await sendPendingAlerts();
  const weather = await sendWeatherNudges();

  return NextResponse.json({ alerts, weather });
}
