// Définitions des zones géographiques pour la tarification VTC.
// Coordonnées approximatives autour de Libreville / Akanda / Owendo (Gabon).
// Chaque zone est un polygone simple [lat, lng].

export type ZoneId = "akanda" | "libreville" | "owendo";

export type Zone = {
  id: ZoneId;
  label: string;
  color: string; // couleur d'affichage Leaflet
  polygon: [number, number][];
};

/**
 * Polygones approximatifs. Ils ne sont pas cadastraux, ils servent à
 * détecter dans laquelle des trois zones tarifaires un point se trouve.
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
    id: "libreville",
    label: "Grand Libreville",
    color: "#2563eb",
    polygon: [
      [0.3700, 9.3700],
      [0.5400, 9.3700],
      [0.5400, 9.5200],
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
];

/** Algorithme ray-casting : détermine si un point est dans un polygone. */
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [y, x] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function detectZone(lat: number, lng: number): ZoneId | null {
  for (const z of ZONES) {
    if (pointInPolygon([lat, lng], z.polygon)) return z.id;
  }
  return null;
}

export function zoneLabel(id: ZoneId | null): string {
  if (!id) return "Hors zone";
  return ZONES.find((z) => z.id === id)?.label ?? "Hors zone";
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarification
// ─────────────────────────────────────────────────────────────────────────────

export type VehicleCategory = "standard" | "confort" | "vip";
export type RideMode = "express" | "hour"; // course express OU course express 1h

/**
 * Grille tarifaire de base, en FCFA.
 * Clé = "<zoneA>-<zoneB>" triée alphabétiquement OU "<zone>" pour intra-zone.
 * Tarifs basés sur "VTC Standard" et "VTC VIP" fournis. "Confort" = Standard +30%.
 */
type FareKey = string;

const STANDARD_FARES: Record<FareKey, { express: number; hour: number }> = {
  "akanda": { express: 2_000, hour: 5_000 },
  "akanda-libreville": { express: 5_000, hour: 8_000 },
  "akanda-owendo": { express: 8_000, hour: 10_000 },
  // tarifs déduits par symétrie/cohérence pour les autres combinaisons
  "libreville": { express: 2_000, hour: 5_000 },
  "owendo": { express: 2_000, hour: 5_000 },
  "libreville-owendo": { express: 5_000, hour: 8_000 },
};

const VIP_FARES: Record<FareKey, { express: number; hour: number }> = {
  "akanda": { express: 5_000, hour: 10_000 },
  "akanda-libreville": { express: 10_000, hour: 15_000 },
  "akanda-owendo": { express: 15_000, hour: 20_000 },
  "libreville": { express: 5_000, hour: 10_000 },
  "owendo": { express: 5_000, hour: 10_000 },
  "libreville-owendo": { express: 10_000, hour: 15_000 },
};

function fareKey(a: ZoneId, b: ZoneId): FareKey {
  if (a === b) return a;
  return [a, b].sort().join("-");
}

export type FareResult = {
  ok: boolean;
  reason?: string;
  zoneFrom: ZoneId | null;
  zoneTo: ZoneId | null;
  base: number; // tarif Standard
  price: number; // tarif final selon catégorie
  category: VehicleCategory;
  mode: RideMode;
};

const CATEGORY_MULTIPLIER: Record<VehicleCategory, number> = {
  standard: 1,
  confort: 1.3, // +30%
  vip: 1, // VIP utilise sa propre grille
};

export function computeFare(args: {
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
  category: VehicleCategory;
  mode: RideMode;
}): FareResult {
  const { fromLat, fromLng, toLat, toLng, category, mode } = args;
  const zoneFrom = fromLat != null && fromLng != null ? detectZone(fromLat, fromLng) : null;
  const zoneTo = toLat != null && toLng != null ? detectZone(toLat, toLng) : null;

  if (!zoneFrom || !zoneTo) {
    return {
      ok: false,
      reason: "Sélectionnez deux points dans nos zones desservies.",
      zoneFrom, zoneTo, base: 0, price: 0, category, mode,
    };
  }

  const key = fareKey(zoneFrom, zoneTo);
  const grid = category === "vip" ? VIP_FARES : STANDARD_FARES;
  const fare = grid[key];
  if (!fare) {
    return {
      ok: false,
      reason: "Aucun tarif défini pour ce trajet.",
      zoneFrom, zoneTo, base: 0, price: 0, category, mode,
    };
  }

  const base = fare[mode];
  const price = category === "confort"
    ? Math.round(base * CATEGORY_MULTIPLIER.confort / 100) * 100
    : base;

  return { ok: true, zoneFrom, zoneTo, base, price, category, mode };
}

export const formatXAF = (amount: number) =>
  new Intl.NumberFormat("fr-GA", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(amount);
