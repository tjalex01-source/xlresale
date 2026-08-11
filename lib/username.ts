/**
 * Username rules. Must stay in step with the database constraint in
 * schema-additions-auth-profiles.sql:
 *
 *   check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$')
 *
 * The column is `citext`, so uniqueness is case-insensitive — "TJ" and "tj" are
 * the same handle.
 */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

/**
 * Handles we never hand out, because `/u/username` shares a namespace with the
 * app's own routes and because impersonation is cheap to prevent up front.
 */
const RESERVED = new Set([
  "about",
  "account",
  "admin",
  "api",
  "auth",
  "help",
  "host",
  "login",
  "logout",
  "map",
  "new",
  "nub",
  "privacy",
  "route",
  "sale",
  "sales",
  "settings",
  "signup",
  "support",
  "terms",
  "u",
  "xlresale",
]);

export type UsernameError = "format" | "reserved";

/** Returns null when the handle is usable, or why it isn't. */
export function validateUsername(raw: string): UsernameError | null {
  const username = raw.trim();
  if (!USERNAME_PATTERN.test(username)) return "format";
  if (RESERVED.has(username.toLowerCase())) return "reserved";
  return null;
}

export const USERNAME_HINT =
  "3–20 characters: letters, numbers, and underscores.";

export function usernameErrorMessage(error: UsernameError): string {
  return error === "reserved"
    ? "That handle is reserved. Pick another."
    : USERNAME_HINT;
}
