/**
 * PWA — enregistrement du service worker généré par vite-plugin-pwa.
 *
 * Le worker n'est JAMAIS enregistré en dev, en preview Lovable ou dans une
 * iframe : il ne doit pas servir de HTML/chunks obsolètes pendant l'édition.
 * `?sw=off` sert de kill switch pour désinstaller un worker existant.
 */

const SW_URL = "/sw.js";

function isPreviewHost(hostname: string) {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

function shouldRegister() {
  if (!import.meta.env.PROD) return false;
  if (window.self !== window.top) return false;
  if (isPreviewHost(window.location.hostname)) return false;
  if (new URLSearchParams(window.location.search).has("sw")) {
    return new URLSearchParams(window.location.search).get("sw") !== "off";
  }
  return true;
}

async function unregisterAppWorkers() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").includes(SW_URL))
        .map((r) => r.unregister()),
    );
  } catch (error) {
    console.warn("[pwa] unregister failed", error);
  }
}

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (!shouldRegister()) {
    void unregisterAppWorkers();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch((error) => {
      console.warn("[pwa] registration failed", error);
    });
  });
}
