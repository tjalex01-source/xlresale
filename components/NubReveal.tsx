"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Plays a Nub motion once, when he scrolls into view.
 *
 * DESIGN.md is explicit that scroll beats fire once via IntersectionObserver
 * rather than on every scroll — a mascot that re-animates each time you pass him
 * stops being charming by the second pass. The observer disconnects after the
 * first hit, so there's nothing left running.
 */
export function NubReveal({
  motion = "nub-hop",
  className = "",
  children,
}: {
  motion?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || played) return;

    // Nothing to reveal if the visitor asked for less motion — he just sits there.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlayed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [played]);

  // Display is left entirely to the caller. Hardcoding `inline-block` here fought
  // any `hidden`/`sm:` class passed in — Tailwind resolves display utilities by
  // stylesheet order, not by the order they appear in the attribute, so the
  // built-in silently won and the element showed when it should have been hidden.
  return (
    <span ref={ref} className={`${played ? motion : ""} ${className}`}>
      {children}
    </span>
  );
}
