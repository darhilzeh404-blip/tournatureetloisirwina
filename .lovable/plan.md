# Système Wina Coins — Plan d'implémentation

Système de fidélité premium intégré à Wina : les clients gagnent des coins quand l'admin valide leur paiement, progressent dans des niveaux VIP (Silver → Diamond+), et utilisent les coins comme réduction sur leurs prochaines réservations.

## 1. Base de données (migration unique)

### Nouvelles tables

**`vip_levels`** (table de référence, seedée)
- `id`, `level_name` (Silver/Gold/Platinum/Diamond/Diamond+)
- `min_coins`, `bonus_percentage`, `badge_icon`, `benefits` (jsonb), `sort_order`

Seuils proposés : Silver 0 / Gold 500 / Platinum 2000 / Diamond 5000 / Diamond+ 12000.

**`wina_coins_history`**
- `id`, `user_id`, `reservation_id` (nullable), `reservation_type`
- `amount_paid`, `coins_earned`, `bonus_percentage`
- `operation_type` (`earn` | `spend` | `refund` | `admin_adjust`)
- `status` (`completed` | `cancelled`), `note`, `created_at`
- Contrainte unique `(reservation_id, operation_type)` pour empêcher double récompense

**`wina_coin_balances`** (1 ligne / user, simple à interroger)
- `user_id` (PK), `coins_balance`, `total_coins_earned`, `total_reservations`
- `vip_level_id`, `updated_at`

### Ajouts sur `reservations`
- `coins_used` int default 0 — coins dépensés en réduction sur cette réservation
- `coins_awarded` boolean default false — anti double-récompense

### Fonctions SQL (security definer)

- `award_wina_coins(_reservation_id uuid)` : appelée à la validation admin. Idempotente (vérifie `coins_awarded`). Calcule coins selon montant payé net (total_amount − coins_used×1), applique bonus VIP, insère history, met à jour balance, recalcule `vip_level_id`.
- `refund_wina_coins(_reservation_id uuid)` : si réservation annulée après validation, retire les coins gagnés + restaure les coins dépensés.
- `spend_wina_coins(_reservation_id uuid, _amount int)` : utilisé côté client à la création de la réservation. Vérifie solde, débite, insère history `spend`.
- `recompute_vip_level(_user_id uuid)` : recalcule le palier depuis `total_coins_earned`.

### RLS / GRANT
- `vip_levels` : lecture publique, écriture admin
- `wina_coins_history` : SELECT propre user + admin ; INSERT via fonctions definer
- `wina_coin_balances` : SELECT propre user + admin ; UPDATE via fonctions

## 2. Hook validation admin

Dans `src/routes/admin/paiements.tsx` (ou la fonction serveur correspondante) : après le passage d'un paiement à `VALIDATED` et de la réservation à `CONFIRMED`, appeler `supabase.rpc('award_wina_coins', { _reservation_id })`. Idem pour `refund_wina_coins` en cas d'annulation après validation.

Même branchement pour `group_ride_payments` (validation admin du covoiturage).

## 3. UI client

### Page premium `/wina-coins` (`src/routes/wina-coins.tsx`)
- Header : carte solde avec gradient bleu royal → noir, badge VIP courant, animation pièces
- Barre de progression vers le palier suivant + nombre de coins manquants
- Avantages du niveau actuel (liste depuis `vip_levels.benefits`)
- Tabs : Historique des gains / Utilisations / Économies totales
- Mobile-first, glassmorphism léger, accents silver/gold/platinum/diamond selon niveau

### Composants partagés (`src/components/wina-coins/`)
- `CoinsBalanceCard.tsx` — carte solde réutilisable
- `VipBadge.tsx` — badge SVG/icône stylisé par niveau
- `CoinsGainToast.tsx` — popup animé "+X coins"
- `UseCoinsToggle.tsx` — switch dans le flux de paiement pour appliquer la réduction

### Intégration paiement
Dans `src/routes/paiement.$reservationId.tsx` : afficher solde, toggle "utiliser mes coins" (max = min(solde, total)), recalculer montant final, appeler `spend_wina_coins` à la confirmation.

### Lien navigation
Ajouter "Wina Coins" dans `ClientNav` + `mon-compte.tsx`.

### Notification gain
À l'ouverture de l'app, vérifier les nouveaux gains depuis la dernière visite (subscribe realtime sur `wina_coins_history` filtré user) → toast premium.

## 4. Dashboard admin

Nouvelle route `src/routes/admin/fidelite.tsx` :
- Stats globales : total coins en circulation, coins dépensés, top utilisateurs
- Recherche utilisateur → historique complet, ajustement manuel (+/−), changement niveau forcé
- Gestion des paliers `vip_levels` (CRUD)

Lien dans `AdminSidebar.tsx`.

## 5. Anti-fraude
- Contrainte unique sur `(reservation_id, 'earn')` dans l'historique
- `coins_awarded` flag sur réservation
- Toutes les mutations passent par fonctions `SECURITY DEFINER` avec validation `auth.uid()`
- Ajustements manuels admin loggés avec `note` obligatoire

## Design tokens (ajouts `src/styles.css`)
```
--wina-royal-blue, --wina-deep-black, --wina-silver, --wina-gold,
--wina-platinum, --wina-diamond, --gradient-vip-{level},
--shadow-coin-glow
```

## Fichiers

**Créés**
- migration SQL (tables + fonctions + seed vip_levels)
- `src/routes/wina-coins.tsx`
- `src/routes/admin/fidelite.tsx`
- `src/components/wina-coins/CoinsBalanceCard.tsx`
- `src/components/wina-coins/VipBadge.tsx`
- `src/components/wina-coins/CoinsGainToast.tsx`
- `src/components/wina-coins/UseCoinsToggle.tsx`
- `src/lib/wina-coins.ts` (helpers : fetch balance, format, calcul niveau)

**Édités**
- `src/routes/admin/paiements.tsx` — appel `award_wina_coins` à la validation
- `src/routes/admin/group-rides.tsx` — idem covoiturage
- `src/routes/paiement.$reservationId.tsx` — toggle utilisation coins
- `src/components/ClientNav.tsx` + `src/components/AdminSidebar.tsx` — liens
- `src/styles.css` — tokens premium
- `src/routes/mon-compte.tsx` — carte mini solde + lien

## Hors scope (à confirmer plus tard)
- Tirages / tombolas Gold/Diamond/Diamond+ : nécessitent un module séparé (gestion lots, tirages, gagnants). Le plan actuel pose les bases (niveau, bonus, accès) mais n'implémente pas la mécanique de tombola.
- Notifications push réelles (utilise toast + realtime in-app pour cette version).
