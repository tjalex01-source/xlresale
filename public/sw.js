/**
 * XLResale service worker.
 *
 * Deliberately minimal. Its whole job is to receive push notifications and open
 * the right page when one is tapped — there is no offline caching, because a
 * cached map of sales is a map of sales that may have closed, and being wrong
 * about that is the exact pain this product exists to solve.
 */

// Take over immediately rather than waiting for every tab to close, so a
// notification permission granted now works now.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "XLResale";
  const options = {
    body: data.body || "Something near you just went up.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // Tag collapses repeats about the same sale into one notification rather
    // than stacking duplicates on the lock screen.
    tag: data.tag || "xlresale",
    data: { url: data.url || "/shop" },
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/shop";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Reuse an already-open tab where possible — launching a second copy of
      // the app from a notification is disorienting on a phone.
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
