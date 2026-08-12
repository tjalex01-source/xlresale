/**
 * Shopper preference limits.
 *
 * Lives outside the "use server" action file because such a file may only
 * export async functions — a constant there is a build error. Both the form's
 * input cap and the server-side check read from here so they can't drift apart.
 */

/**
 * Upper bound on the "near me" search radius, in miles. 200 is generous — much
 * beyond that and a proximity map stops meaning anything — but well past the
 * 40-mile preset for anyone rural who genuinely drives that far for a sale.
 */
export const MAX_RADIUS_MILES = 200;

/** One-tap distances. Anything else goes through "Other". */
export const RADIUS_PRESETS: readonly number[] = [2, 5, 10, 20, 40];
