"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
/** How long to wait for a token before giving up and letting the server answer. */
const WAIT_LIMIT_MS = 12_000;

export function Turnstile({ resetSignal }: { resetSignal?: unknown }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const mountRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [waiting, setWaiting] = useState(false);

  // Mirrors of the state above, for the submit listener. That listener is
  // attached once and would otherwise close over the token from its first
  // render and never see a later one.
  const tokenRef = useRef("");
  const statusRef = useRef<"loading" | "error">("loading");
  const pendingSubmitRef = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const timerRef = useRef<number | null>(null);

  /** Release a submit that was held back waiting for the bot check. */
  const releaseHeldSubmit = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingSubmitRef.current = false;
    setWaiting(false);
    formRef.current?.requestSubmit();
  }, []);

  const applyToken = useCallback(
    (value: string) => {
      tokenRef.current = value;
      setToken(value);
      if (value && pendingSubmitRef.current) releaseHeldSubmit();
    },
    [releaseHeldSubmit],
  );

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
          callback: (t) => applyToken(t),
          "expired-callback": () => applyToken(""),
          "error-callback": () => {
            statusRef.current = "error";
            applyToken("");
            // A broken check must not become a locked door: let anything that
            // was held go through, and let the server give the real reason.
            if (pendingSubmitRef.current) releaseHeldSubmit();
          },
        });
      })
      .catch(() => {
        // Offline or blocked — same reasoning as an error callback.
        statusRef.current = "error";
        if (pendingSubmitRef.current) releaseHeldSubmit();
      });

    return () => {
      cancelled = true;
    };
  }, [siteKey, applyToken, releaseHeldSubmit]);

  /**
   * Hold a submit that arrives before the token does, then send it on.
   *
   * Turnstile usually takes a second or two to hand over a token, and anyone
   * who types their password quickly beats it. Previously that submitted an
   * empty `captcha_token`, Supabase rejected it before ever looking at the
   * password, and the person was told their verification expired — which reads
   * as "your password is wrong" and is nobody's fault but ours.
   *
   * Capture phase, because React's own submit handling runs from the root on
   * the bubble phase; stopping propagation here is what keeps the server action
   * from firing early.
   */
  useEffect(() => {
    if (!siteKey) return;

    const form = mountRef.current?.closest("form") ?? null;
    formRef.current = form;
    if (!form) return;

    const onSubmit = (event: Event) => {
      if (tokenRef.current) return; // ready — nothing to do
      if (statusRef.current === "error") return; // let the server explain

      event.preventDefault();
      event.stopPropagation();
      pendingSubmitRef.current = true;
      setWaiting(true);

      timerRef.current = window.setTimeout(() => {
        // Never strand someone behind a check that never finishes.
        if (pendingSubmitRef.current) releaseHeldSubmit();
      }, WAIT_LIMIT_MS);
    };

    form.addEventListener("submit", onSubmit, { capture: true });
    return () => {
      form.removeEventListener("submit", onSubmit, { capture: true });
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [siteKey, releaseHeldSubmit]);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      tokenRef.current = "";
      setToken("");
    }
  }, [resetSignal]);

  if (!siteKey) return null;

  return (
    <div>
      {/* Shaves a round trip off the widget's first load, which is the whole
          problem this component had. */}
      <link rel="preconnect" href="https://challenges.cloudflare.com" />
      <div ref={mountRef} />
      <input type="hidden" name="captcha_token" value={token} />
      {waiting && (
        <p className="mt-2 text-sm text-muted" role="status" aria-live="polite">
          One second — finishing the bot check, then signing you in.
        </p>
      )}
    </div>
  );
}
