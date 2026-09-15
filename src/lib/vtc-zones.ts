// Définitions géographiques utilisées uniquement pour l'affichage
// et l'aide visuelle sur la carte.
//
// IMPORTANT :
// Les tarifs VTC ne sont PLUS calculés dans ce fichier.
// La tarification officielle est centralisée dans Supabase via
// calculate_vtc_price() appelé depuis src/lib/vtc-pricing.ts.

export type ZoneId =
  | "akanda"
  | "libreville_nord"
  | "libreville_centre"
  | "libreville_sud"
  | "owendo"
  | "ntoum"
  | "airport";

export type Zone = {
  id: ZoneId;
  label: string;
  color: string;
  polygon: [number, number][];
};

/**
 * Polygones approximatifs utilisés uniquement pour l'affichage
 * et la représentation géographique.
 *
 * Ils ne constituent PAS la source de vérité tarifaire.
 */
export const ZONES: Zone[] = [
  {
    id: "akanda",
    label: "Akanda",
    color: "#16a34a",
    polygon: [
      [0.5950, 9.3200],
      [0.6300, 9.3200],
      [0.6300, 9.4900],
      [0.5400, 9.4900],
      [0.5400, 9.4100],
      [0.5950, 9.3500],
    ],
  },

  {
    id: "libreville_nord",
    label: "Libreville Nord",
    color: "#2563eb",
    polygon: [
      [0.4550, 9.3700],
      [0.5400, 9.3700],
      [0.5400, 9.5200],
      [0.4550, 9.5200],
    ],
  },

  {
    id: "libreville_centre",
    label: "Libreville Centre",
    color: "#2563eb",
    polygon: [
      [0.4100, 9.3700],
      [0.4550, 9.3700],
      [0.4550, 9.5200],
      [0.4100, 9.5200],
    ],
  },

  {
    id: "libreville_sud",
    label: "Libreville Sud",
    color: "#2563eb",
    polygon: [
      [0.3700, 9.3700],
      [0.4100, 9.3700],
      [0.4100, 9.5200],
      [0.3700, 9.5200],
    ],
  },

  {
    id: "owendo",
    label: "Owendo",
    color: "#dc2626",
    polygon: [
      [0.2500, 9.4400],
      [0.3700, 9.4400],
      [0.3700, 9.5400],
      [0.2500, 9.5400],
    ],
  },

  {
    id: "ntoum",
    label: "Ntoum",
    color: "#9333ea",
    polygon: [
      [0.3000, 9.6500],
      [0.4700, 9.6500],
      [0.4700, 9.8500],
      [0.3000, 9.8500],
    ],
  },

  {
    id: "airport",
    label: "Aéroport Léon-MBA",
    color: "#f59e0b",
    polygon: [
      [0.4450, 9.3900],
      [0.4750, 9.3900],
      [0.4750, 9.4400],
      [0.4450, 9.4400],
    ],
  },
];

/**
 * Algorithme ray-casting.
 * Utilisé uniquement pour la représentation locale d'une zone.
 *
 * NE PAS utiliser le résultat pour calculer le prix.
 */
function pointInPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {
  const [y, x] = point;

  let inside = false;

  for (
    let i = 0, j = polygon.length - 1;
    i < polygon.length;
    j = i++
  ) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Détection locale destinée à l'affichage.
 *
 * La tarification officielle utilise la détection effectuée
 * côté Supabase dans calculate_vtc_price().
 */
export function detectZone(
  lat: number,
  lng: number
): ZoneId | null {
  // L'aéroport doit être prioritaire car il se trouve
  // géographiquement dans la zone de Libreville.
  const airport = ZONES.find(
    (zone) => zone.id === "airport"
  );

  if (
    airport &&
    pointInPolygon([lat, lng], airport.polygon)
  ) {
    return airport.id;
  }

  for (const zone of ZONES) {
    if (zone.id === "airport") continue;

    if (pointInPolygon([lat, lng], zone.polygon)) {
      return zone.id;
    }
  }

  return null;
}

export function zoneLabel(
  id: ZoneId | string | null
): string {
  if (!id) {
    return "Hors zone";
  }

  const labels: Record<string, string> = {
    akanda: "Akanda",
    AKANDA: "Akanda",

    libreville: "Libreville",
    LIBREVILLE: "Libreville",

    libreville_nord: "Libreville Nord",
    LIBREVILLE_NORD: "Libreville Nord",

    libreville_centre: "Libreville Centre",
    LIBREVILLE_CENTRE: "Libreville Centre",

    libreville_sud: "Libreville Sud",
    LIBREVILLE_SUD: "Libreville Sud",

    owendo: "Owendo",
    OWENDO: "Owendo",

    ntoum: "Ntoum",
    NTOUM: "Ntoum",

    airport: "Aéroport Léon-MBA",
    AIRPORT: "Aéroport Léon-MBA",
  };

  return (
    labels[id] ??
    labels[id.toLowerCase()] ??
    "Hors zone"
  );
}

/**
 * Formatage monétaire uniquement.
 *
 * Aucun calcul de tarif n'est effectué ici.
 */
export const formatXAF = (amount: number) =>
  new Intl.NumberFormat("fr-GA", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(amount);