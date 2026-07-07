import { describe, it, expect } from "vitest";
import {
  shouldDispatchTripToDriver,
  isVtcCategory,
  VTC_CATEGORIES,
  type VtcCategory,
} from "@/lib/vtc-category-filter";

/**
 * Tests unitaires du filtre catégorie VTC.
 *
 * Invariant business :
 *   - Un chauffeur STANDARD ne reçoit QUE les courses STANDARD.
 *   - Un chauffeur CONFORT ne reçoit QUE les courses CONFORT.
 *   - Un chauffeur VIP ne reçoit QUE les courses VIP.
 *   - Le système ne doit JAMAIS mélanger les catégories.
 */

describe("isVtcCategory", () => {
  it("accepte les 3 catégories valides", () => {
    expect(isVtcCategory("STANDARD")).toBe(true);
    expect(isVtcCategory("CONFORT")).toBe(true);
    expect(isVtcCategory("VIP")).toBe(true);
  });

  it("rejette toute autre valeur", () => {
    expect(isVtcCategory("standard")).toBe(false); // sensible à la casse
    expect(isVtcCategory("PREMIUM")).toBe(false);
    expect(isVtcCategory("")).toBe(false);
    expect(isVtcCategory(null)).toBe(false);
    expect(isVtcCategory(undefined)).toBe(false);
    expect(isVtcCategory(42)).toBe(false);
  });
});

describe("shouldDispatchTripToDriver — matrice complète", () => {
  // Matrice 3x3 : seules les diagonales doivent être true.
  const matrix: Array<[VtcCategory, VtcCategory, boolean]> = [
    ["STANDARD", "STANDARD", true],
    ["STANDARD", "CONFORT", false],
    ["STANDARD", "VIP", false],
    ["CONFORT", "STANDARD", false],
    ["CONFORT", "CONFORT", true],
    ["CONFORT", "VIP", false],
    ["VIP", "STANDARD", false],
    ["VIP", "CONFORT", false],
    ["VIP", "VIP", true],
  ];

  it.each(matrix)(
    "chauffeur %s + course %s → dispatch=%s",
    (driver, trip, expected) => {
      expect(shouldDispatchTripToDriver(driver, trip)).toBe(expected);
    },
  );

  it("STANDARD ne reçoit JAMAIS de CONFORT ni de VIP", () => {
    expect(shouldDispatchTripToDriver("STANDARD", "CONFORT")).toBe(false);
    expect(shouldDispatchTripToDriver("STANDARD", "VIP")).toBe(false);
  });

  it("CONFORT ne reçoit JAMAIS de STANDARD ni de VIP", () => {
    expect(shouldDispatchTripToDriver("CONFORT", "STANDARD")).toBe(false);
    expect(shouldDispatchTripToDriver("CONFORT", "VIP")).toBe(false);
  });

  it("VIP ne reçoit JAMAIS de STANDARD ni de CONFORT", () => {
    expect(shouldDispatchTripToDriver("VIP", "STANDARD")).toBe(false);
    expect(shouldDispatchTripToDriver("VIP", "CONFORT")).toBe(false);
  });
});

describe("shouldDispatchTripToDriver — bords", () => {
  it("course sans catégorie : bloque le dispatch (fail-closed)", () => {
    for (const cat of VTC_CATEGORIES) {
      expect(shouldDispatchTripToDriver(cat, null)).toBe(false);
      expect(shouldDispatchTripToDriver(cat, undefined)).toBe(false);
      expect(shouldDispatchTripToDriver(cat, "")).toBe(false);
      expect(shouldDispatchTripToDriver(cat, "PREMIUM")).toBe(false);
    }
  });

  it("chauffeur sans catégorie chargée : laisse passer (filtre serveur = source de vérité)", () => {
    expect(shouldDispatchTripToDriver(null, "STANDARD")).toBe(true);
    expect(shouldDispatchTripToDriver(undefined, "CONFORT")).toBe(true);
  });

  it("valeurs invalides côté chauffeur : laisse passer au serveur", () => {
    // @ts-expect-error test d'entrée invalide
    expect(shouldDispatchTripToDriver("premium", "STANDARD")).toBe(true);
  });
});
