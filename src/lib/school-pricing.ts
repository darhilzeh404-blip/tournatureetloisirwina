/**
 * Tarification officielle du transport scolaire — source de vérité côté client.
 *
 * Doit rester STRICTEMENT alignée avec la fonction SQL
 * `public.school_transport_amount(monthly, trip_type, months, children)` :
 *   - Aller-Retour            → tarif mensuel plein
 *   - Aller simple / Retour   → floor(tarif / 2) + 10 000 FCFA
 *   - Total = tarif unitaire × mois (1..24) × enfants (1..20)
 */

export type SchoolTripType = "aller_retour" | "aller_simple" | "retour_simple";

export const SCHOOL_SIMPLE_TRIP_SURCHARGE = 10_000;

const SIMPLE_ALIASES = new Set([
  "aller_simple",
  "retour_simple",
  "simple",
  "aller",
  "retour",
  "one_way",
  "allersimple",
  "retoursimple",
]);

/** Normalise le type de trajet exactement comme `public.normalize_school_trip_type`. */
export function normalizeSchoolTripType(tripType?: string | null): "aller_retour" | "aller_simple" {
  const key = String(tripType ?? "aller_retour")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]+/g, "_");
  return SIMPLE_ALIASES.has(key) ? "aller_simple" : "aller_retour";
}

/** Tarif mensuel par enfant selon le type de trajet. */
export function schoolUnitPrice(monthlyPrice: number, tripType?: string | null): number {
  const monthly = Math.max(0, Math.floor(Number(monthlyPrice) || 0));
  return normalizeSchoolTripType(tripType) === "aller_simple"
    ? Math.floor(monthly / 2) + SCHOOL_SIMPLE_TRIP_SURCHARGE
    : monthly;
}

const clamp = (value: unknown, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.floor(Number(value) || min)));

/** Montant total d'une réservation scolaire (identique au calcul serveur). */
export function calculateSchoolTransportAmount(params: {
  monthlyPrice: number;
  tripType?: string | null;
  months?: number;
  children?: number;
}): number {
  const months = clamp(params.months, 1, 24);
  const children = clamp(params.children, 1, 20);
  return schoolUnitPrice(params.monthlyPrice, params.tripType) * months * children;
}

/**
 * Champs obligatoires à envoyer dans `reservations.details` pour que le
 * recalcul serveur aboutisse au même montant.
 */
export function schoolPricingDetails(params: {
  schoolRouteId: string;
  tripType: SchoolTripType;
  months: number;
  children: number;
}) {
  return {
    school_route_id: params.schoolRouteId,
    trip_type: normalizeSchoolTripType(params.tripType) === "aller_simple"
      ? params.tripType
      : "aller_retour",
    months: clamp(params.months, 1, 24),
    children_count: clamp(params.children, 1, 20),
  };
}
