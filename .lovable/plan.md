## Section "Billets" — 5 catégories + portail agences partenaires

### 1. Base de données (migration)

Nouvelles tables :

- **`ticket_categories`** (table fixe, seedée) — `slug` (bus|train|avion|bateau|evenement), `name`, `icon`, `sort_order`. Sert de référentiel pour le matching automatique.
- **`partner_agencies`** — `id`, `owner_user_id` (uuid, agence connectée), `name`, `phone`, `email`, `logo_url`, `is_verified`, `created_at`. Une agence = un utilisateur avec le rôle `agence`.
- **`partner_tickets`** — `id`, `agency_id` (FK), `category_id` (FK → ticket_categories, c'est le matching), `title`, `origin`, `destination`, `departure_at` (timestamp, nullable pour événements), `price` (int FCFA), `seats_available` (int), `description`, `image_url`, `is_active`, timestamps.

Ajout du rôle dans l'enum existant `app_role` : `'agence'`.

RLS :
- `ticket_categories` : lecture publique, écriture admin uniquement.
- `partner_agencies` : agence voit/édite la sienne (`owner_user_id = auth.uid()`), admin full, lecture publique des champs vitrine.
- `partner_tickets` : lecture publique des `is_active=true`, l'agence CRUD ses propres billets, admin full.

Matching automatique = simple FK `category_id` choisie au moment de la création (formulaire avec select sur les 5 catégories). Pas de NLP — le type est explicite.

### 2. Routes & pages

**Côté client (public) :**
- `/billets` : refonte. Affiche les 5 catégories en tuiles avec icônes (Bus, Train, Plane, Ship, PartyPopper). Compteur de billets disponibles par catégorie. Conserve la liste actuelle `tickets` (billets internes Wina) dans une section "Billets Wina" en bas pour ne rien casser.
- `/billets/categorie/$slug` : liste filtrée d'une catégorie. Filtres : agence (dropdown), prix (min/max), date départ. Chaque carte montre agence + logo, trajet/événement, date, prix, places.

**Portail agences partenaires :**
- `/agence` (layout pour role=agence, redirige `/connexion` si pas connecté, `/` si rôle ≠ agence).
- `/agence/index` : dashboard agence (mes billets, mes ventes, profil agence).
- `/agence/billets` : liste de mes billets + bouton "Nouveau billet".
- `/agence/billets/nouveau` : formulaire (type, titre, départ/arrivée, date, prix, places, description, image). Validation Zod côté client.
- `/agence/profil` : édition fiche agence.

**Côté admin :**
- `/admin/agences` : liste + activation/vérification des agences partenaires, attribution du rôle.

### 3. Composants

- `TicketCategoryIcon` : map slug → icône lucide (`Bus`, `TrainFront`, `Plane`, `Ship`, `PartyPopper`).
- `PartnerTicketCard` : carte billet réutilisée (liste + détail).
- `PartnerTicketForm` : formulaire création/édition avec validation Zod.

### 4. Navigation & UX

- Ajout de l'entrée "Espace agence" dans le header quand `role=agence`.
- Page `/billets` met les 5 icônes en avant comme entrée principale.
- Filtres en haut de chaque catégorie (debounced, URL synced).

### 5. Détails techniques (section non lue par défaut côté user)

- Pas de Edge Function — toutes les écritures passent par le client Supabase avec RLS.
- L'image agence/billet utilise un nouveau bucket public `partner-tickets`.
- Le hook `useAuth` est étendu pour exposer le rôle `agence` (déjà géré par `user_roles`).
- Le matching n'utilise pas d'IA : `category_id` est choisi dans le formulaire et la FK garantit la cohérence. L'icône en front lit `category.slug`.
- Achat / réservation des billets partenaires : hors scope de ce plan (à demander explicitement). Pour l'instant : bouton "Contacter l'agence" (tel/email) ou "Voir détails".

### Ordre d'implémentation

1. Migration DB (tables + rôle `agence` + RLS + seed des 5 catégories + bucket storage).
2. Page `/billets` refondue avec 5 catégories.
3. Page `/billets/categorie/$slug` + filtres.
4. Portail `/agence/*` (layout + CRUD billets + profil).
5. Page admin `/admin/agences`.
6. Header : entrée "Espace agence" conditionnelle.