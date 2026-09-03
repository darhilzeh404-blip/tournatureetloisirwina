import { useCallback, useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

/** Y a-t-il réellement une page précédente dans l'historique de l'app ? */
export function useCanGoBack(): boolean {
  const [can, setCan] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;
    // history.length > 1 : l'utilisateur vient d'un autre écran (même onglet).
    setCan(window.history.length > 1);
  }, [pathname]);

  return can;
}

export function useGoBack() {
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();

  return useCallback(() => {
    if (canGoBack && typeof window !== "undefined") {
      window.history.back();
      return;
    }
    navigate({ to: "/" });
  }, [canGoBack, navigate]);
}

/**
 * Bouton « Retour » réutilisable — à placer en haut à gauche d'un écran
 * secondaire ou d'une page de détail. Ne ramène à l'accueil que s'il n'existe
 * réellement aucune page précédente.
 */
export function BackButton({
  label = "Retour",
  className = "",
  showLabel = true,
}: {
  label?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const goBack = useGoBack();

  return (
    <button
      type="button"
      data-app-back=""
      onClick={goBack}
      aria-label={label}
      className={`inline-flex h-11 items-center gap-1.5 rounded-full border border-border/70 bg-card/80 pl-2.5 pr-4 text-sm font-semibold shadow-sm backdrop-blur transition-colors active:scale-[0.98] hover:border-primary/50 ${className}`}
    >
      <ChevronLeft className="h-5 w-5" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}

/** Routes sur lesquelles aucun bouton retour flottant ne doit apparaître. */
const EXCLUDED_PREFIXES = [
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
  "/espace-client",
  "/admin",
  "/chauffeur",
  "/gerant",
];

/**
 * Bouton retour global : affiché automatiquement sur tout écran secondaire
 * qui n'en propose pas déjà un dans son propre contenu.
 */
export function GlobalBackButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const canGoBack = useCanGoBack();
  const [hasLocalBack, setHasLocalBack] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      setHasLocalBack(document.querySelectorAll("[data-app-back]").length > 0);
    };
    check();
    const t1 = setTimeout(check, 350);
    const t2 = setTimeout(check, 1200);
    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname]);

  if (pathname === "/") return null;
  if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (!canGoBack || hasLocalBack) return null;

  return (
    <div className="pointer-events-none fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40">
      <div className="pointer-events-auto">
        <BackButton />
      </div>
    </div>
  );
}
