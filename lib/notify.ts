import webpush from "web-push";

import { createServiceClient } from "@/lib/supabase/server";
import { formatHours, formatSaleDay } from "@/lib/sale-time";

/**
 * Delivery for wishlist alerts — the retention hook (CLAUDE.md §6).
 *
 * Matches are queued by a database trigger the moment a sale becomes public
 * (schema-additions-notify.sql). This is the other half: it takes everything
 * unsent, emails it, pushes it, and stamps `notified_at` so nobody is told
 * twice.
 *
 * Runs from two places — right after a sale is published, so alerts feel
 * immediate, and from a cron sweep that catches anything the inline call
 * missed. Both are safe to run concurrently because a row is only ever claimed
 * once (see the notified_at update below).
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.xlresale.com";
const FROM = process.env.ALERTS_FROM_EMAIL ?? "XLResale <alerts@xlresale.com>";

export interface DeliveryReport {
  considered: number;
  emailed: number;
  pushed: number;
  failed: number;
  skipped: number;
  errors: string[];
}

type PendingAlert = {
  alert_id: string;
  shopper_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  matched_term: string | null;
  sale_id: string;
  sale_title: string;
  sale_address: string;
  sale_date: string;
  opens_at: string;
  closes_at: string;
  free_pile: boolean;
};

function emailBody(alert: PendingAlert) {
  const when = `${formatSaleDay(alert.sale_date)}, ${formatHours(alert.opens_at, alert.closes_at)}`;
  const url = `${SITE}/s/${alert.sale_id}`;

  return {
    subject: alert.matched_term
      ? `Someone near you listed ${alert.matched_term}`
      : "A sale near you just went up",
    // Plain, scannable, and useful in the preview line — this arrives on a
    // phone on a Friday night and has about two seconds to earn a tap.
    text: [
      alert.matched_term
        ? `You're watching for "${alert.matched_term}", and a sale near you just listed it.`
        : `A sale near you just went up.`,
      ``,
      alert.sale_title,
      alert.sale_address,
      when,
      alert.free_pile ? `There's a free pile.` : ``,
      ``,
      url,
      ``,
      `Stop these any time: ${SITE}/shop/alerts`,
    ]
      .filter((line) => line !== undefined)
      .join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;color:#17131f">
        <p style="font-size:17px;margin:0 0 16px">
          ${
            alert.matched_term
              ? `You're watching for <strong>${escapeHtml(alert.matched_term)}</strong>, and a sale near you just listed it.`
              : `A sale near you just went up.`
          }
        </p>
        <div style="border:1px solid #e9e5ee;border-radius:16px;padding:16px;margin:0 0 20px">
          <p style="font-size:19px;font-weight:700;margin:0 0 6px">${escapeHtml(alert.sale_title)}</p>
          <p style="margin:0 0 4px;color:#5b5468">${escapeHtml(alert.sale_address)}</p>
          <p style="margin:0;color:#5b5468">${escapeHtml(when)}</p>
          ${alert.free_pile ? `<p style="margin:10px 0 0"><span style="background:#12b76a;color:#17131f;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13px">FREE PILE</span></p>` : ""}
        </div>
        <p style="margin:0 0 24px">
          <a href="${url}" style="background:#ff2e63;color:#fff;text-decoration:none;border-radius:12px;padding:13px 22px;font-weight:700;display:inline-block">See the sale</a>
        </p>
        <p style="font-size:13px;color:#8a8398;margin:0">
          <a href="${SITE}/shop/alerts" style="color:#8a8398">Change or stop these alerts</a>
        </p>
      </div>`,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendEmail(to: string, alert: PendingAlert): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "RESEND_API_KEY is not set";

  const { subject, text, html } = emailBody(alert);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, text, html }),
  });

  if (!response.ok) return `resend ${response.status}: ${(await response.text()).slice(0, 160)}`;
  return null;
}

/**
 * Push to every device this shopper has registered.
 *
 * A 404 or 410 from the push service means the subscription is dead — the
 * browser was uninstalled, or permission revoked — so the row is deleted rather
 * than retried forever.
 */
async function sendPush(alert: PendingAlert): Promise<{ sent: number; error?: string }> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return { sent: 0, error: "VAPID keys are not set" };

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:hello@xlresale.com",
    publicKey,
    privateKey,
  );

  const admin = createServiceClient();
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("profile_id", alert.shopper_id);

  if (!subscriptions?.length) return { sent: 0 };

  const payload = JSON.stringify({
    title: alert.matched_term
      ? `Someone near you listed ${alert.matched_term}`
      : "A sale near you just went up",
    body: `${alert.sale_title} — ${formatSaleDay(alert.sale_date)}, ${formatHours(alert.opens_at, alert.closes_at)}`,
    url: `/s/${alert.sale_id}`,
    tag: `sale-${alert.sale_id}`,
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return { sent };
}

export async function sendPendingAlerts(limit = 200): Promise<DeliveryReport> {
  const admin = createServiceClient();
  const report: DeliveryReport = {
    considered: 0,
    emailed: 0,
    pushed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const { data: pending, error } = await admin.rpc("pending_alerts", { in_limit: limit });
  if (error) {
    report.errors.push(error.message);
    return report;
  }

  const alerts = (pending ?? []) as PendingAlert[];
  report.considered = alerts.length;
  if (!alerts.length) return report;

  // Emails live in auth.users, which has no RLS path, so they come from the
  // admin API rather than a join.
  const { data: userPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map(userPage.users.map((u) => [u.id, u.email ?? null]));

  for (const alert of alerts) {
    // Claim the row FIRST. If sending throws halfway through, the worst case is
    // one alert nobody receives; claiming afterwards would risk mailing the
    // same person repeatedly every time the cron overlapped a slow send.
    const { data: claimed } = await admin
      .from("wishlist_alerts")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", alert.alert_id)
      .is("notified_at", null)
      .select("id");

    if (!claimed?.length) {
      report.skipped += 1; // another run got there first
      continue;
    }

    let delivered = 0;
    let attempted = 0;

    if (alert.email_enabled) {
      const to = emailById.get(alert.shopper_id);
      if (to) {
        attempted += 1;
        const failure = await sendEmail(to, alert);
        if (failure) {
          report.failed += 1;
          if (report.errors.length < 5) report.errors.push(failure);
        } else {
          report.emailed += 1;
          delivered += 1;
        }
      }
    }

    if (alert.push_enabled) {
      attempted += 1;
      const { sent, error: pushError } = await sendPush(alert);
      report.pushed += sent;
      delivered += sent;
      if (pushError && report.errors.length < 5) report.errors.push(pushError);
    }

    // Put it back if we tried to reach them and nothing landed. Claiming first
    // is what stops a slow send being mailed twice by an overlapping run, but
    // left alone it would also mean a missing API key silently swallows the
    // alert forever. Releasing makes a misconfiguration recoverable: fix the
    // key, and the next sweep delivers.
    if (attempted > 0 && delivered === 0) {
      await admin
        .from("wishlist_alerts")
        .update({ notified_at: null })
        .eq("id", alert.alert_id);
    }
  }

  return report;
}
