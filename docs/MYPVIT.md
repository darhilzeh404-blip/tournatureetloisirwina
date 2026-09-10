# Configuration MyPVit

Le code prend en charge Airtel Money et Moov Money pour les reservations et les
recharges du portefeuille. Les courses VTC conservent leur reglement par portefeuille.
Les virements et especes conservent leur validation manuelle.

## 1. Console MyPVit

Dans le compte de test, puis dans le compte de production :

- **Comptes** : relever le code du compte d'operation `ACC_...`.
- **APIs / Renew Secret Key V2** : relever le code URL et definir le mot de passe.
- **APIs / Payment REST V2** : relever le code URL du paiement.
- **APIs / CHECK STATUS** : relever le code URL de verification.
- **URLs / Callback** : enregistrer cette URL publique avec reception POST JSON :
  `https://ekpctxfdtuwrkjpsdxyk.supabase.co/functions/v1/mypvit-callback`.
  Relever le code genere dans `MYPVIT_CALLBACK_URL_CODE`.
- Activer les operateurs voulus et verifier leurs codes exacts : les exemples de test
  utilisent `AIRTEL_MONEY` / `MOOV_MONEY`; certains comptes utilisent `GAB_AIRTEL` /
  `GAB_MOOV`. Reporter les codes du compte dans les deux variables d'operateur.
- Choisir le porteur des frais MyPVit et operateur : `CUSTOMER` ou `MERCHANT`.

Les anciens codes marchands manuels BGG94 / TRANSPORT ne sont pas des codes API.
Le endpoint REST et le renouvellement utilisent `/v2`; CHECK STATUS utilise la
racine `https://api.mypvit.pro`.

## 2. Secrets Supabase

Renseigner les variables de `supabase/mypvit.env.example` dans **Edge Functions /
Secrets**, ou dans `supabase/mypvit.env.local` pour l'import CLI. Le fichier `.local`
est ignore par Git. Aucun secret MyPVit ne doit avoir le prefixe `VITE_`.

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement aux
fonctions hebergees. Le frontend garde sa configuration Supabase habituelle.
La cle `X-Secret` est obtenue et renouvelee automatiquement; elle est partagee dans
une table inaccessible aux utilisateurs. Ne pas la renseigner dans le frontend.

Generer aussi un `MYPVIT_RECONCILE_TOKEN` aleatoire (par exemple
`openssl rand -hex 32`). Ce token sert uniquement a la verification periodique.

## 3. Deploiement

Avec le CLI Supabase connecte au bon compte :

```sh
supabase link --project-ref ekpctxfdtuwrkjpsdxyk
supabase db push --dry-run
supabase db push
supabase secrets set --env-file supabase/mypvit.env.local
supabase functions deploy mypvit-payment --project-ref ekpctxfdtuwrkjpsdxyk
supabase functions deploy mypvit-callback --project-ref ekpctxfdtuwrkjpsdxyk
supabase functions deploy mypvit-reconcile --project-ref ekpctxfdtuwrkjpsdxyk
npm run build
```

Verifier le dry-run : cette integration ajoute uniquement la migration
`20260908120000_mypvit_payments.sql`. Si d'autres migrations sont en attente,
verifier leur deploiement selon l'etat de la base existante.

Publier ensuite le frontend avec le processus habituel. Le fichier `config.toml`
desactive la verification JWT de passerelle pour ces trois fonctions :
`mypvit-payment` verifie elle-meme la session utilisateur, `mypvit-callback`
verifie la transaction aupres de MyPVit, et `mypvit-reconcile` exige son token prive.

## 4. Verification automatique sans navigateur ouvert

Dans Supabase, activer les extensions **pg_cron** et **pg_net**. Dans **Vault**,
creer deux secrets :

| Nom Vault | Valeur |
| --- | --- |
| `mypvit_project_url` | `https://ekpctxfdtuwrkjpsdxyk.supabase.co` |
| `mypvit_reconcile_token` | Meme valeur que `MYPVIT_RECONCILE_TOKEN` |

Executer `supabase/mypvit-cron.sql` dans SQL Editor. Le job verifie les paiements
encore en attente apres trois minutes. Surveiller ses executions et les logs de
`mypvit-reconcile` en cas d'erreur de configuration.

## 5. Recette avant production

- Utiliser exclusivement le compte de simulation MyPVit pour les essais.
- Tester deux succes avec des montants inferieurs a 1 000 XAF (ex. recharge 500 / 600).
- Tester deux echecs avec des montants superieurs a 1 000 XAF (ex. 1 500 / 2 000).
- Verifier les deux operateurs autorises par le compte.
- Verifier une reservation : paiement `VALIDATED`, montant paye mis a jour,
  reservation confirmee et synchronisation des billets existante.
- Verifier une recharge : credit et ligne de portefeuille uniques; demande de
  recharge deja approuvee dans l'administration.
- Recharger la page pendant un paiement : reprise du suivi, aucune nouvelle demande.
- Rejouer un callback : aucune double validation ni double credit.
- Fermer le navigateur : le callback ou le job doit finaliser le paiement.
- Verifier dans MyPVit l'accuse de reception dynamique : `transactionId` recu et
  `responseCode` egal au champ `code` recu.
- Apres recette, remplacer tous les codes/secrets par ceux du compte de production.
  Ne pas changer de compte tant que des transactions de test sont en attente.

## Exploitation

`mypvit_transactions` est le journal technique accessible avec le service role / SQL
Editor. Ne jamais forcer un succes depuis le frontend. Une notification non signee
ne suffit pas : le serveur compare reference, compte marchand, montant, operateur
et numero avec la reponse authentifiee de CHECK STATUS.

Une coupure apres l'envoi du debit reste **PENDING**, pas FAILED. Le serveur ne
renvoie pas automatiquement le debit. Si la reponse initiale et le callback sont
tous deux perdus, `provider_id` peut manquer : retrouver la transaction dans la
console MyPVit a partir de `reference`, puis renseigner son identifiant dans
`provider_id` via SQL Editor pour permettre la verification automatique. Ne pas
marquer arbitrairement cette transaction en echec ou en succes.

Les paiements MyPVit sont geres par le serveur. Les modifications manuelles d'un
paiement MyPVit et les autres reglements d'une reservation avec debit en cours sont
bloques en base pour eviter un double encaissement.

## Tests locaux

```sh
npm test -- tests/mypvit-protocol.test.ts tests/mypvit-checkout.test.tsx
deno check supabase/functions/mypvit-payment/index.ts supabase/functions/mypvit-callback/index.ts supabase/functions/mypvit-reconcile/index.ts
deno test supabase/functions/_shared/mypvit_test.ts
E2E_BASE_URL=http://127.0.0.1:8081 npx playwright test tests/e2e/mypvit.spec.ts
```

Le test PostgreSQL isole utilise PGlite sans connexion distante :

```sh
npm install --prefix /tmp/wina-mypvit-validation --no-package-lock @electric-sql/pglite
MYPVIT_PGLITE_PATH=/tmp/wina-mypvit-validation/node_modules/@electric-sql/pglite/dist/index.js node --test tests/mypvit-database.test.mjs
```

Il execute la nouvelle migration sur un schema de test representant les tables
utilisees; la recette sur le compte test reste necessaire pour valider l'ensemble
des migrations historiques et la communication reelle avec MyPVit.

Sources : [Paiement MyPVit](https://docs.mypvit.pro/fr/api/payment),
[Statut MyPVit](https://docs.mypvit.pro/fr/api/status),
[Planification Supabase](https://supabase.com/docs/guides/functions/schedule-functions).
