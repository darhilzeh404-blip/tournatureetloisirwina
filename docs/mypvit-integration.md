# Intégration paiement MyPVit

MyPVit est **l'unique agrégateur** de paiement Mobile Money utilisé par
l'application Wina (Airtel Money + Moov Money, Gabon). L'ancienne intégration
PawaPay a été retirée du code, des composants, des routes et de la base de
données.

## Flux paiement

1. **Initiation** — Le client saisit son numéro et choisit Airtel/Moov dans
   `MyPvitCheckout`. Le front appelle `POST /api/pvit/initiate` avec le token
   Supabase de l'utilisateur.
2. **Push USSD** — Le backend appelle MyPVit
   (`POST {PVIT_BASE_URL}/{PVIT_CODE_URL}/link` avec `service: "RESTLINK"`).
   MyPVit déclenche un push USSD sur le téléphone du client.
3. **Polling** — Le front interroge `GET /api/pvit/status/:transactionId`
   toutes les 3 s (max 3 min). Le backend consulte MyPVit et met à jour la
   ligne `pvit_transactions`.
4. **Callback** — MyPVit appelle `POST /api/public/pvit/callback` (public,
   secret partagé optionnel via `PVIT_CALLBACK_SECRET`). Le backend
   re-vérifie le statut auprès de MyPVit avant d'appliquer la mise à jour
   (jamais de confiance aveugle au payload).
5. **Mise à jour DB** — En cas de succès, `apply_pvit_completion` marque :
   - `reservations` → `CONFIRMED` + `paid_amount`
   - `vtc_wallets` → recharge créditée + trace dans `vtc_wallet_transactions`
   - `partner_bookings` → `confirmed` + `payment_status = paid`

En cas d'échec / expiration, `apply_pvit_failure` enregistre la raison sans
altérer la ressource métier.

## Secrets requis

À enregistrer via l'écran secrets de Lovable Cloud :

| Nom | Description |
|---|---|
| `PVIT_API_TOKEN` | Clé API MyPVit (Bearer + `x-api-key`). |
| `PVIT_CODE_URL` | Code URL marchand fourni par MyPVit (utilisé dans `/{codeUrl}/link`). |
| `PVIT_BASE_URL` | Optionnel. Défaut : `https://api.mypvit.pro`. |
| `PVIT_CALLBACK_URL` | Optionnel. Défaut : `{origin}/api/public/pvit/callback`. |
| `PVIT_CALLBACK_SECRET` | Optionnel. Si présent, le callback exige l'en-tête `x-pvit-secret`. |

## URL de callback à déclarer dans le dashboard MyPVit

```
https://tournatureetloisirwina.lovable.app/api/public/pvit/callback
```

## Table `pvit_transactions`

Trace toutes les transactions (référence interne, opérateur, montant, purpose,
statut, réponse d'initiation et payload de callback). RLS : chaque utilisateur
voit ses transactions, l'admin voit tout.

## Fichiers de l'intégration

- `src/components/MyPvitCheckout.tsx` — composant UI réutilisable.
- `src/routes/api/pvit.initiate.ts` — initiation (RESTLINK).
- `src/routes/api/pvit.status.$transactionId.ts` — polling autoritatif.
- `src/routes/api/public/pvit.callback.ts` — webhook MyPVit.
- Migrations Supabase : `pvit_transactions`, `apply_pvit_completion`,
  `apply_pvit_failure`.
