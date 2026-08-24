import { useEffect, useRef } from "react";

/**
 * setInterval qui se met en pause quand l'onglet/la WebView passe en
 * arrière-plan (document.hidden) et se relance au retour au premier plan.
 *
 * Sur Android, les sondages réseau qui continuent en arrière-plan saturent le
 * CPU/la batterie et provoquent des à-coups (voire un gel) au retour dans
 * l'application. Les timers sont toujours nettoyés au démontage.
 */
export function useVisibleInterval(
  callback: () => void,
  delayMs: number,
  enabled = true,
) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || delayMs <= 0) return;

    let id: number | null = null;

    const stop = () => {
      if (id !== null) {
        window.clearInterval(id);
        id = null;
      }
    };

    const start = () => {
      if (id !== null) return;
      id = window.setInterval(() => savedCallback.current(), delayMs);
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        // Rafraîchit immédiatement au retour, puis reprend le cycle.
        savedCallback.current();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [delayMs, enabled]);
}
