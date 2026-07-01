import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield } from "lucide-react";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Agence Wina" },
      { name: "description", content: "Politique de confidentialité de l'application Agence Wina : données collectées, finalités, conservation, droits des utilisateurs." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Politique de confidentialité</h1>
            <p className="text-sm text-muted-foreground">Dernière mise à jour : 1er juillet 2026</p>
          </div>
        </header>

        <article className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="mb-2 text-lg font-semibold">1. Éditeur de l'application</h2>
            <p>
              L'application <strong>WINA TOUR</strong> (ci-après « l'Application ») est éditée par <strong>Agence Wina</strong>,
              société de transport et de tourisme immatriculée à Libreville, Gabon. Contact :{" "}
              <a className="text-primary underline" href="mailto:contact@agencewina.ga">contact@agencewina.ga</a>.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">2. Données que nous collectons</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Identité & compte</strong> : nom, prénom, email, numéro de téléphone, mot de passe (chiffré).</li>
              <li><strong>Réservations</strong> : trajets, dates, passagers, moyens de paiement (via prestataires Mobile Money).</li>
              <li><strong>Localisation</strong> : position GPS en temps réel (uniquement lorsque vous utilisez le VTC, le suivi de trajet ou le déplacement en groupe, et uniquement pendant la course).</li>
              <li><strong>Appareil</strong> : type d'appareil, système d'exploitation, identifiants techniques, logs de connexion.</li>
              <li><strong>Photos</strong> : profil et pièces justificatives chauffeurs (upload volontaire).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">3. Finalités du traitement</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Créer et gérer votre compte utilisateur.</li>
              <li>Traiter vos réservations, paiements et émettre vos billets/QR codes.</li>
              <li>Assurer le suivi GPS des trajets pour votre sécurité.</li>
              <li>Vous notifier des mises à jour de vos courses et promotions.</li>
              <li>Assurer le support client et prévenir la fraude.</li>
              <li>Respecter nos obligations légales et comptables.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">4. Base légale</h2>
            <p>Nous traitons vos données sur la base : (i) de l'exécution du contrat de transport, (ii) de votre consentement explicite (localisation, notifications), (iii) de nos obligations légales, (iv) de notre intérêt légitime (sécurité, prévention de la fraude).</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">5. Autorisations de l'application</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Localisation (précise)</strong> : nécessaire pour le VTC et le suivi de trajet. Vous pouvez la refuser dans les réglages ; certaines fonctionnalités seront alors indisponibles.</li>
              <li><strong>Appareil photo / Galerie</strong> : pour uploader une photo de profil ou vos documents.</li>
              <li><strong>Notifications</strong> : pour vous informer de vos réservations.</li>
              <li><strong>Internet</strong> : requis pour toutes les fonctionnalités.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">6. Partage des données</h2>
            <p>Vos données ne sont jamais vendues. Elles sont partagées uniquement avec :</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Nos <strong>chauffeurs et agences partenaires</strong> (strictement nécessaires à votre course/billet).</li>
              <li>Nos <strong>sous-traitants techniques</strong> : Supabase (hébergement/base de données, UE), prestataires Mobile Money (Airtel Money, Moov Money).</li>
              <li>Les <strong>autorités</strong> sur réquisition légale.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">7. Conservation</h2>
            <p>Compte actif : durée d'utilisation. Après suppression du compte : 3 ans pour les données de facturation (obligation légale), puis anonymisation. Localisation en temps réel : non conservée après la fin de la course.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">8. Vos droits</h2>
            <p>Vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité, de limitation et d'opposition au traitement de vos données. Exercez vos droits à :{" "}
              <a className="text-primary underline" href="mailto:contact@agencewina.ga">contact@agencewina.ga</a>. Vous pouvez également supprimer votre compte directement depuis l'application (Mon compte → Supprimer mon compte).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">9. Sécurité</h2>
            <p>Les données sont chiffrées en transit (HTTPS/TLS) et au repos. L'accès est protégé par authentification et Row-Level Security. Les mots de passe sont hachés.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">10. Enfants</h2>
            <p>L'Application n'est pas destinée aux enfants de moins de 13 ans. Le transport scolaire est réservé aux parents/tuteurs.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">11. Modifications</h2>
            <p>Toute modification substantielle sera notifiée dans l'application. La version en vigueur est celle publiée sur cette page.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">12. Contact</h2>
            <p>Agence Wina — Libreville, Gabon<br />Email : <a className="text-primary underline" href="mailto:contact@agencewina.ga">contact@agencewina.ga</a><br />Téléphone : +241 062 766 549</p>
          </section>
        </article>
      </div>
    </main>
  );
}
