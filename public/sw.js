// Family Organizer service worker.
// Strategies:
//  - App navigations: network-first, fall back to cached shell (offline open).
//  - Static assets (Vite-hashed JS/CSS/img/fonts): cache-first.
//  - API GET: network-first, fall back to last-known-good cache (offline read).
//  - API writes (POST/DELETE) and SSE (/api/realtime): not intercepted.

const VERSION = "v3";
const STATIC_CACHE = `family-static-${VERSION}`;
const API_CACHE = `family-api-${VERSION}`;
const APP_SHELL = ["/", "/manifest.webmanifest", "/pwa-icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== STATIC_CACHE && key !== API_CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Allow the page to trigger an immediate update.
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    /\.(?:js|css|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return; // writes go straight to network
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // ignore cross-origin

  // Never intercept the realtime Server-Sent Events stream.
  if (url.pathname === "/api/realtime") return;

  // API GET: network-first, fall back to cached last-known-good.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(API_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App navigations: network-first, fall back to cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match("/")))
    );
    return;
  }

  // Static assets: cache-first with background refresh (stale-while-revalidate).
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request)
          .then(response => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

// --- WEB PUSH: show a system notification + update the app-icon badge ---
// Fired when the server sends a push (even while the PWA is closed).
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }

  const title = data.title || "Family Organizer";
  const options = {
    body: data.body || "",
    icon: "/pwa-icon.svg",
    badge: "/pwa-icon.svg",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { tab: data.tab || "", url: data.url || "/" }
  };

  const jobs = [self.registration.showNotification(title, options)];

  // App-icon badge (iOS 16.4+ / supporting platforms). Best-effort.
  if (typeof data.badge === "number" && self.navigator && "setAppBadge" in self.navigator) {
    jobs.push(
      (data.badge > 0
        ? self.navigator.setAppBadge(data.badge)
        : self.navigator.clearAppBadge()
      ).catch(() => {})
    );
  }

  event.waitUntil(Promise.all(jobs));
});

// Tapping a notification focuses the app (or opens it), deep-linking to the tab.
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const tab = (event.notification.data && event.notification.data.tab) || "";
  const targetUrl = tab ? `/?notif_tab=${encodeURIComponent(tab)}` : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if (tab) client.postMessage({ type: "NOTIF_NAV", tab });
          return undefined;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
