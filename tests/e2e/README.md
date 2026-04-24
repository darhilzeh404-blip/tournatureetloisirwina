# Tests E2E — Chauffeur « Voir GPS »

Vérifie que le chauffeur peut cliquer sur **Voir GPS** dans la liste des courses
assignées et que la page `/chauffeur/trips` affiche bien la carte Leaflet avec
le marqueur **client** aux coordonnées exactes attendues.

## Pré-requis

1. **Un compte chauffeur de test** existant en base (rôle `chauffeur` dans
   `user_roles`).
2. **Un trip assigné** à ce chauffeur (`trips.driver_id = <user_id>`,
   `status` ∈ `pending|assigned|active`).
3. **Une position client** (`client_positions`) liée à ce trip avec des
   coordonnées connues à l'avance.

> ⚠️ Ne jamais utiliser un compte de production. Crée un user dédié au test.

## Variables d'environnement

Crée un fichier `.env.local` à la racine (ignoré par git) :

```bash
E2E_BASE_URL=https://tournatureetloisirwina.lovable.app
E2E_CHAUFFEUR_EMAIL=chauffeur-test@example.com
E2E_CHAUFFEUR_PASSWORD=********
E2E_TRIP_ID=00000000-0000-0000-0000-000000000000
E2E_EXPECTED_LAT=0.4162
E2E_EXPECTED_LNG=9.4673
```

## Lancement

```bash
# 1. Installer les navigateurs Playwright (une fois)
npx playwright install chromium

# 2. Charger les variables d'env puis lancer
set -a && source .env.local && set +a
npx playwright test

# Mode debug visuel
npx playwright test --headed --debug
```

## Ce que vérifie le test

1. Connexion réussie en tant que chauffeur → redirection vers `/chauffeur`.
2. Onglet **Assignées** affiché avec au moins une carte course.
3. Clic sur **Voir GPS** → URL devient `/chauffeur/trips?tripId=<E2E_TRIP_ID>`.
4. La carte Leaflet (`.leaflet-container`) est montée.
5. Le marqueur `client` exposé via `window.__leafletMarkers` a bien
   `lat ≈ E2E_EXPECTED_LAT` et `lng ≈ E2E_EXPECTED_LNG` (tolérance 1e-4).
6. Au moins un `<div class="leaflet-marker-icon">` est rendu dans le DOM.

## Hook d'instrumentation

`src/components/LiveMap.tsx` expose à des fins de test :

- `window.__leafletMap` — l'instance Leaflet active.
- `window.__leafletMarkers` — le tableau des markers passé au composant.

Aucun impact UI ni runtime hors de cette assignation de propriété.