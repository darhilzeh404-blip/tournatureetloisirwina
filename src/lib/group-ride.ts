// Logique partagée pour le Déplacement Groupé (covoiturage Libreville).
import { detectZone, zoneLabel, type ZoneId } from "@/lib/vtc-zones";

export const GROUP_MAX_SEATS = 3;
export const GROUP_WAIT_MINUTES = 5;
export const GROUP_PRICE_BY_COMMUNES: Record<1 | 2 | 3, number> = {
  1: 1500,
  2: 2000,
  3: 2500,
};

export type GroupStop = {
  lat: number;
  lng: number;
  address: string;
  commune: ZoneId | null;
};

export function communesCount(pickup: GroupStop, destination: GroupStop): 1 | 2 | 3 {
  const zones = new Set<ZoneId>();
  if (pickup.commune) zones.add(pickup.commune);
  if (destination.commune) zones.add(destination.commune);
  const n = Math.max(1, zones.size);
  return Math.min(3, n) as 1 | 2 | 3;
}

export function pricePerSeat(count: 1 | 2 | 3): number {
  return GROUP_PRICE_BY_COMMUNES[count];
}

/** Signature simple pour grouper les passagers compatibles. */
export function rideSignature(pickup: GroupStop, destination: GroupStop): string {
  return `${pickup.commune ?? "x"}>${destination.commune ?? "x"}`;
}

export function stopFromCoords(lat: number, lng: number, address: string): GroupStop {
  return { lat, lng, address, commune: detectZone(lat, lng) };
}

export function communeLabel(z: ZoneId | null): string {
  return zoneLabel(z);
}

export const GROUP_RIDE_STATUS_LABEL: Record<string, string> = {
  searching: "Recherche de passagers",
  matched: "Groupe constitué",
  driver_arriving: "Chauffeur en route",
  active: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

/** Points d'arrêt populaires à Libreville pour sélection rapide. */
export type PopularStop = {
  label: string;
  lat: number;
  lng: number;
  commune: ZoneId;
};

export const POPULAR_STOPS: PopularStop[] = [
  // Libreville
  { label: "Aéroport Léon Mba", lat: 0.4586, lng: 9.4123, commune: "libreville" },
  { label: "Carrefour IAI", lat: 0.4162, lng: 9.4673, commune: "libreville" },
  { label: "Centre-ville (Mont-Bouët)", lat: 0.3924, lng: 9.4536, commune: "libreville" },
  { label: "Université Omar Bongo", lat: 0.4036, lng: 9.4751, commune: "libreville" },
  { label: "PK5", lat: 0.4421, lng: 9.4625, commune: "libreville" },
  { label: "Nzeng-Ayong", lat: 0.4225, lng: 9.5012, commune: "libreville" },
  // Akanda
  { label: "Angondjé Stade", lat: 0.4825, lng: 9.4357, commune: "akanda" },
  { label: "Cap Estérias", lat: 0.5894, lng: 9.3265, commune: "akanda" },
  // Owendo
  { label: "Port d'Owendo", lat: 0.2978, lng: 9.5006, commune: "owendo" },
  { label: "Gare routière Owendo", lat: 0.3105, lng: 9.4953, commune: "owendo" },
];

/** Distance Haversine en kilomètres. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Estimation simple trajet urbain Libreville :
 * - +25% pour tenir compte des détours routiers
 * - vitesse moyenne 22 km/h (trafic urbain)
 * - +3 min de prise en charge / arrêts groupés
 */
export function estimateTrip(
  pickup: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): { distanceKm: number; durationMin: number } {
  const straight = distanceKm(pickup, destination);
  const road = straight * 1.25;
  const minutes = (road / 22) * 60 + 3;
  return {
    distanceKm: Math.max(0.5, Math.round(road * 10) / 10),
    durationMin: Math.max(5, Math.round(minutes)),
  };
}
