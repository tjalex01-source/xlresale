import { NextResponse } from "next/server";

import { sendPendingAlerts } from "@/lib/notify";

/**
 * Sweep for unsent wishlist alerts.
 *
 * Alerts are normally sent the instant a sale is published, so this is the
 * safety net: it catches anything queued while the inline send failed, or by a
 * publish that didn't go through the app at all (an admin restore, a row edited
 * in the SQL editor — the trigger fires either way).
 *
 * Wire it in Vercel → Settings → Cron Jobs, hitting /api/cron/send-alerts.
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

  const report = await sendPendingAlerts();
  return NextResponse.json(report);
}
