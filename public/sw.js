// Family Organizer service worker.
// Strategies:
//  - App navigations: network-first, fall back to cached shell (offline open).
//  - Static assets (Vite-hashed JS/CSS/img/fonts): cache-first.
//  - API GET: network-first, fall back to last-known-good cache (offline read).
//  - API writes (POST/DELETE) and SSE (/api/realtime): not intercepted.

const VERSION = "v2";
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
