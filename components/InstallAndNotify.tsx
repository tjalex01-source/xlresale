"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * "Add to home screen" and "turn on alerts", in one card.
 *
 * They belong together because on iOS they are the same action: Safari only
 * allows web push for a site that has actually been installed to the home
 * screen, so asking an iPhone for notification permission from a browser tab
 * fails with no explanation. The card therefore leads with installing, and only
 * offers notifications once that's possible.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** URL-safe base64 (what VAPID uses) to the Uint8Array the API wants. */
function urlBase64ToUint8Array(base64: string): BufferSource {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  // Built through an explicit ArrayBuffer: a plain Uint8Array is typed over
  // ArrayBufferLike, which includes SharedArrayBuffer and so is not accepted
  // as a BufferSource by applicationServerKey.
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

/** Nothing to subscribe to — these values don't change during a page's life. */
const NEVER_CHANGES = () => () => {};

/**
 * Read a browser-only value without setting state in an effect.
 *
 * Server render gets `serverValue`, then hydration swaps in the real answer.
 * Doing this with useEffect + setState works but costs an extra render pass on
 * every mount, and React's rules-of-hooks lint rightly flags it.
 */
function useBrowserValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(NEVER_CHANGES, read, () => serverValue);
}

const readStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // Safari's own flag; it predates display-mode and is still the only reliable
  // signal on iOS.
  (window.navigator as { standalone?: boolean }).standalone === true;

const readIsIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const readPermission = (): NotificationPermission | "unsupported" =>
  "Notification" in window && "serviceWorker" in navigator && "PushManager" in window
    ? Notification.permission
    : "unsupported";

export function InstallAndNotify() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const standalone = useBrowserValue(readStandalone, false);
  const isIos = useBrowserValue(readIsIos, false);
  const detectedPermission = useBrowserValue<NotificationPermission | "unsupported">(
    readPermission,
    "default",
  );

  // `appinstalled` fires in the current tab, but display-mode doesn't flip
  // until the app is reopened from the home screen — so the two are OR'd.
  const installed = standalone || justInstalled;
  const [grantedPermission, setGrantedPermission] = useState<NotificationPermission | null>(null);
  const permission = grantedPermission ?? detectedPermission;

  useEffect(() => {
    // Async, so this is a callback rather than a synchronous setState.
    if (detectedPermission === "unsupported") return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => {});
  }, [detectedPermission]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Chrome fires this instead of showing its own banner; holding it lets us
      // put the install button somewhere it makes sense.
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setJustInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const enableNotifications = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await Notification.requestPermission();
      setGrantedPermission(result);
      if (result !== "granted") {
        setMessage("Notifications are blocked. You can turn them back on in your browser settings.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setMessage("Push isn't configured on the server yet.");
        return;
      }

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          // Required to be true by every browser — a silent push isn't allowed.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        setMessage((await response.json())?.error ?? "Couldn't turn on notifications.");
        return;
      }

      setSubscribed(true);
      setMessage("Alerts are on for this device.");
    } catch {
      setMessage("Couldn't turn on notifications on this device.");
    } finally {
      setBusy(false);
    }
  }, []);

  const turnOff = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: "DELETE",
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setMessage("Alerts are off for this device.");
    } finally {
      setBusy(false);
    }
  }, []);

  // iOS can't do push until the app is on the home screen, so that instruction
  // has to come first and can't be skipped.
  const needsInstallFirst = isIos && !installed;

  return (
    <div className="rounded-[16px] border border-hair bg-canvas p-4">
      <p className="font-display text-lg font-bold">Put XLResale on your phone</p>
      <p className="mt-1 text-sm text-ink-soft">
        It opens like an app, straight to your saved sales — and it&rsquo;s how you get alerts on
        your phone.
      </p>

      {installed ? (
        <p className="mt-3 rounded-[10px] bg-green-50 px-3.5 py-2.5 text-sm text-green-ink">
          Installed. You&rsquo;re good.
        </p>
      ) : installEvent ? (
        <button
          type="button"
          onClick={async () => {
            await installEvent.prompt();
            const { outcome } = await installEvent.userChoice;
            if (outcome === "accepted") setJustInstalled(true);
            setInstallEvent(null);
          }}
          className="mt-3 inline-flex min-h-11 items-center rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas hover:opacity-90"
        >
          Add to home screen
        </button>
      ) : isIos ? (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
          <li>
            Tap the <strong>Share</strong> button at the bottom of Safari
          </li>
          <li>
            Scroll down and tap <strong>Add to Home Screen</strong>
          </li>
          <li>
            Tap <strong>Add</strong>
          </li>
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">
          In your browser menu, look for <strong>Install app</strong> or{" "}
          <strong>Add to Home screen</strong>.
        </p>
      )}

      <hr className="my-4 border-hair" />

      <p className="font-display text-lg font-bold">Alerts on this device</p>

      {permission === "unsupported" ? (
        <p className="mt-1 text-sm text-muted">
          This browser can&rsquo;t do notifications. You&rsquo;ll still get email.
        </p>
      ) : needsInstallFirst ? (
        <p className="mt-1 text-sm text-muted">
          On iPhone, add XLResale to your home screen first — Apple only allows notifications from
          there. Then open it from the home screen and come back here.
        </p>
      ) : permission === "denied" ? (
        <p className="mt-1 text-sm text-muted">
          Notifications are blocked for this site. Turn them back on in your browser settings, then
          reload.
        </p>
      ) : subscribed ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            On. We&rsquo;ll buzz you when something on your list turns up nearby.
          </p>
          <button
            type="button"
            onClick={turnOff}
            disabled={busy}
            className="mt-3 inline-flex min-h-11 items-center rounded-[10px] border border-hair px-4 text-sm font-semibold hover:border-pink hover:text-pink disabled:opacity-50"
          >
            {busy ? "Working…" : "Turn off on this device"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={enableNotifications}
          disabled={busy}
          className="mt-3 inline-flex min-h-11 items-center rounded-[10px] bg-pink px-4 text-sm font-bold text-white hover:-translate-y-0.5 disabled:opacity-50"
        >
          {busy ? "Working…" : "Turn on alerts"}
        </button>
      )}

      {message && (
        <p className="mt-3 text-sm text-ink-soft" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
