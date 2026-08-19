/**
 * Mise en sommeil temporaire du service VTC.
 * Le service reste visible dans l'interface mais aucune réservation
 * n'est possible avant la date de réouverture.
 */

/** Mercredi 2 septembre 2026 à 00h00 (heure locale). */
export const VTC_REOPEN_DATE = new Date(2026, 8, 2, 0, 0, 0);

export const VTC_REOPEN_LABEL = "mercredi 2 septembre 2026";

export function isVtcAvailable(now: Date = new Date()): boolean {
  return now.getTime() >= VTC_REOPEN_DATE.getTime();
}
