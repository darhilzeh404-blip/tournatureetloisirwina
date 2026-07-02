import { useEffect, useRef } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { logRecovery } from "@/lib/recovery-log";

const ROUTE_STUCK_RELOAD_KEY = "wina_route_stuck_reloaded";
const ROUTE_STUCK_DELAY_MS = 10_000;
const ROUTE_STUCK_RESET_MS = 12_000;
const RECOVERY_SUCCESS_KEY = "wina_route_recovery_pending";

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

function markRecoveryPending(href: string) {
  try {
    window.sessionStorage.setItem(
      RECOVERY_SUCCESS_KEY,
      JSON.stringify({ href, at: Date.now() }),
    );
  } catch {}
}

function consumeRecoveryPending(): { href: string; at: number } | null {
  try {
    const raw = window.sessionStorage.getItem(RECOVERY_SUCCESS_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(RECOVERY_SUCCESS_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
  const notifiedSuccessRef = useRef(false);

  // On mount, if we came back from a recovery reload, notify the user.
  useEffect(() => {
    if (typeof window === "undefined" || notifiedSuccessRef.current) return;
    const pending = consumeRecoveryPending();
    if (pending) {
      notifiedSuccessRef.current = true;
      logRecovery("success", "recovery.reload.success", {
        recoveredHref: pending.href,
        elapsedMs: Date.now() - pending.at,
      });
      toast.success("Page rechargée avec succès après un blocage.");
    }
  }, []);

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

    const startedAt = Date.now();
    const timer = window.setTimeout(() => {
      if (recoveryInProgress.current) return;
      recoveryInProgress.current = true;

      const count = getReloadCount(href);
      const elapsedMs = Date.now() - startedAt;

      logRecovery("warn", "route.stuck.detected", {
        href,
        status,
        isLoading,
        isTransitioning,
        elapsedMs,
        attempt: count + 1,
      });

      toast.warning("Chargement bloqué détecté", {
        description: "La page ne répond pas, tentative de récupération en cours…",
      });

      if (count >= 1) {
        logRecovery("error", "recovery.failed.max_attempts", { href, attempts: count });
        toast.error("Échec du rechargement automatique", {
          description: "Veuillez fermer puis rouvrir l'application.",
        });
        return;
      }

      setReloadCount(href, count + 1);
      markRecoveryPending(href);
      logRecovery("info", "recovery.attempt.start", { href, method: "router.invalidate" });

      window.setTimeout(() => {
        router
          .invalidate({ forcePending: true })
          .then(() => {
            logRecovery("success", "recovery.invalidate.success", { href });
            // If invalidate resolves quickly, consume the pending marker so the
            // toast doesn't fire again on the next navigation.
            consumeRecoveryPending();
            toast.success("Page récupérée sans rechargement complet.");
          })
          .catch((err) => {
            logRecovery("error", "recovery.invalidate.failed", {
              href,
              message: (err as Error)?.message,
            });
            toast.error("Rechargement complet de la page…");
            window.setTimeout(() => {
              window.location.replace(window.location.href);
            }, 400);
          });
      }, 250);
    }, ROUTE_STUCK_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [href, isLoading, isTransitioning, status, router]);

  return null;
}
