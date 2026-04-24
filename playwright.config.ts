import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the chauffeur E2E flow.
 *
 * Variables d'env requises (créer un fichier .env.local NON committé) :
 *   E2E_BASE_URL=https://tournatureetloisirwina.lovable.app
 *   E2E_CHAUFFEUR_EMAIL=chauffeur-test@example.com
 *   E2E_CHAUFFEUR_PASSWORD=********
 *   E2E_TRIP_ID=<uuid d'un trip assigné à ce chauffeur, status pending|assigned|active>
 *   E2E_EXPECTED_LAT=0.4162
 *   E2E_EXPECTED_LNG=9.4673
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://tournatureetloisirwina.lovable.app",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 414, height: 896 },
    locale: "fr-FR",
    geolocation: { latitude: 0.39, longitude: 9.45 },
    permissions: ["geolocation"],
  },
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});