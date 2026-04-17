import { useEffect, useState } from "react";
import { Share, Plus, X } from "lucide-react";

const DISMISSED_KEY = "tw-ios-install-dismissed-at";
const VISITS_KEY = "tw-ios-install-visits";
const SHOW_AFTER_MS = 12_000;
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function IosInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = window.navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isSafari = /^((?!chrome|android|crios|fxios|edgios|opios).)*safari/i.test(ua);

    if (!isIOS || !isSafari) return;

    // Already installed (standalone)?
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS-specific
      window.navigator.standalone === true;
    if (standalone) return;

    // Recently dismissed?
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;

    let visits = Number(localStorage.getItem(VISITS_KEY) || 0);
    if (window.location.pathname === "/") {
      visits += 1;
      localStorage.setItem(VISITS_KEY, String(visits));
    }

    if (visits >= 2) {
      setVisible(true);
      return;
    }

    const t = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Share className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Installer Tour Wina sur iPhone</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Appuyez sur{" "}
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-medium text-foreground">
                <Share className="h-3 w-3" /> Partager
              </span>{" "}
              puis{" "}
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-medium text-foreground">
                <Plus className="h-3 w-3" /> Sur l'écran d'accueil
              </span>
              .
            </p>
            <button
              onClick={handleDismiss}
              className="mt-3 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
            >
              J'ai compris
            </button>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Fermer"
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
