import { createServiceClient } from "@/lib/supabase/server";
import { formatHours, formatSaleDay } from "@/lib/sale-time";
import { describeOutlook, weatherNudgeFor } from "@/lib/weather";

/**
 * The proactive half of the weather nudge.
 *
 * The dashboard card only helps a host who opens the dashboard, and most won't
 * between listing a sale and standing in the driveway. CLAUDE.md §6 says Nub
 * "proactively offers a one-tap reschedule a day or two out", and that word is
 * the feature — so once a day the forecast is checked for every upcoming sale
 * and rained-off hosts get an email pointing back at the card.
 *
 * `sales.weather_nudged_for` is stamped with the date warned about, so this
 * says its piece once per date. If the host then moves the sale, `sale_date` no
 * longer matches the stamp and a fresh forecast for the new date can speak up.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.xlresale.com";
const FROM = process.env.ALERTS_FROM_EMAIL ?? "XLResale <alerts@xlresale.com>";

export interface NudgeReport {
  checked: number;
  rainedOff: number;
  emailed: number;
  failed: number;
  errors: string[];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function body(sale: { id: string; title: string }, outlook: string, when: string, options: string[]) {
  const url = `${SITE}/host/${sale.id}`;
  const suggestion = options.length
    ? `Drier days this week: ${options.join(", ")}.`
    : `Nothing drier in the next week, but you can move it to any future date.`;

  return {
    subject: `Rain forecast for ${when}`,
    text: [
      `${outlook} during your hours on ${when}.`,
      ``,
      sale.title,
      ``,
      suggestion,
      `Moving it is free — the $5 buys the sale, not the date.`,
      ``,
      url,
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;color:#17131f">
        <p style="font-size:17px;margin:0 0 16px">${escapeHtml(outlook)} during your hours on ${escapeHtml(when)}.</p>
        <div style="border:1px solid #e9e5ee;border-radius:16px;padding:16px;margin:0 0 20px">
          <p style="font-size:19px;font-weight:700;margin:0 0 6px">${escapeHtml(sale.title)}</p>
          <p style="margin:0;color:#5b5468">${escapeHtml(suggestion)}</p>
        </div>
        <p style="margin:0 0 20px;color:#5b5468">Moving it is free &mdash; the $5 buys the sale, not the date.</p>
        <p style="margin:0 0 24px">
          <a href="${url}" style="background:#ff2e63;color:#fff;text-decoration:none;border-radius:12px;padding:13px 22px;font-weight:700;display:inline-block">Pick a new date</a>
        </p>
      </div>`,
  };
}

export async function sendWeatherNudges(): Promise<NudgeReport> {
  const report: NudgeReport = { checked: 0, rainedOff: 0, emailed: 0, failed: 0, errors: [] };

  const admin = createServiceClient();
  const { data: sales, error } = await admin.rpc("upcoming_sales_for_weather", { in_days: 7 });
  if (error) {
    report.errors.push(error.message);
    return report;
  }
  if (!sales?.length) return report;

  report.checked = sales.length;

  // Emails live in auth.users, which has no RLS path — same approach as
  // lib/notify.ts, one page rather than a lookup per host.
  const { data: userPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map(userPage.users.map((u) => [u.id, u.email ?? null]));
  const key = process.env.RESEND_API_KEY;

  for (const sale of sales) {
    const nudge = await weatherNudgeFor(
      {
        sale_date: sale.sale_date,
        opens_at: sale.opens_at,
        closes_at: sale.closes_at,
        time_zone: sale.time_zone,
      },
      { lat: sale.lat, lng: sale.lng },
    );
    if (!nudge) continue;

    report.rainedOff += 1;

    // Stamp BEFORE sending. A send that throws halfway costs one host one
    // email; stamping afterwards would risk mailing the same host every
    // morning for a week if the mailer were misconfigured — and the dashboard
    // card still tells them either way, so nothing is lost by being quiet.
    await admin
      .from("sales")
      .update({ weather_nudged_for: sale.sale_date })
      .eq("id", sale.id);

    const to = emailById.get(sale.host_id);
    if (!to) continue;
    if (!key) {
      report.failed += 1;
      if (report.errors.length < 5) report.errors.push("RESEND_API_KEY is not set");
      continue;
    }

    const when = `${formatSaleDay(sale.sale_date)}, ${formatHours(sale.opens_at, sale.closes_at)}`;
    const { subject, text, html } = body(
      sale,
      describeOutlook(nudge.current),
      when,
      nudge.alternatives.map((day) => formatSaleDay(day.date)),
    );

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to, subject, text, html }),
      });
      if (response.ok) {
        report.emailed += 1;
      } else {
        report.failed += 1;
        if (report.errors.length < 5) {
          report.errors.push(`resend ${response.status}: ${(await response.text()).slice(0, 160)}`);
        }
      }
    } catch (e) {
      report.failed += 1;
      if (report.errors.length < 5) report.errors.push(String(e).slice(0, 160));
    }
  }

  return report;
}
