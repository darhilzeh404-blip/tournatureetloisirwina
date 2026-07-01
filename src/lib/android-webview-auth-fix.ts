import { isAndroidWebViewRuntime } from "./platform";

declare global {
  interface Window {
    __winaAndroidAuthLocksPatched?: boolean;
  }
}

/**
 * Android WebView stability guard.
 *
 * Current auth-js versions can use the browser Web Locks API when
 * `navigator.locks` exists. On Android WebView the lock can remain orphaned
 * after process backgrounding/reload, which makes getSession/signIn wait until
 * the UI feels frozen. Native Android runs in a single WebView, so cross-tab
 * auth locking is unnecessary; hiding the API before the backend client is
 * created makes auth use the no-op in-process lock path instead.
 */
export function installAndroidWebViewAuthStability() {
  if (typeof window === "undefined" || window.__winaAndroidAuthLocksPatched) return;
  if (!isAndroidWebViewRuntime()) return;

  window.__winaAndroidAuthLocksPatched = true;

  const nav = globalThis.navigator as Navigator & { locks?: unknown };
  if (!nav?.locks) return;

  const hideLocks = (target: object) => {
    Object.defineProperty(target, "locks", {
      configurable: true,
      get: () => undefined,
    });
  };

  try {
    hideLocks(nav);
  } catch {
    try {
      const proto = Object.getPrototypeOf(nav);
      if (proto) hideLocks(proto);
    } catch {}
  }
}

installAndroidWebViewAuthStability();
