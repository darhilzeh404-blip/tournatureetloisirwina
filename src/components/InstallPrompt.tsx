import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "tw-pwa-dismissed-at";
const VISITS_KEY = "tw-pwa-home-visits";
const SHOW_AFTER_MS = 15_000;
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed?
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS-specific
      window.navigator.standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    // Recently dismissed?
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;

    // Track home visits (only counts when on /)
    let visits = Number(localStorage.getItem(VISITS_KEY) || 0);
    if (window.location.pathname === "/") {
      visits += 1;
      localStorage.setItem(VISITS_KEY, String(visits));
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);

      // Show after delay OR immediately if already 2+ home visits
      if (visits >= 2) {
        setVisible(true);
      } else {
        const t = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
        return () => window.clearTimeout(t);
      }
    };

    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      localStorage.removeItem(VISITS_KEY);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "dismissed") {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    }
    setDeferred(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  if (installed || !visible || !deferred) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Installer Tour Wina</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Accédez à vos réservations en un clic depuis l’écran d’accueil.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleInstall}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Installer
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
              >
                Plus tard
              </button>
            </div>
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
