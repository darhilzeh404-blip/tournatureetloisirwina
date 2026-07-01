import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ScrollText } from "lucide-react";

export const Route = createFileRoute("/conditions")({
  head: () => ({
    meta: [
      { title: "Conditions générales d'utilisation — Agence Wina" },
      { name: "description", content: "Conditions générales d'utilisation et de vente de l'application Agence Wina." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ScrollText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Conditions Générales d'Utilisation</h1>
            <p className="text-sm text-muted-foreground">CGU / CGV — En vigueur au 1er juillet 2026</p>
          </div>
        </header>

        <article className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="mb-2 text-lg font-semibold">1. Objet</h2>
            <p>Les présentes conditions régissent l'utilisation de l'application <strong>WINA TOUR</strong> qui met en relation des utilisateurs avec des services de transport (VTC, bus, transport scolaire), des circuits touristiques et des agences partenaires.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">2. Compte utilisateur</h2>
            <p>La création d'un compte est gratuite et requiert des informations exactes. L'utilisateur est responsable de la confidentialité de son mot de passe. Un compte peut être suspendu en cas de fraude ou de non-respect des CGU.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">3. Réservations & paiement</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Les réservations transport nécessitent un préavis minimum de 48h et un paiement intégral à la réservation.</li>
              <li>La confirmation définitive est validée par l'administration.</li>
              <li>Les paiements sont sécurisés via Mobile Money (Airtel/Moov) ou via le portefeuille interne (Wina Wallet).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">4. Annulation & remboursement</h2>
            <p>Une annulation à plus de 48h de la course donne droit à un remboursement intégral. À moins de 48h, aucun remboursement n'est garanti sauf cas de force majeure. Les remboursements sont crédités sur le portefeuille Wina ou par le canal du paiement d'origine.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">5. Comportement des utilisateurs</h2>
            <p>Il est interdit d'utiliser l'Application à des fins illégales, de harceler d'autres utilisateurs, chauffeurs ou agences, ou de fournir de fausses informations. Tout manquement peut entraîner la suspension immédiate du compte.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">6. Programme Wina Coins</h2>
            <p>Les Wina Coins sont des unités de fidélité non convertibles en espèces. Ils sont utilisables selon les modalités précisées dans l'Application et peuvent expirer.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">7. Responsabilité</h2>
            <p>Agence Wina est intermédiaire de mise en relation. Les chauffeurs et agences partenaires assument la responsabilité de la prestation de transport. Agence Wina veille néanmoins à la conformité de ses partenaires.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">8. Données personnelles</h2>
            <p>Le traitement des données est décrit dans la <Link to="/confidentialite" className="text-primary underline">Politique de confidentialité</Link>.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">9. Modification & droit applicable</h2>
            <p>Les CGU peuvent être modifiées à tout moment. Elles sont régies par le droit gabonais.</p>
          </section>
        </article>
      </div>
    </main>
  );
}
