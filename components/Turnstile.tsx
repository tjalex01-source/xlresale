"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      "response-field"?: boolean;
      theme?: "light" | "dark" | "auto";
    },
  ) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Loaded once per page, however many widgets ask for it. */
let scriptPromise: Promise<void> | null = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("turnstile failed to load"));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * Cloudflare Turnstile, feeding a `captcha_token` field into the enclosing form.
 *
 * Renders nothing when no site key is configured, so auth keeps working in any
 * environment that hasn't got one — and Supabase ignores the empty token until
 * CAPTCHA is switched on at its end.
 *
 * `resetSignal` matters more than it looks: a Turnstile token is single-use. If
 * a submit is rejected for any reason — wrong password, handle taken — the token
 * is already spent, and a second attempt would fail CAPTCHA rather than showing
 * the real error. Changing this prop issues a fresh one.
 */
export function Turnstile({ resetSignal }: { resetSignal?: unknown }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const mountRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !mountRef.current || !window.turnstile) return;
        if (widgetId.current) return;
        widgetId.current = window.turnstile.render(mountRef.current, {
          sitekey: siteKey,
          // We keep the token in our own field so its name is predictable.
          "response-field": false,
          callback: (t) => setToken(t),
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
        });
      })
      .catch(() => {
        /* Offline or blocked — the field stays empty and the server decides. */
      });

    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      setToken("");
    }
  }, [resetSignal]);

  if (!siteKey) return null;

  return (
    <div>
      <div ref={mountRef} />
      <input type="hidden" name="captcha_token" value={token} />
    </div>
  );
}
