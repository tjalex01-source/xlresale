/**
 * Which side of the marketplace someone came for, and what that changes.
 *
 * Asked once, on a first sign-in (`/welcome`), and changeable from the account
 * page afterwards. `schema-additions-focus.sql` explains why the column isn't
 * called `role`: this orders a page and picks a landing, and must never grow
 * into an authorisation check.
 *
 * The rule from the UX pass, which is the whole reason this is subtle: the
 * answer REORDERS, it never hides. "Both" will be the popular answer by a wide
 * margin, so it has to mean *buyer-first with selling still visible* rather than
 * "show them everything", or the choice buys nothing.
 */

import type { Database } from "@/lib/database.types";

export type ProfileFocus = Database["public"]["Enums"]["profile_focus"];

export const FOCUS_OPTIONS = [
  {
    value: "shopping",
    label: "Shopping",
    blurb: "Sales near me, and a route that beats the clock.",
  },
  {
    value: "selling",
    label: "Selling",
    blurb: "Put my driveway on every map in town.",
  },
  {
    value: "both",
    label: "Both",
    blurb: "Shopping mostly. Selling when the garage fills up.",
  },
] as const satisfies readonly { value: ProfileFocus; label: string; blurb: string }[];

export function isFocus(value: unknown): value is ProfileFocus {
  return FOCUS_OPTIONS.some((o) => o.value === value);
}

/**
 * Where sign-in goes when nobody asked for anywhere in particular.
 *
 * Compared against, not just used as a fallback: a `next` equal to this is how
 * the login form says "no preference", and only that case gets replaced by the
 * landing below. Somebody who clicked "List your sale" arrives with an explicit
 * target and keeps it — asking "what brings you here?" one tap after they said
 * so is the kind of interstitial that makes an app feel like paperwork.
 */
export const DEFAULT_LANDING = "/account";

/**
 * The home this answer implies.
 *
 * `null` means the question hasn't been asked yet, which is what routes a first
 * sign-in into the chooser. Everyone who signed up before this shipped is null,
 * so they each get asked once.
 *
 * Shopping and Both both land on the map — the buyer home the UX pass argued
 * for. Selling lands on the seller dashboard, because a host signing in on a
 * Saturday morning is there to tap Go live, not to read their profile.
 */
export function landingFor(focus: ProfileFocus | null | undefined): string {
  switch (focus) {
    case "selling":
      return "/host";
    case "shopping":
    case "both":
      return "/map";
    default:
      return "/welcome";
  }
}
