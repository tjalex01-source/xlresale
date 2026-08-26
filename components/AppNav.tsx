"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The one piece of navigation, everywhere.
 *
 * Before this, thirteen pages each hand-rolled their own header with a
 * different set of links — the map was reachable only from a button on /shop,
 * the planner from a different button on the same page, and nothing was two
 * taps from anywhere. That, rather than any single button's placement, is why
 * the app was hard to move around.
 *
 * Bottom bar on a phone because that's where thumbs are, and this gets used
 * one-handed in a car park. Top bar from `sm` up, where a fixed bottom strip
 * just eats the window.
 *
 * Icons are drawn, not emoji — DESIGN.md's "defaults to never ship" names
 * emoji-as-UI-icons explicitly.
 */

const TABS = [
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/shop", label: "Saved", icon: HeartIcon },
  { href: "/shop/alerts", label: "Alerts", icon: BellIcon },
  { href: "/host", label: "Sell", icon: TagIcon },
  { href: "/account", label: "You", icon: PersonIcon },
] as const;

/** Pages that are their own front door and shouldn't carry app chrome. */
const BARE = ["/", "/login", "/signup", "/forgot-password", "/privacy", "/welcome"];

export function AppNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();

  if (!signedIn) return null;
  if (BARE.includes(pathname)) return null;

  // /shop must not light up while you're on /shop/alerts, so the longest
  // matching href wins rather than the first prefix match.
  const active = TABS.map((t) => t.href)
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-panel/95 backdrop-blur sm:static sm:border-b sm:border-t-0"
      // Keeps the bar clear of the iPhone home indicator.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex w-full max-w-3xl items-stretch justify-around sm:justify-start sm:gap-1 sm:px-6">
        {TABS.map(({ href, label, icon: Icon }) => {
          const on = active === href;
          return (
            <li key={href} className="flex-1 sm:flex-none">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-2 text-[11px] font-bold sm:min-h-12 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm ${
                  on ? "text-pink" : "text-muted hover:text-ink"
                }`}
              >
                <Icon filled={on} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* Icons: 24px, stroke 1.8, currentColor. The active tab fills rather than
   swapping colour alone, so it reads at a glance without relying on hue. */

function MapIcon({ filled }: { filled: boolean }) {
  return (
    <Icon>
      <path
        d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3Z"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.18 : 0}
      />
      <path d="M9 3v15M15 6v15" />
    </Icon>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Icon>
      <path
        d="M12 20.3s-7.5-4.6-7.5-9.6a4.3 4.3 0 0 1 7.5-2.9 4.3 4.3 0 0 1 7.5 2.9c0 5-7.5 9.6-7.5 9.6Z"
        fill={filled ? "currentColor" : "none"}
      />
    </Icon>
  );
}

function BellIcon({ filled }: { filled: boolean }) {
  return (
    <Icon>
      <path
        d="M18 16V11a6 6 0 1 0-12 0v5l-1.5 2.5h15L18 16Z"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.18 : 0}
      />
      <path d="M10 21h4" />
    </Icon>
  );
}

/** The product's own price-tag silhouette, shrunk to an icon. */
function TagIcon({ filled }: { filled: boolean }) {
  return (
    <Icon>
      <path
        d="M4 5h11a4 4 0 0 1 4 4v9a1 1 0 0 1-1.6.8L14 16H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.18 : 0}
      />
      <circle cx="7.5" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
    </Icon>
  );
}

function PersonIcon({ filled }: { filled: boolean }) {
  return (
    <Icon>
      <circle cx="12" cy="8" r="3.5" fill={filled ? "currentColor" : "none"} fillOpacity={filled ? 0.18 : 0} />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Icon>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-6 sm:size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}
