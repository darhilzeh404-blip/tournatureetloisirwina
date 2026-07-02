import { useEffect, useRef } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { isAndroidWebViewRuntime } from "@/lib/platform";

const ROUTE_STUCK_RELOAD_KEY = "wina_route_stuck_reloaded";
const ROUTE_STUCK_DELAY_MS = typeof window !== "undefined" && isAndroidWebViewRuntime() ? 7_000 : 10_000;
const ROUTE_STUCK_RESET_MS = 12_000;

function getReloadCount(href: string) {
  try {
    const raw = window.sessionStorage.getItem(ROUTE_STUCK_RELOAD_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data?.href === href ? Number(data.count || 0) : 0;
  } catch {
    return 0;
  }
}

function setReloadCount(href: string, count: number) {
  try {
    window.sessionStorage.setItem(
      ROUTE_STUCK_RELOAD_KEY,
      JSON.stringify({ href, count, at: Date.now() }),
    );
  } catch {}
}

function clearReloadCount() {
  try {
    window.sessionStorage.removeItem(ROUTE_STUCK_RELOAD_KEY);
  } catch {}
}

export function StuckRouteRecovery() {
  const router = useRouter();
  const { href, isLoading, isTransitioning, status } = useRouterState({
    select: (state) => ({
      href: state.location.href,
      isLoading: state.isLoading,
      isTransitioning: state.isTransitioning,
      status: state.status,
    }),
  });
  const recoveryInProgress = useRef(false);

  useEffect(() => {
    recoveryInProgress.current = false;
  }, [href]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isLoading && !isTransitioning && status === "idle") {
      const resetTimer = window.setTimeout(clearReloadCount, ROUTE_STUCK_RESET_MS);
      return () => window.clearTimeout(resetTimer);
    }
  }, [href, isLoading, isTransitioning, status]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const routeIsBusy = isLoading || isTransitioning || status === "pending";
    if (!routeIsBusy) return;

    const timer = window.setTimeout(() => {
      if (recoveryInProgress.current) return;
      recoveryInProgress.current = true;

      const count = getReloadCount(href);
      if (count >= 1) {
        toast.error("Le chargement prend trop de temps. Veuillez fermer puis rouvrir l'application.");
        return;
      }

      setReloadCount(href, count + 1);
      toast.info("Chargement bloqué détecté, rechargement de la page…");

      window.setTimeout(() => {
        router.invalidate({ forcePending: true }).catch(() => {
          window.location.replace(window.location.href);
        });
      }, 250);
    }, ROUTE_STUCK_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [href, isLoading, isTransitioning, status, router]);

  return null;
}