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
  const isCapacitorAndroid = (window as any).Capacitor?.platform === 'android' || (window as any).Capacitor?.getPlatform?.() === 'android';
  const isWebView = isCapacitorAndroid || /; wv\)|\bwv\b|Version\/.*Chrome\//i.test(ua);

  if (!isAndroid || !isWebView) return;

  window.__winaAndroidAuthLocksPatched = true;

  const patch = (obj: any) => {
    try {
      if (obj && "locks" in obj) {
        Object.defineProperty(obj, "locks", {
          configurable: true,
          get: () => undefined,
        });
      }
    } catch (e) {
      // Keep native startup silent; auth has timeouts elsewhere if patching fails.
    }
  };

  patch(navigator);
  patch(Object.getPrototypeOf(navigator));

  // Some Android WebViews expose LockManager from a deeper prototype after the
  // bridge initializes. Re-apply once after the first tick, before auth starts.
  window.setTimeout(() => {
    patch(navigator);
    patch(Object.getPrototypeOf(navigator));
  }, 0);
}

// Execute immediately upon import
installAndroidWebViewAuthStability();
