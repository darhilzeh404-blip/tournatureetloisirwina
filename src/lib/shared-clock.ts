import { useEffect, useState } from "react";

/**
 * Horloge partagée : un seul timer par intervalle pour toute l'application.
 *
 * Avant, chaque compteur (courses en attente, deadline de covoiturage…) créait
 * son propre `setInterval(1000)` : une liste de 20 lignes = 20 timers + 20
 * re-rendus par seconde, ce qui saccadait/gelait les WebView Android.
 * Ici, un unique timer par intervalle notifie tous les abonnés, et il est mis
 * en pause quand l'application passe en arrière-plan.
 */
type Listener = (now: number) => void;

const tickers = new Map<
  number,
  { listeners: Set<Listener>; id: number | null; visibilityBound: boolean }
>();

function getTicker(intervalMs: number) {
  let t = tickers.get(intervalMs);
  if (!t) {
    t = { listeners: new Set(), id: null, visibilityBound: false };
    tickers.set(intervalMs, t);
  }
  return t;
}

function start(intervalMs: number) {
  const t = getTicker(intervalMs);
  if (t.id !== null || typeof window === "undefined") return;
  if (document.hidden) return;
  t.id = window.setInterval(() => {
    const now = Date.now();
    t!.listeners.forEach((fn) => fn(now));
  }, intervalMs);
}

function stop(intervalMs: number) {
  const t = tickers.get(intervalMs);
  if (!t || t.id === null) return;
  window.clearInterval(t.id);
  t.id = null;
}

function bindVisibility(intervalMs: number) {
  const t = getTicker(intervalMs);
  if (t.visibilityBound || typeof document === "undefined") return;
  t.visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop(intervalMs);
    } else if (t.listeners.size > 0) {
      const now = Date.now();
      t.listeners.forEach((fn) => fn(now));
      start(intervalMs);
    }
  });
}

export function subscribeToClock(intervalMs: number, listener: Listener) {
  const t = getTicker(intervalMs);
  t.listeners.add(listener);
  bindVisibility(intervalMs);
  start(intervalMs);
  return () => {
    t.listeners.delete(listener);
    if (t.listeners.size === 0) stop(intervalMs);
  };
}

/**
 * Renvoie l'heure courante, rafraîchie toutes les `intervalMs` ms via
 * l'horloge partagée. `enabled = false` désabonne complètement le composant.
 */
export function useSharedClock(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    return subscribeToClock(intervalMs, setNow);
  }, [intervalMs, enabled]);

  return now;
}
