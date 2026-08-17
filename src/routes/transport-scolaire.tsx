import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";

import { ClientNav } from "@/components/ClientNav";
import { SchoolRoutesList } from "@/components/SchoolRoutesList";

export const Route = createFileRoute("/transport-scolaire")({
  head: () => ({
    meta: [
      { title: "Transport Scolaire & Particulier — Agence Wina" },
      { name: "description", content: "Réservez le transport scolaire au Gabon. Tarifs dynamiques, devis instantané, paiement sécurisé." },
      { property: "og:title", content: "Transport Scolaire — Agence Wina" },
      { property: "og:description", content: "Transport scolaire & particulier sécurisé." },
    ],
  }),
  component: TransportScolairePage,
});

function TransportScolairePage() {
  return (
    <div className="pb-24">
      <section className="hero-gradient px-5 pb-6 pt-8 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground lg:text-2xl">Transport Scolaire & Particulier</h1>
              <p className="text-sm text-primary-foreground/80">Devis instantané — Réservation 48h à l'avance</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-8 px-5 pt-6 lg:px-10">
        <SchoolRoutesList />
      </div>


      <ClientNav />
    </div>
  );
}
