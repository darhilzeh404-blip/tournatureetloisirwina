// Service worker cleanup only.
// The old app-shell service worker could keep stale chunks/assets and make the
// preview/published app look unchanged after edits. Keep home-screen manifest
// support, but aggressively remove any old offline worker/cache and reload once.
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const cleanupKey = "tour-wina-pwa-cleanup-v3";

    const cleanup = async () => {
      let changed = false;

      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        const results = await Promise.allSettled(regs.map((registration) => registration.unregister()));
        changed = results.some((result) => result.status === "fulfilled" && result.value);
      } catch (error) {
        console.warn("[pwa-cleanup] service worker cleanup failed", error);
      }

      if ("caches" in window) {
        try {
          const keys = await caches.keys();
          const results = await Promise.allSettled(keys.map((key) => caches.delete(key)));
          changed = changed || results.some((result) => result.status === "fulfilled" && result.value);
        } catch (error) {
          console.warn("[pwa-cleanup] cache cleanup failed", error);
        }
      }

      if (changed && sessionStorage.getItem(cleanupKey) !== "done") {
        sessionStorage.setItem(cleanupKey, "done");
        window.location.reload();
      }
    };

    void cleanup();
  });
}
