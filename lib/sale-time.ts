/**
 * Formatting for sale dates and hours.
 *
 * Every sale carries its own IANA `time_zone` because its hours are wall-clock
 * local to the address, not to whoever is looking. A shopper in Dallas reading
 * a sale in Phoenix should see the Phoenix hours, unchanged.
 *
 * `sale_date` and `opens_at`/`closes_at` are a bare DATE and TIME — no zone
 * attached — so they are formatted as the literal strings they are. Only
 * "is it open right now?" needs real timezone arithmetic, and that is the one
 * function here that does it.
 */

/** "9:30am" / "1pm" — trailing ":00" dropped, the way a person writes hours. */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

export function formatHours(opensAt: string, closesAt: string): string {
  return `${formatTime(opensAt)}–${formatTime(closesAt)}`;
}

/**
 * "Today" / "Tomorrow" / "Sat, Aug 15".
 *
 * Parsed as a local date rather than through `new Date("2026-08-15")`, which
 * ISO-parses to UTC midnight and renders as the previous day for anyone west
 * of Greenwich — the single most common way sale dates come out wrong.
 */
export function formatSaleDay(saleDate: string, today = new Date()): string {
  const [y, m, d] = saleDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((date.getTime() - midnight.getTime()) / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** True when the sale happens today, in the viewer's own calendar. */
export function isToday(saleDate: string, today = new Date()): boolean {
  return saleDate === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

/**
 * Whether the status label is worth showing.
 *
 * `scheduled` reads "Open today", which is true on the host's dashboard — they
 * only ever look at a sale on its own day — but wrong in a list that spans a
 * week, where it would caption a sale three days out as opening today. For a
 * future sale the date line already says everything; the pin colour still
 * carries the status.
 */
export function shouldShowStatus(
  sale: { sale_date: string; status: string },
  today = new Date(),
): boolean {
  return sale.status !== "scheduled" || isToday(sale.sale_date, today);
}

/** True when the sale's day is in the past — used to sort saved sales. */
export function isPast(saleDate: string, today = new Date()): boolean {
  const [y, m, d] = saleDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date.getTime() < midnight.getTime();
}

/**
 * The sale's own wall-clock time right now, as "HH:MM".
 *
 * en-CA gives a zero-padded 24-hour clock, which string-compares correctly
 * against the TIME columns. Formatting to en-US and parsing back would lose
 * that property at noon and midnight.
 */
export function localClock(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
  } catch {
    // A bad or unknown zone must not take the page down; fall back to the
    // viewer's own clock, which is close enough for a display hint.
    return new Intl.DateTimeFormat("en-CA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
  }
}

/**
 * Whether the sale's posted hours cover this moment, in the sale's own zone.
 *
 * This is the *scheduled* answer, deliberately separate from `status`, which is
 * what the host actually pressed. The two disagree on purpose: a host who
 * hasn't tapped Go Live yet is `scheduled` even at 9am, and that gap is the
 * whole point of the Go Live button. Never use this to override `status`.
 */
export function isWithinPostedHours(
  sale: { sale_date: string; opens_at: string; closes_at: string; time_zone: string },
  now = new Date(),
): boolean {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: sale.time_zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  if (today !== sale.sale_date) return false;

  const clock = localClock(sale.time_zone, now);
  return clock >= sale.opens_at.slice(0, 5) && clock < sale.closes_at.slice(0, 5);
}

/** Miles, at the precision a driver cares about. */
export function formatMiles(miles: number): string {
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}
