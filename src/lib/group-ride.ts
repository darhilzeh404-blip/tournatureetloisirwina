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
