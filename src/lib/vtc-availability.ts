/**
 * Mise en sommeil temporaire du service VTC.
 * Le service reste visible dans l'interface mais aucune réservation
 * n'est possible avant la date de réouverture.
 */

/** Jeudi 13 août 2026 à 00h00 (heure locale). */
export const VTC_REOPEN_DATE = new Date(2026, 7, 13, 0, 0, 0);

export const VTC_REOPEN_LABEL = "jeudi 13 août 2026";

export function isVtcAvailable(now: Date = new Date()): boolean {
  return now.getTime() >= VTC_REOPEN_DATE.getTime();
}
