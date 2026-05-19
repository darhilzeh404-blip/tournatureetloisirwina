## Plan : Refonte « Déplacement Groupé »

> Note technique : votre brief mentionne « React Native + Expo », mais ce projet est une **PWA TanStack Start (web mobile-first)**. Je conserve cette stack — l'UI restera mobile-first premium. Confirmez si vous vouliez réellement basculer en natif (autre projet).

> Note Mapbox : le projet utilise actuellement **Leaflet/OSRM** (cf. `VtcZoneMap`, `useOsrmRoute`). Passer à Mapbox implique une clé API et la réécriture des composants carte existants. Je propose de **garder Leaflet/OSRM** pour rester cohérent et éviter des frais Mapbox. Dites-moi si vous voulez vraiment Mapbox (j'ajouterai `add_secret` pour `MAPBOX_TOKEN`).

---

### Phase 1 — Nettoyage de l'ancien « Groupe » (VTC)

Fichiers touchés :
- `src/routes/vtc.tsx` : retirer l'onglet `groupe`, `GroupeFlow`, constantes `GROUP_PICKUP_FEE`, `GROUP_PER_PAX`, l'entrée "Course de Groupe" dans `PremiumRangesSection`, et le type `MainTab`. L'onglet revient à `course | mariage`.
- `src/routes/mes-reservations.tsx` : conserver l'affichage "Course de groupe — …" (rétrocompatibilité pour anciennes réservations) — pas de suppression destructive.

**Préservé** : `transport_categories`, `reserver-transport` (groupes bus), `tarifs.tsx` groupes — ce sont des modules distincts (location bus de groupe), pas du covoiturage VTC.

Aucune table SQL supprimée → données existantes intactes.

---

### Phase 2 — Nouveau module « Déplacement Groupé »

#### 2.1 Base de données (migration)

5 tables neuves, isolées des modules existants :

```text
group_routes              -- corridors admin (Akanda↔Centre, etc.)
  id, name, communes_from[], communes_to[], is_active, created_at

group_rides               -- 1 course groupée (vehicle slot)
  id, route_id?, status, communes_count(1|2|3), price_per_seat,
  max_seats(3), seats_taken, departure_deadline, driver_id?,
  started_at?, completed_at?, created_at, updated_at

group_ride_passengers     -- 1 ligne par passager
  id, ride_id, user_id, pickup_address, pickup_lat/lng,
  destination_address, destination_lat/lng, commune_pickup,
  commune_destination, status (searching|matched|cancelled|completed),
  seat_index, joined_at

group_ride_payments       -- paiement par passager
  id, ride_id, passenger_id, user_id, amount, method, status,
  transaction_ref, created_at

group_ride_status_history -- audit
  id, ride_id, old_status, new_status, changed_by, created_at
```

RLS strict :
- passager voit sa ligne + sa course
- chauffeur voit les courses qu'il a acceptées + pool `pending`
- admin voit tout
- realtime activé sur `group_rides` et `group_ride_passengers`

#### 2.2 Logique de matching (server functions)

`src/lib/group-ride.functions.ts` :
- `findOrCreateGroupRide({pickup, destination, communes})` — cherche une course `searching` <5 min compatible (mêmes communes, places restantes), sinon en crée une.
- `cancelGroupRidePassenger({passengerId})`
- `startGroupRideIfReady({rideId})` — déclenche `active` si 3/3, ou via cron côté client (timer) si 2/3 au deadline.
- Tarif fixé serveur via règle communes : `1500 / 2000 / 2500 FCFA`.

Détection commune : utilise `src/lib/vtc-zones.ts` existant + une petite table mapping `lat/lng → commune` (Libreville, Akanda, Owendo, Ntoum). Pas d'appel Google Maps payant — règle géographique simple (bounding boxes), extensible plus tard.

#### 2.3 UI client (3 nouvelles routes)

- `src/routes/deplacement-groupe.tsx` — page principale (pickup, destination, estimation tarif live).
- `src/routes/deplacement-groupe.salon.$rideId.tsx` — **salle d'attente** : sièges (2/3), compte-à-rebours animé (framer-motion), ETA, tarif, résumé trajet, bouton annuler, realtime sur `group_rides` + `group_ride_passengers`.
- `src/routes/deplacement-groupe.suivi.$rideId.tsx` — suivi temps réel (réutilise `LiveMap` Leaflet + `useDriverPosition`).

Composant maison :
- `src/components/GroupRideServiceCard.tsx` — bouton home arrondi cohérent avec `ServiceCard` actuel, badges "Économique / Trajet partagé / Prix réduit".
- Intégré dans `src/routes/espace-client.tsx`.

#### 2.4 Chauffeur

- `src/routes/chauffeur.groupes.tsx` — liste des courses groupées `pending`, accept, vue passagers groupés + ordre pickup/dropoff optimisé (tri simple par distance haversine), gains totaux.
- Lien ajouté dans `chauffeur.tsx`.

#### 2.5 Admin

- `src/routes/admin/group-rides.tsx` — corridors (CRUD `group_routes`), monitoring courses actives, taux d'occupation, revenus.
- Lien ajouté dans `AdminSidebar.tsx`.

#### 2.6 Paiement

Réutilise le pipeline `payments` existant : à la confirmation salle d'attente, crée une `reservation` `service_type='VTC'` (ou nouveau type ?) + entrée `group_ride_payments`. Validation admin déclenche `paiement_valide=true` → `group_rides.status='confirmed'`.

> **Question** : voulez-vous un nouveau `service_type` enum `GROUP_RIDE` pour bien isoler dans l'historique, ou réutiliser `VTC` ?

#### 2.7 Notifications

Réutilise `requestNotificationPermission` + `showAppNotification` existants. Triggers : passager rejoint, course confirmée, chauffeur arrive, départ imminent.

---

### Livrables phase par phase

1. **Migration SQL** (5 tables + RLS + realtime publication) — *attente confirmation utilisateur*.
2. Nettoyage `vtc.tsx`.
3. Server functions matching + tarification.
4. Pages client (home button, page principale, salon, suivi).
5. Page chauffeur + admin.
6. Tests manuels : 3 comptes (client × 2, chauffeur, admin), simulation 2/3 → départ après timer, 3/3 → départ immédiat.

### Hors-scope (à confirmer)

- Mapbox (vs Leaflet actuel)
- Réécriture native React Native
- Système de notation passager (mentionné en bonus) — peut être ajouté en phase 2 après validation du flow.

### Confirmations demandées avant exécution

1. Garde-t-on **Leaflet/OSRM** (oui par défaut) ou bascule **Mapbox** (clé requise) ?
2. Nouveau `service_type='GROUP_RIDE'` (recommandé) ou réutiliser `VTC` ?
3. Validation paiement : workflow admin existant (cohérent avec le reste) ou auto-validation wallet ?
