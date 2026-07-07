import { describe, it, expect, beforeEach, vi } from "vitest";
import { shouldDispatchTripToDriver, type VtcCategory } from "@/lib/vtc-category-filter";

/**
 * Test d'intégration du pipeline de dispatch VTC.
 *
 * On simule :
 *   1. La RPC `find_nearby_vtc_drivers` qui filtre côté SERVEUR par
 *      `_pickup_lat/_pickup_lng/_radius_km` ET par catégorie du trip.
 *   2. Le handler realtime `postgres_changes` INSERT sur `trips` qui, côté
 *      CLIENT, ré-applique `shouldDispatchTripToDriver` pour éviter tout
 *      leak accidentel si un événement mal filtré arrive.
 *
 * Objectif : garantir qu'aucun mélange de catégorie ne peut se produire,
 * ni côté RPC ni côté client.
 */

// ----- Simulation SQL : find_nearby_vtc_drivers -----
// Reproduit la logique du filtre serveur : distance ≤ radius ET
// drivers.category = trip.category (jointure via reservations).
type DbDriver = {
  driver_id: string;
  category: VtcCategory;
  lat: number;
  lng: number;
  is_online: boolean;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function findNearbyVtcDriversRpc(params: {
  pickup: { lat: number; lng: number };
  radiusKm: number;
  tripCategory: VtcCategory;
  drivers: DbDriver[];
}) {
  return params.drivers
    .filter((d) => d.is_online)
    .filter((d) => d.category === params.tripCategory) // ← filtre catégorie serveur
    .map((d) => ({ ...d, distance_km: haversineKm(params.pickup, { lat: d.lat, lng: d.lng }) }))
    .filter((d) => d.distance_km <= params.radiusKm);
}

// ----- Fixtures -----
const PICKUP = { lat: 0.39, lng: 9.45 }; // Libreville
const DRIVERS: DbDriver[] = [
  { driver_id: "std-1", category: "STANDARD", lat: 0.39, lng: 9.451, is_online: true },
  { driver_id: "std-2", category: "STANDARD", lat: 0.395, lng: 9.455, is_online: true },
  { driver_id: "cft-1", category: "CONFORT", lat: 0.391, lng: 9.452, is_online: true },
  { driver_id: "cft-2", category: "CONFORT", lat: 0.392, lng: 9.453, is_online: true },
  { driver_id: "vip-1", category: "VIP", lat: 0.393, lng: 9.454, is_online: true },
  { driver_id: "vip-off", category: "VIP", lat: 0.39, lng: 9.45, is_online: false },
];

describe("RPC find_nearby_vtc_drivers — filtre catégorie serveur", () => {
  it("course STANDARD → uniquement chauffeurs STANDARD", () => {
    const found = findNearbyVtcDriversRpc({
      pickup: PICKUP,
      radiusKm: 5,
      tripCategory: "STANDARD",
      drivers: DRIVERS,
    });
    expect(found.map((d) => d.driver_id).sort()).toEqual(["std-1", "std-2"]);
    expect(found.every((d) => d.category === "STANDARD")).toBe(true);
  });

  it("course CONFORT → uniquement chauffeurs CONFORT", () => {
    const found = findNearbyVtcDriversRpc({
      pickup: PICKUP,
      radiusKm: 5,
      tripCategory: "CONFORT",
      drivers: DRIVERS,
    });
    expect(found.map((d) => d.driver_id).sort()).toEqual(["cft-1", "cft-2"]);
    expect(found.every((d) => d.category === "CONFORT")).toBe(true);
  });

  it("course VIP → uniquement chauffeurs VIP en ligne", () => {
    const found = findNearbyVtcDriversRpc({
      pickup: PICKUP,
      radiusKm: 5,
      tripCategory: "VIP",
      drivers: DRIVERS,
    });
    expect(found.map((d) => d.driver_id)).toEqual(["vip-1"]);
    expect(found.every((d) => d.category === "VIP")).toBe(true);
  });

  it("aucun chauffeur d'une autre catégorie n'apparaît jamais", () => {
    for (const cat of ["STANDARD", "CONFORT", "VIP"] as const) {
      const found = findNearbyVtcDriversRpc({
        pickup: PICKUP,
        radiusKm: 5,
        tripCategory: cat,
        drivers: DRIVERS,
      });
      for (const d of found) expect(d.category).toBe(cat);
    }
  });
});

// ----- Simulation client Realtime -----
// Reproduit le handler INSERT du fichier src/routes/chauffeur-vtc.tsx :
// il n'appelle showNotification que si shouldDispatchTripToDriver le permet.

function makeRealtimeHandler(driverCategory: VtcCategory) {
  const notified: string[] = [];
  const handler = (trip: { id: string; category: string | null; status: string; driver_id: string | null }) => {
    if (trip.status !== "pending" || trip.driver_id) return;
    if (!shouldDispatchTripToDriver(driverCategory, trip.category)) return;
    notified.push(trip.id);
  };
  return { handler, notified };
}

describe("Realtime handler — double filtre client", () => {
  const events = [
    { id: "t-std", category: "STANDARD", status: "pending", driver_id: null },
    { id: "t-cft", category: "CONFORT", status: "pending", driver_id: null },
    { id: "t-vip", category: "VIP", status: "pending", driver_id: null },
    { id: "t-nocat", category: null, status: "pending", driver_id: null },
    { id: "t-assigned", category: "STANDARD", status: "pending", driver_id: "someone" },
  ];

  it("chauffeur STANDARD n'est notifié QUE pour t-std", () => {
    const { handler, notified } = makeRealtimeHandler("STANDARD");
    events.forEach(handler);
    expect(notified).toEqual(["t-std"]);
  });

  it("chauffeur CONFORT n'est notifié QUE pour t-cft", () => {
    const { handler, notified } = makeRealtimeHandler("CONFORT");
    events.forEach(handler);
    expect(notified).toEqual(["t-cft"]);
  });

  it("chauffeur VIP n'est notifié QUE pour t-vip", () => {
    const { handler, notified } = makeRealtimeHandler("VIP");
    events.forEach(handler);
    expect(notified).toEqual(["t-vip"]);
  });

  it("aucune notification cross-catégorie sur 1000 événements aléatoires", () => {
    const cats: VtcCategory[] = ["STANDARD", "CONFORT", "VIP"];
    for (const myCat of cats) {
      const { handler, notified } = makeRealtimeHandler(myCat);
      for (let i = 0; i < 1000; i++) {
        const tripCat = cats[i % 3];
        handler({ id: `t-${i}`, category: tripCat, status: "pending", driver_id: null });
      }
      // Toute notification doit correspondre à la catégorie du chauffeur
      // (~333 sur 1000).
      expect(notified.length).toBeGreaterThan(0);
      expect(notified.length).toBeLessThan(1000);
      for (const id of notified) {
        const idx = Number(id.slice(2));
        expect(cats[idx % 3]).toBe(myCat);
      }
    }
  });
});

// ----- Test end-to-end simulé : pipeline complet -----
describe("Pipeline complet : RPC + Realtime — aucune fuite entre catégories", () => {
  it.each(["STANDARD", "CONFORT", "VIP"] as const)(
    "trip %s ne peut être livré qu'à un chauffeur de même catégorie",
    (tripCategory) => {
      // 1. RPC serveur sélectionne les chauffeurs candidats
      const candidates = findNearbyVtcDriversRpc({
        pickup: PICKUP,
        radiusKm: 5,
        tripCategory,
        drivers: DRIVERS,
      });

      // 2. Pour chaque chauffeur DE LA BASE (pas seulement les candidats),
      //    on simule la réception realtime : seuls les match doivent notifier.
      const trip = { id: "T1", category: tripCategory, status: "pending", driver_id: null };
      const notifiedIds: string[] = [];
      for (const d of DRIVERS) {
        if (!d.is_online) continue;
        if (shouldDispatchTripToDriver(d.category, trip.category)) {
          notifiedIds.push(d.driver_id);
        }
      }

      // Les chauffeurs notifiés côté client == candidats RPC serveur (même règle)
      expect(notifiedIds.sort()).toEqual(candidates.map((c) => c.driver_id).sort());

      // Et tous partagent la catégorie du trip
      const notifiedCats = new Set(
        DRIVERS.filter((d) => notifiedIds.includes(d.driver_id)).map((d) => d.category),
      );
      expect([...notifiedCats]).toEqual([tripCategory]);
    },
  );
});

// Sanity : vi est bien chargé (pour extension future avec spies)
describe("harness", () => {
  beforeEach(() => vi.clearAllMocks());
  it("vitest est opérationnel", () => expect(vi).toBeDefined());
});
