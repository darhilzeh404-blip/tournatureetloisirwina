// Tour Wina — service worker kill switch.
// Removes the previous offline app-shell cache worker that could serve stale
// HTML/chunks and make the published app look like files are missing.
function isTourWinaCache(name) {
  return name.startsWith("tw-static-") || name.startsWith("tw-runtime-") || name.startsWith("tw-fonts-");
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.allSettled(names.filter(isTourWinaCache).map((name) => caches.delete(name)));
        await self.clients.claim();

        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(clients.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  );
});
