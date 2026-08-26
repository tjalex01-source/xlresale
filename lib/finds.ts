/**
 * Finds — the growth loop (CLAUDE.md §6).
 *
 * "Every shared find is a free ad", which only holds if the shared thing looks
 * like something. The maths and the URLs live here because four surfaces need
 * the same answers — the finder's own list, their public profile, the share
 * page, and the Open Graph card that renders in someone else's chat app — and a
 * find that says "saved $160" in one place and "$160 off" in another is two
 * different brags.
 */

export const FINDS_BUCKET = "finds";

/** Where a find's photo actually lives. Public bucket; no signing needed. */
export function findPhotoUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${FINDS_BUCKET}/${storagePath}`;
}

/**
 * The canonical origin, for links that have to survive leaving the site —
 * an Open Graph tag, a copied link, the image URL inside a card.
 *
 * A relative path is fine inside a page and useless in a share sheet, so this
 * is the one place that has to know the real hostname.
 *
 * The environment split matters. `VERCEL_PROJECT_PRODUCTION_URL` is the custom
 * domain and is set on *every* deployment, previews included — so taking it
 * unconditionally would make a preview build emit production share links and
 * fetch production assets, which is the opposite of what a preview is for.
 * It's therefore only trusted when this actually is production.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // A preview or branch deployment: its own URL is the one that works.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3011";
}

export const findPath = (id: string) => `/f/${id}`;
export const findUrl = (id: string) => `${siteUrl()}${findPath(id)}`;

export interface FindMoney {
  price_paid: number | null;
  est_value: number | null;
}

/**
 * The brag, or null when there isn't one.
 *
 * Both numbers are optional and either can be left out, so "worth more than you
 * paid" is only claimable when both are present and it's actually true. A find
 * logged at $40 with no estimate is still a find; it just doesn't get a badge.
 */
export function savedAmount(find: FindMoney): number | null {
  const { price_paid: paid, est_value: worth } = find;
  if (paid === null || worth === null) return null;
  const saved = worth - paid;
  return saved > 0 ? saved : null;
}

/** "$180" · "$12.50" — whole dollars stay whole, because $180.00 reads as a form field. */
export function formatDollars(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

/** One line for a share sheet or a meta description. */
export function findSummary(find: FindMoney & { title: string }): string {
  const saved = savedAmount(find);
  if (saved !== null && find.price_paid !== null) {
    return `${find.title} — paid ${formatDollars(find.price_paid)}, worth ${formatDollars(
      find.est_value!,
    )}.`;
  }
  if (find.price_paid !== null) return `${find.title} — ${formatDollars(find.price_paid)}.`;
  return find.title;
}
