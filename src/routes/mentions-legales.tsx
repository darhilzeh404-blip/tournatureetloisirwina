import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — Agence Wina" },
      { name: "description", content: "Mentions légales de l'application Agence Wina : éditeur, hébergeur, propriété intellectuelle." },
    ],
  }),
  component: LegalPage,
});

function LegalPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mentions légales</h1>
            <p className="text-sm text-muted-foreground">Informations réglementaires</p>
          </div>
        </header>

        <article className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="mb-2 text-lg font-semibold">Éditeur</h2>
            <p>
              <strong>Agence Wina</strong><br />
              Société de transport et tourisme<br />
              Siège social : Libreville, Gabon<br />
              Email : <a className="text-primary underline" href="mailto:contact@agencewina.ga">contact@agencewina.ga</a><br />
              Téléphone : +241 062 766 549<br />
              WhatsApp : +241 077 110 995
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Directeur de la publication</h2>
            <p>Le représentant légal d'Agence Wina.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Hébergement</h2>
            <p>
              L'application et ses services back-end sont hébergés par <strong>Supabase Inc.</strong> (970 Toa Payoh N #07-04, Singapour) et <strong>Cloudflare Inc.</strong> pour la distribution CDN.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Propriété intellectuelle</h2>
            <p>La marque « WINA TOUR », le logo, les visuels, textes, code source, base de données et l'ensemble des contenus de l'Application sont la propriété exclusive d'Agence Wina, protégés par le droit d'auteur et la propriété intellectuelle. Toute reproduction non autorisée est interdite.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Responsabilité</h2>
            <p>Agence Wina met tout en œuvre pour offrir un service fiable. Toutefois, la disponibilité n'est pas garantie 24/7 et l'éditeur ne saurait être tenu responsable des dommages indirects liés à l'utilisation de l'Application.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Loi applicable</h2>
            <p>Les présentes mentions sont soumises au droit gabonais. Tout litige relève des juridictions compétentes de Libreville.</p>
          </section>
        </article>
      </div>
    </main>
  );
}
