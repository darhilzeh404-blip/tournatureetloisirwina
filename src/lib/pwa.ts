// Service worker cleanup only.
// The old app-shell service worker could keep stale chunks/assets and cause
// repeated 404s after deploys. Keep home-screen manifest support, but do not
// register an offline cache worker unless offline mode is explicitly rebuilt.
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs
        .filter((registration) => registration.active?.scriptURL.endsWith("/sw.js"))
        .forEach((registration) => registration.unregister());
    });

    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys
          .filter((key) => key.startsWith("tw-static-") || key.startsWith("tw-runtime-") || key.startsWith("tw-fonts-"))
          .forEach((key) => caches.delete(key));
      });
    }
  });
}
