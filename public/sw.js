// Tour Wina — Service Worker
// Stratégie:
//   - Navigations (HTML): network-first, fallback offline.html
//   - Assets statiques (JS/CSS/images/fonts): stale-while-revalidate
//   - Skip pour POST, requêtes Supabase, et URLs cross-origin non whitelist
const VERSION = "v1.0.0";
const STATIC_CACHE = `tw-static-${VERSION}`;
const RUNTIME_CACHE = `tw-runtime-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function isAssetRequest(url) {
  return /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico|gif)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET, Supabase API, websockets, chrome-extension, OAuth callbacks
  if (req.method !== "GET") return;
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.hostname.includes("supabase.co")) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/~oauth")) return;

  // Navigations: network-first → cache → offline
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(req);
          return cached || (await caches.match(OFFLINE_URL));
        }
      })()
    );
    return;
  }

  // Same-origin assets: stale-while-revalidate
  if (url.origin === self.location.origin && isAssetRequest(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })()
    );
  }
});
