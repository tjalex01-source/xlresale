"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Share a link — the native sheet on a phone, the clipboard everywhere else.
 *
 * `navigator.share` only exists on mobile and only in a secure context, so
 * which of the two happens is decided at the moment of the tap rather than at
 * render. That keeps the label the same on the server and the client (no
 * hydration mismatch) and means the component holds no state about the browser
 * it's running in — "Link copied" appearing afterwards is what tells you which
 * path you got.
 *
 * `navigator.share` rejects with an AbortError every time somebody opens the
 * sheet and changes their mind. That's a normal outcome, not a failure, so it
 * must never surface as an error.
 */
export function ShareButton({
  url,
  title,
  text,
  className = "",
  children = "Share",
}: {
  url: string;
  title: string;
  text?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const manualRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  // After commit, not in the click handler: the input doesn't exist yet when
  // the tap happens, and a requestAnimationFrame can still land before React
  // has put it in the DOM.
  useEffect(() => {
    if (state === "manual") manualRef.current?.select();
  }, [state]);

  async function go() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // Dismissed the sheet, or the browser refused. Fall through to the
        // clipboard rather than leaving the tap with nothing to show for it.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      // Clipboard permission denied — which really happens, and used to mean
      // the tap did nothing at all. Put the link on screen instead: this is the
      // one button in the app whose entire job is getting a link to somebody.
      setState("manual");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void go()}
        className={
          className ||
          "inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-hair bg-panel px-4 text-sm font-semibold hover:border-pink hover:text-pink"
        }
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v13M12 3 8 7M12 3l4 4" />
          <path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
        </svg>
        {state === "copied" ? "Link copied" : children}
      </button>

      {state === "manual" && (
        <label className="mt-2 block">
          <span className="text-sm text-muted">Copy this link:</span>
          <input
            ref={manualRef}
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 font-mono text-sm outline-none focus:border-pink"
          />
        </label>
      )}
    </div>
  );
}
