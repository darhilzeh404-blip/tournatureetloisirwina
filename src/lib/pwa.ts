// Service worker registration with strict guards for Lovable preview/iframe.
// Only registers in production, on the published domain, outside iframes.
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovable.app") && host.startsWith("id-preview--");
  const isLocalhost = host === "localhost" || host === "127.0.0.1";

  // In preview/iframe/dev, proactively unregister any stale SW + clear caches
  // to prevent serving stale builds from a previous session.
  if (isInIframe || isPreviewHost || isLocalhost || !import.meta.env.PROD) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
    return;
  }

  // Production, top-level window: register
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[PWA] SW registration failed:", err);
    });
  });
}
