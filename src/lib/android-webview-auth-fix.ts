import { isAndroidWebViewRuntime } from "./platform";

declare global {
  interface Window {
    __winaAndroidAuthLocksPatched?: boolean;
  }
}

/**
 * Android WebView stability guard for Supabase Auth.
 * 
 * Prevents deadlocks in the Web Locks API which is often broken in Android WebViews,
 * causing getSession/signIn to hang indefinitely and freeze the UI.
 */
export function installAndroidWebViewAuthStability() {
  if (typeof window === "undefined" || window.__winaAndroidAuthLocksPatched) return;
  
  // Aggressive detection: check UA directly if the bridge isn't ready yet
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isWebView = /wv|Version\/.*Chrome\//i.test(ua) || (window as any).Capacitor?.platform === 'android';

  if (!isAndroid || !isWebView) return;

  window.__winaAndroidAuthLocksPatched = true;
  console.log("[AuthFix] Patching navigator.locks to prevent Android WebView deadlocks");

  const patch = (obj: any) => {
    try {
      if (obj && "locks" in obj) {
        Object.defineProperty(obj, "locks", {
          configurable: true,
          get: () => undefined,
        });
      }
    } catch (e) {
      console.warn("[AuthFix] Failed to patch locks on", obj, e);
    }
  };

  patch(navigator);
  patch(Object.getPrototypeOf(navigator));
}

// Execute immediately upon import
installAndroidWebViewAuthStability();
