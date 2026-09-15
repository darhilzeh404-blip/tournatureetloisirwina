import { useEffect, useRef } from "react";
import { appToast } from "@/lib/app-toast";

/**
 * Validation automatique des étapes d'un formulaire multi-étapes.
 *
 * Dès qu'une étape « auto » est complète et valide, on affiche un court
 * feedback puis on passe à l'étape suivante — sans clic sur « Continuer ».
 *
 * Garde-fous :
 *  - une étape n'est jamais avancée automatiquement deux fois (retour arrière
 *    possible et modification libre, sans repartir en avant tout seul) ;
 *  - les étapes irréversibles (paiement, récapitulatif, confirmation) ne
 *    doivent tout simplement pas être déclarées comme « auto ».
 */
export function useAutoAdvance(options: {
  /** Index de l'étape courante. */
  step: number;
  /** Étapes autorisées à s'auto-valider. */
  autoSteps: number[];
  /** Toutes les données obligatoires de l'étape courante sont valides. */
  valid: boolean;
  /** Action d'avancement (identique au bouton « Continuer »). */
  onAdvance: () => void;
  /** Désactive temporairement le mécanisme (chargement, soumission…). */
  enabled?: boolean;
  /** Délai avant avancement, en ms. */
  delay?: number;
  /** Message de feedback. */
  label?: string;
}) {
  const { step, autoSteps, valid, onAdvance, enabled = true, delay = 550, label = "Étape validée" } = options;

  const consumed = useRef<Set<number>>(new Set());
  const advanceRef = useRef(onAdvance);
  advanceRef.current = onAdvance;

  useEffect(() => {
    if (!enabled || !autoSteps.includes(step)) return;
    if (!valid) {
      consumed.current.delete(step);
      return;
    }
    if (consumed.current.has(step)) return;

    const t = setTimeout(() => {
      consumed.current.add(step);
      appToast.success(label);
      advanceRef.current();
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, valid, enabled, delay, label]);

  useEffect(() => {
    if (!autoSteps.includes(step)) {
      consumed.current.clear();
      return;
    }
    if (!valid) {
      consumed.current.delete(step);
    }
  }, [step, valid, autoSteps]);
}
