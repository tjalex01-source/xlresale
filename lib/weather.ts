/**
 * The weather nudge (CLAUDE.md §6).
 *
 * "A forecast API checks each upcoming sale; if rain's likely, Nub proactively
 * offers a one-tap reschedule a day or two out. Never touches money."
 *
 * Open-Meteo, because it needs no API key and no billing account. That isn't
 * laziness: every other key in this project is one more thing for T.J. to add
 * in a dashboard and one more thing to expire silently. Free for
 * non-commercial use and generous beyond that; if XLResale ever outgrows the
 * fair-use limit, the paid tier is the same API with a key.
 *
 * Forecasts are read HOURLY and clipped to the sale's own opening hours. A
 * daily figure would move a sale because of rain at nine in the evening, three
 * hours after the driveway was packed up — and a nudge that is wrong even
 * occasionally is worse than no nudge, because the host stops believing it.
 */

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

/**
 * What counts as rained off.
 *
 * Both must hold. Probability alone flags a 70%-chance-of-a-sprinkle day that
 * turns out fine; accumulation alone flags a brief downpour the forecast is not
 * confident about. Requiring both is what keeps this quiet enough to trust.
 */
const WASHOUT_CHANCE = 60; // percent, at the worst hour of the sale
const WASHOUT_MM = 1; // total across the sale's hours

/** A day is only worth suggesting if it looks clearly better than the one being left. */
const DRY_CHANCE = 30;

/** Open-Meteo's hourly precipitation_probability runs out past this. */
export const FORECAST_DAYS = 7;

export interface SaleHours {
  sale_date: string; // YYYY-MM-DD
  opens_at: string; // HH:MM[:SS]
  closes_at: string;
  time_zone: string;
}

export interface DayOutlook {
  date: string;
  /** Worst hourly chance of rain across the sale's opening hours, 0-100. */
  chance: number;
  /** Total millimetres expected across those hours. */
  millimetres: number;
  washout: boolean;
  dry: boolean;
}

export interface WeatherNudge {
  /** The day the sale is currently on. */
  current: DayOutlook;
  /** Dry days worth moving to, nearest first, weekends preferred. */
  alternatives: DayOutlook[];
}

interface OpenMeteoHourly {
  hourly?: {
    time?: string[];
    precipitation_probability?: (number | null)[];
    precipitation?: (number | null)[];
  };
}

/**
 * One forecast per location per half hour, shared across renders.
 *
 * The host dashboard, the sale list and the nightly cron all ask about the same
 * handful of driveways, and Open-Meteo publishes hourly — so re-asking on every
 * page render would be rude to a free service for no fresher an answer.
 */
const cache = new Map<string, { at: number; body: OpenMeteoHourly }>();
const CACHE_MS = 30 * 60 * 1000;

const hourOf = (time: string) => Number(time.slice(0, 2));

/** "2026-08-29" → true when that's a Saturday or Sunday. Parsed as UTC noon to
 *  dodge the off-by-one a bare date gets in a negative-offset zone. */
function isWeekend(date: string): boolean {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchForecast(
  lat: number,
  lng: number,
  timeZone: string,
  from: string,
  to: string,
): Promise<OpenMeteoHourly | null> {
  // Rounded to ~1km: two driveways on the same street share a forecast, and
  // there is no useful weather difference between them.
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${timeZone},${from},${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;

  const url =
    `${ENDPOINT}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&hourly=precipitation_probability,precipitation` +
    `&timezone=${encodeURIComponent(timeZone)}` +
    `&start_date=${from}&end_date=${to}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const body = (await response.json()) as OpenMeteoHourly;
    cache.set(key, { at: Date.now(), body });
    return body;
  } catch {
    // A forecast is a nicety. Nothing that depends on this may fail because a
    // third party is slow — the caller gets null and shows no nudge at all.
    return null;
  }
}

/** Reduce the hourly series to one verdict per day, over the sale's own hours. */
function readDay(body: OpenMeteoHourly, date: string, openHour: number, closeHour: number): DayOutlook {
  const times = body.hourly?.time ?? [];
  const chances = body.hourly?.precipitation_probability ?? [];
  const amounts = body.hourly?.precipitation ?? [];

  let chance = 0;
  let millimetres = 0;

  for (let i = 0; i < times.length; i++) {
    const stamp = times[i];
    if (!stamp.startsWith(date)) continue;

    // Open-Meteo timestamps are local to the requested zone, which is the
    // sale's own — so these hours compare directly with opens_at/closes_at.
    const hour = hourOf(stamp.slice(11));
    if (hour < openHour || hour >= closeHour) continue;

    chance = Math.max(chance, chances[i] ?? 0);
    millimetres += amounts[i] ?? 0;
  }

  millimetres = Math.round(millimetres * 10) / 10;

  return {
    date,
    chance,
    millimetres,
    washout: chance >= WASHOUT_CHANCE && millimetres >= WASHOUT_MM,
    dry: chance < DRY_CHANCE,
  };
}

/**
 * Should this host be offered a new date, and which?
 *
 * Returns null when the forecast can't be had, the sale is outside the horizon,
 * or the day looks fine — the three cases where the honest answer is to say
 * nothing at all.
 */
export async function weatherNudgeFor(
  sale: SaleHours,
  point: { lat: number; lng: number },
  today = new Date().toLocaleDateString("en-CA"),
): Promise<WeatherNudge | null> {
  if (sale.sale_date < today) return null;
  const horizon = addDays(today, FORECAST_DAYS);
  if (sale.sale_date > horizon) return null;

  const body = await fetchForecast(point.lat, point.lng, sale.time_zone, today, horizon);
  if (!body?.hourly?.time?.length) return null;

  const openHour = hourOf(sale.opens_at);
  // A sale closing at 14:30 still cares about the 14:00 hour, so the closing
  // hour is included whenever there are minutes on the clock.
  const closeHour = hourOf(sale.closes_at) + (sale.closes_at.slice(3, 5) === "00" ? 0 : 1);

  const current = readDay(body, sale.sale_date, openHour, closeHour);
  if (!current.washout) return null;

  const alternatives: DayOutlook[] = [];
  for (let offset = 1; offset <= FORECAST_DAYS; offset++) {
    const date = addDays(sale.sale_date, offset);
    if (date > horizon) break;
    const outlook = readDay(body, date, openHour, closeHour);
    if (outlook.dry) alternatives.push(outlook);
  }

  // Weekends first: a garage sale on a Tuesday is worse advice than one a few
  // days further out. Within each group, soonest wins.
  alternatives.sort((a, b) => {
    const weekend = Number(isWeekend(b.date)) - Number(isWeekend(a.date));
    return weekend !== 0 ? weekend : a.date.localeCompare(b.date);
  });

  return { current, alternatives: alternatives.slice(0, 3) };
}

/** "80% chance, 4mm" — the evidence, so the host can disagree with it. */
export function describeOutlook(outlook: DayOutlook): string {
  return `${outlook.chance}% chance of rain, ${outlook.millimetres}mm`;
}
