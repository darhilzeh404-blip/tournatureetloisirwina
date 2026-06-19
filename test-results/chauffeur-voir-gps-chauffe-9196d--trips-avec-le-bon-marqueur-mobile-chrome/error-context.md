# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chauffeur-voir-gps.spec.ts >> chauffeur : Voir GPS ouvre /chauffeur/trips avec le bon marqueur
- Location: tests\e2e\chauffeur-voir-gps.spec.ts:28:1

# Error details

```
Error: Variables d'env manquantes : E2E_CHAUFFEUR_EMAIL, E2E_CHAUFFEUR_PASSWORD, E2E_TRIP_ID, E2E_EXPECTED_LAT, E2E_EXPECTED_LNG
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | /**
  4  |  * E2E : le chauffeur se connecte, ouvre l'onglet « Assignées »,
  5  |  * clique « Voir GPS » et la page /chauffeur/trips affiche le bon
  6  |  * marqueur Leaflet (coordonnées exactes via window.__leafletMap).
  7  |  *
  8  |  * Requis :
  9  |  *   - Compte chauffeur de test existant en base (rôle 'chauffeur').
  10 |  *   - Un trip assigné à ce chauffeur (E2E_TRIP_ID), status pending|assigned|active,
  11 |  *     avec une ligne client_positions correspondante (lat/lng connus).
  12 |  */
  13 | 
  14 | const EMAIL = process.env.E2E_CHAUFFEUR_EMAIL;
  15 | const PASSWORD = process.env.E2E_CHAUFFEUR_PASSWORD;
  16 | const TRIP_ID = process.env.E2E_TRIP_ID;
  17 | const EXPECTED_LAT = Number(process.env.E2E_EXPECTED_LAT);
  18 | const EXPECTED_LNG = Number(process.env.E2E_EXPECTED_LNG);
  19 | 
  20 | test.beforeAll(() => {
  21 |   if (!EMAIL || !PASSWORD || !TRIP_ID || !Number.isFinite(EXPECTED_LAT) || !Number.isFinite(EXPECTED_LNG)) {
> 22 |     throw new Error(
     |           ^ Error: Variables d'env manquantes : E2E_CHAUFFEUR_EMAIL, E2E_CHAUFFEUR_PASSWORD, E2E_TRIP_ID, E2E_EXPECTED_LAT, E2E_EXPECTED_LNG
  23 |       "Variables d'env manquantes : E2E_CHAUFFEUR_EMAIL, E2E_CHAUFFEUR_PASSWORD, E2E_TRIP_ID, E2E_EXPECTED_LAT, E2E_EXPECTED_LNG"
  24 |     );
  25 |   }
  26 | });
  27 | 
  28 | test("chauffeur : Voir GPS ouvre /chauffeur/trips avec le bon marqueur", async ({ page }) => {
  29 |   // 1. Connexion
  30 |   await page.goto("/connexion");
  31 |   await page.getByPlaceholder(/email/i).fill(EMAIL!);
  32 |   await page.getByPlaceholder(/mot de passe|password/i).fill(PASSWORD!);
  33 |   await page.getByRole("button", { name: /se connecter|login/i }).click();
  34 | 
  35 |   // 2. Redirection vers l'espace chauffeur
  36 |   await page.waitForURL(/\/chauffeur(\?|$|\/)/, { timeout: 20_000 });
  37 | 
  38 |   // 3. Onglet « Assignées »
  39 |   await page.getByRole("button", { name: /assignées/i }).click();
  40 | 
  41 |   // 4. Clic « Voir GPS » sur le trip ciblé
  42 |   //    On cible directement le Link rendu pour ce tripId pour éviter l'ambiguïté multi-trips.
  43 |   const voirGpsLink = page.locator(`a[href*="/chauffeur/trips"][href*="tripId=${TRIP_ID}"]`).first();
  44 |   await expect(voirGpsLink).toBeVisible({ timeout: 15_000 });
  45 |   await voirGpsLink.click();
  46 | 
  47 |   // 5. URL = /chauffeur/trips?tripId=...
  48 |   await page.waitForURL(new RegExp(`/chauffeur/trips\\?.*tripId=${TRIP_ID}`), { timeout: 15_000 });
  49 | 
  50 |   // 6. La carte Leaflet est montée
  51 |   await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 20_000 });
  52 |   await page.waitForFunction(() => Boolean((window as unknown as { __leafletMap?: unknown }).__leafletMap), null, {
  53 |     timeout: 15_000,
  54 |   });
  55 | 
  56 |   // 7. Le marqueur 'client' est présent avec les coordonnées attendues
  57 |   //    (tolérance 1e-4 ≈ ~10m pour absorber les arrondis de transmission GPS).
  58 |   const clientMarker = await page.evaluate(() => {
  59 |     const markers = (window as unknown as { __leafletMarkers?: { id: string; lat: number; lng: number; type: string }[] })
  60 |       .__leafletMarkers;
  61 |     return markers?.find((m) => m.type === "client") ?? null;
  62 |   });
  63 | 
  64 |   expect(clientMarker, "Aucun marqueur 'client' rendu sur la carte").not.toBeNull();
  65 |   expect(clientMarker!.lat).toBeCloseTo(EXPECTED_LAT, 4);
  66 |   expect(clientMarker!.lng).toBeCloseTo(EXPECTED_LNG, 4);
  67 | 
  68 |   // 8. Sanity-check : un nœud DOM Leaflet pour ce marqueur existe bien
  69 |   const domMarkerCount = await page.locator(".leaflet-marker-icon").count();
  70 |   expect(domMarkerCount).toBeGreaterThan(0);
  71 | });
```