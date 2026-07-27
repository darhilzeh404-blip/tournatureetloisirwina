## Objectif

Ajouter le parcours client complet de réservation de billets de train (7 étapes), le reçu PDF après paiement, et le suivi/validation côté administrateur — en s'appuyant sur le module Billetterie déjà en place (agences partenaires, billets, paiement, réservations).

## Choix structurant : étendre l'existant plutôt que dupliquer

La liste de tables demandée (`train_agencies`, `train_classes`, `train_reservations`, `train_payments`…) recrée un module parallèle à ce qui existe déjà et fonctionne :

| Demandé | Existant équivalent |
|---|---|
| train_agencies | `partner_agencies` (catégorie « train ») |
| train_types | `train_types` ✅ |
| train_classes | `train_travel_classes` ✅ |
| train_stations | `train_stations` ✅ |
| train_prices | `train_ticket_classes` (prix par classe) ✅ |
| train_reservations | `partner_bookings` ✅ |
| train_payments | `reservations` + `payments` ✅ |

Créer des doublons casserait le paiement, l'espace client et l'admin. On garde donc l'architecture actuelle et on ajoute uniquement ce qui manque.

## 1. Base de données (nouveautés seulement)

- `train_routes` + `train_route_stations` : dessertes par type de train (Express → gares principales, Omnibus → toutes). Administrable.
- `train_baggage_rules` : conditions de transport + frais par bagage, administrables.
- `train_passengers` : voyageur principal d'une réservation (nom, prénom, téléphone, email, âge, type de pièce, URL du document).
- `train_children` : enfants rattachés (nom, prénom, tranche d'âge 4–11 uniquement, contrainte en base).
- Colonnes ajoutées à `partner_bookings` : `baggage_count`, `baggage_fee`, `departure_date`, `station_from_id`, `station_to_id`, `travel_class_id`.
- Statuts de réservation étendus : `pending`, `confirmed`, `ticket_ready`, `delivered`, `cancelled`.
- Bucket privé `train-documents` pour les pièces d'identité, avec accès restreint au propriétaire et aux administrateurs.
- GRANT + RLS sur chaque nouvelle table.

## 2. Espace client — assistant en 7 étapes

Nouvelle page dédiée train (l'ancienne modale de réservation train est remplacée ; les autres catégories de billets restent inchangées) :

1. Agence, type de train, classe, **date de départ uniquement** (aucune heure).
2. Gare de départ / d'arrivée, filtrées par les dessertes du type de train.
3. Voyageur : nom, prénom, téléphone, email + pièce d'identité obligatoire (CNI / passeport / carte de séjour) avec téléversement du document.
4. Bagages Oui/Non → nombre, affichage automatique des conditions et frais issus de la base.
5. Enfants Oui/Non → ajout multiple, tranche d'âge limitée à 4–11 ans.
6. Âge du voyageur principal → réduction Senior automatique de 50 % si ≥ 55 ans.
7. Récapitulatif complet (agence, train, classe, date, départ, arrivée, voyageur, enfants, bagages, réductions, total) avant paiement.

Design WINA TOUR conservé, responsive, données 100 % issues de la base.

## 3. Paiement et message d'attente

Après paiement confirmé : aucun billet définitif immédiat. Message affiché :
« Votre paiement a bien été reçu. Votre billet est en cours de traitement. Veuillez patienter jusqu'à 24 heures pour recevoir votre billet physique. »

## 4. Reçu PDF

Généré automatiquement après paiement : logo WINA TOUR, numéro de réservation, voyageur, agence, type de train, classe, départ, arrivée, date, montant payé, date de paiement, statut « Billet en cours de traitement ».
Téléchargeable depuis l'espace client (Mes réservations). L'envoi automatique par email nécessite la configuration d'un domaine d'envoi — je le proposerai à l'étape correspondante.

## 5. Espace administrateur

Page réservations train : liste complète, filtres, détail voyageur/enfants/bagages/document d'identité, validation du paiement, modification de la réservation, génération du billet définitif et changement de statut (En attente → Confirmé → Billet prêt → Livré / Annulé).
Écrans d'administration des dessertes (routes/gares par type de train) et des règles de bagages.

## Détails techniques

- Migration Supabase unique pour les tables, colonnes, contraintes d'âge, GRANT et politiques RLS.
- PDF généré côté client avec `jspdf` (téléchargement immédiat, aucune dépendance serveur).
- Réutilisation de `src/lib/train.ts` pour les réductions ; ajout des règles bagages et dessertes.
- Aucune valeur codée en dur : types, classes, gares, dessertes, réductions et frais bagages proviennent de la base.
- Vérification finale du parcours client et admin avant livraison.
