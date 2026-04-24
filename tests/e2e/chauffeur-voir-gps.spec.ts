import { test, expect } from "@playwright/test";

/**
 * E2E : le chauffeur se connecte, ouvre l'onglet « Assignées »,
 * clique « Voir GPS » et la page /chauffeur/trips affiche le bon
 * marqueur Leaflet (coordonnées exactes via window.__leafletMap).
 *
 * Requis :
 *   - Compte chauffeur de test existant en base (rôle 'chauffeur').
 *   - Un trip assigné à ce chauffeur (E2E_TRIP_ID), status pending|assigned|active,
 *     avec une ligne client_positions correspondante (lat/lng connus).
 */

const EMAIL = process.env.E2E_CHAUFFEUR_EMAIL;
const PASSWORD = process.env.E2E_CHAUFFEUR_PASSWORD;
const TRIP_ID = process.env.E2E_TRIP_ID;
const EXPECTED_LAT = Number(process.env.E2E_EXPECTED_LAT);
const EXPECTED_LNG = Number(process.env.E2E_EXPECTED_LNG);

test.beforeAll(() => {
  if (!EMAIL || !PASSWORD || !TRIP_ID || !Number.isFinite(EXPECTED_LAT) || !Number.isFinite(EXPECTED_LNG)) {
    throw new Error(
      "Variables d'env manquantes : E2E_CHAUFFEUR_EMAIL, E2E_CHAUFFEUR_PASSWORD, E2E_TRIP_ID, E2E_EXPECTED_LAT, E2E_EXPECTED_LNG"
    );
  }
});

test("chauffeur : Voir GPS ouvre /chauffeur/trips avec le bon marqueur", async ({ page }) => {
  // 1. Connexion
  await page.goto("/connexion");
  await page.getByPlaceholder(/email/i).fill(EMAIL!);
  await page.getByPlaceholder(/mot de passe|password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /se connecter|login/i }).click();

  // 2. Redirection vers l'espace chauffeur
  await page.waitForURL(/\/chauffeur(\?|$|\/)/, { timeout: 20_000 });

  // 3. Onglet « Assignées »
  await page.getByRole("button", { name: /assignées/i }).click();

  // 4. Clic « Voir GPS » sur le trip ciblé
  //    On cible directement le Link rendu pour ce tripId pour éviter l'ambiguïté multi-trips.
  const voirGpsLink = page.locator(`a[href*="/chauffeur/trips"][href*="tripId=${TRIP_ID}"]`).first();
  await expect(voirGpsLink).toBeVisible({ timeout: 15_000 });
  await voirGpsLink.click();

  // 5. URL = /chauffeur/trips?tripId=...
  await page.waitForURL(new RegExp(`/chauffeur/trips\\?.*tripId=${TRIP_ID}`), { timeout: 15_000 });

  // 6. La carte Leaflet est montée
  await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __leafletMap?: unknown }).__leafletMap), null, {
    timeout: 15_000,
  });

  // 7. Le marqueur 'client' est présent avec les coordonnées attendues
  //    (tolérance 1e-4 ≈ ~10m pour absorber les arrondis de transmission GPS).
  const clientMarker = await page.evaluate(() => {
    const markers = (window as unknown as { __leafletMarkers?: { id: string; lat: number; lng: number; type: string }[] })
      .__leafletMarkers;
    return markers?.find((m) => m.type === "client") ?? null;
  });

  expect(clientMarker, "Aucun marqueur 'client' rendu sur la carte").not.toBeNull();
  expect(clientMarker!.lat).toBeCloseTo(EXPECTED_LAT, 4);
  expect(clientMarker!.lng).toBeCloseTo(EXPECTED_LNG, 4);

  // 8. Sanity-check : un nœud DOM Leaflet pour ce marqueur existe bien
  const domMarkerCount = await page.locator(".leaflet-marker-icon").count();
  expect(domMarkerCount).toBeGreaterThan(0);
});