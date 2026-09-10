# Comptes de test

Le seeder cree ou met a jour un client et un administrateur de test dans
Supabase Auth, leurs profils et leurs roles. Il est idempotent : une nouvelle
execution reutilise les memes emails et met a jour leurs mots de passe.

Creer un fichier local ignore par Git, par exemple `.env.test-accounts.local` :

```sh
SUPABASE_URL=https://ekpctxfdtuwrkjpsdxyk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=collez_la_service_role_key_ici
SEED_CLIENT_PASSWORD=un_mot_de_passe_test_solide
SEED_ADMIN_PASSWORD=un_autre_mot_de_passe_test_solide
```

Ne jamais mettre la `SUPABASE_SERVICE_ROLE_KEY` dans une variable `VITE_`, dans
Git, ou dans une capture d'ecran.

Puis lancer, depuis la racine du projet :

```sh
set -a
source .env.test-accounts.local
set +a
SEED_CONFIRM=CREATE_WINA_TEST_ACCOUNTS npm run seed:test-accounts
```

Le script affiche les UUIDs du client (`test.client@wina.test`) et de
l'administrateur (`test.admin@wina.test`).
