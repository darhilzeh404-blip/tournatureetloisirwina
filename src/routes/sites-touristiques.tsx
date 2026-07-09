import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, ArrowLeft, Sparkles } from "lucide-react";
import { ClientNav } from "@/components/ClientNav";

export const Route = createFileRoute("/sites-touristiques")({
  head: () => ({
    meta: [
      { title: "Sites touristiques — Agence Wina" },
      {
        name: "description",
        content:
          "Découvrez bientôt tous les sites touristiques incontournables du Gabon avec Agence Wina.",
      },
      { property: "og:title", content: "Sites touristiques — Agence Wina" },
      {
        property: "og:description",
        content: "Découvrez bientôt tous les sites touristiques du Gabon.",
      },
    ],
  }),
  component: SitesTouristiquesPage,
});

function SitesTouristiquesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 via-background to-background pb-24">
      <header className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-primary via-primary to-primary/85 px-5 pb-8 pt-8 shadow-lg shadow-primary/20">
        <Link
          to="/espace-client"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-foreground/80 hover:text-primary-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15 ring-1 ring-primary-foreground/25 backdrop-blur-md">
            <MapPin className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/75">
              Explorez le Gabon
            </p>
            <h1 className="text-xl font-extrabold text-primary-foreground">
              Sites touristiques
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-4 max-w-2xl px-5">
        <section className="rounded-3xl border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold">Bientôt disponible</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Nous préparons une sélection complète des sites touristiques
            incontournables du Gabon, avec photos, descriptions détaillées et
            tarifs. Cette section sera disponible très prochainement.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              to="/circuits"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Voir les circuits touristiques
            </Link>
            <Link
              to="/espace-client"
              className="inline-flex items-center justify-center rounded-xl border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              Retour à l'accueil
            </Link>
          </div>
        </section>
      </main>

      <ClientNav />
    </div>
  );
}
