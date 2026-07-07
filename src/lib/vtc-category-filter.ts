/**
 * Filtrage strict par catégorie VTC.
 *
 * Un chauffeur enregistré dans une catégorie (STANDARD, CONFORT, VIP) ne doit
 * JAMAIS recevoir de notification pour une course d'une autre catégorie.
 *
 * Cette règle est appliquée à trois niveaux :
 *   1. SQL (RPC `find_nearby_vtc_drivers`, `trigger_driver_search`, `get_vtc_pending_pool`)
 *   2. Trigger `trg_set_trip_category` qui copie la catégorie de la réservation sur le trip
 *   3. Client Realtime — filtre défensif dans `chauffeur-vtc.tsx` via cette fonction
 *
 * La fonction est volontairement pure pour être testable unitairement.
 */

export type VtcCategory = "STANDARD" | "CONFORT" | "VIP";

export const VTC_CATEGORIES: readonly VtcCategory[] = ["STANDARD", "CONFORT", "VIP"] as const;

export function isVtcCategory(value: unknown): value is VtcCategory {
  return value === "STANDARD" || value === "CONFORT" || value === "VIP";
}

/**
 * Retourne `true` si la course doit être notifiée au chauffeur, `false` sinon.
 *
 * Règle : match strict. Toute divergence entre `driverCategory` et
 * `tripCategory` bloque la notification. Un `null`/`undefined` côté course
 * (donnée manquante en base) est traité comme non-match — on préfère ne pas
 * notifier plutôt que de risquer un mismatch.
 *
 * Un `null` côté chauffeur (catégorie pas encore chargée) laisse passer :
 * la source de vérité reste alors le filtre serveur SQL.
 */
export function shouldDispatchTripToDriver(
  driverCategory: VtcCategory | null | undefined,
  tripCategory: string | null | undefined,
): boolean {
  if (!isVtcCategory(driverCategory)) return true; // Serveur = source de vérité
  if (!isVtcCategory(tripCategory)) return false; // Course sans catégorie => on ignore
  return driverCategory === tripCategory;
}
