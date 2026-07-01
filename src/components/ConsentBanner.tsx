import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Shield, X } from "lucide-react";

const STORAGE_KEY = "wina.consent.v1";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (!v) setVisible(true);
    } catch {
      /* noop */
    }
  }, []);

  const accept = (value: "all" | "essential") => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice: value, at: new Date().toISOString() })
      );
    } catch {
      /* noop */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-[9999] px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-4 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 id="consent-title" className="text-sm font-semibold text-foreground">
              Confidentialité & consentement
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Nous utilisons uniquement les données strictement nécessaires au fonctionnement de l'application
              (compte, réservations, sécurité). La <strong>localisation</strong> n'est demandée qu'au moment où une
              fonctionnalité l'exige (VTC, suivi de trajet). En savoir plus dans notre{" "}
              <Link to="/confidentialite" className="text-primary underline">
                politique de confidentialité
              </Link>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => accept("all")}
                className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                J'accepte
              </button>
              <button
                onClick={() => accept("essential")}
                className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Essentiel uniquement
              </button>
              <Link
                to="/confidentialite"
                className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Détails
              </Link>
            </div>
          </div>
          <button
            aria-label="Fermer"
            onClick={() => accept("essential")}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
