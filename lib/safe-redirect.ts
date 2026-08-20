/**
 * Resolve a caller-supplied `next` target to an absolute same-origin URL.
 *
 * The obvious guard — `next.startsWith("/") && !next.startsWith("//")` — is not
 * enough on its own. The URL parser normalises backslashes to slashes and
 * strips tabs and newlines AFTER a string test has already passed, so
 * `/\evil.com`, `/..//evil.com` and `/\t/evil.com` all sail through it. Tested
 * against this project's own code: because both call sites compose the value
 * onto a real origin, those payloads land on `xlresale.com//evil.com` and do
 * NOT leave the site today. This exists so that stays true — the moment
 * anything redirects to a bare pathname instead, `//evil.com` becomes
 * protocol-relative and goes hostile.
 *
 * So: resolve against our own origin, compare the resolved origin, and hand
 * back an absolute URL. Never return a pathname for a caller to re-resolve.
 *
 * This matters most on the auth callback, where someone authenticates
 * legitimately on the real domain and is then handed to another one — the exact
 * shape of a phishing page borrowing your credibility.
 */
export function safeRedirect(next: string | null | undefined, origin: string, fallback = "/account"): string {
  const base = new URL(origin);

  const resolve = (value: string): URL | null => {
    try {
      return new URL(value, base);
    } catch {
      return null;
    }
  };

  const target = next ? resolve(next) : null;

  // Compare the ORIGIN of the fully resolved URL, not the string we were given.
  if (!target || target.origin !== base.origin) return resolve(fallback)!.toString();

  // A resolved path that still begins `//` is protocol-relative to anything
  // that parses it again later. Refuse rather than pass it along.
  if (target.pathname.startsWith("//")) return resolve(fallback)!.toString();

  return target.toString();
}
