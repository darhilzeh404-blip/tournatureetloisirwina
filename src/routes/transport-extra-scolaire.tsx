import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { TransportBookingForm } from "@/components/TransportBookingForm";
import { ClientNav } from "@/components/ClientNav";

export const Route = createFileRoute("/transport-extra-scolaire")({
  head: () => ({
    meta: [
      { title: "Transport Extra-scolaire & Activités — Agence Wina" },
      { name: "description", content: "Transport + activités éducatives à la carte ou en forfait packagé." },
      { property: "og:title", content: "Extra-scolaire — Agence Wina" },
      { property: "og:description", content: "Transport et activités éducatives pour vos enfants." },
    ],
  }),
  component: ExtraScolairePage,
});

function ExtraScolairePage() {
  return (
    <div className="pb-24">
      <section className="hero-gradient px-5 pb-6 pt-8 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground lg:text-2xl">Extra-scolaire & Activités</h1>
              <p className="text-sm text-primary-foreground/80">Forfaits packagés ou activités à la carte</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 pt-6 lg:px-10">
        <TransportBookingForm
          categorySlug="extra-scolaire"
          serviceType="CIRCUIT_TOURISTIQUE"
          showActivities
          showPackages
        />
      </div>

      <ClientNav />
    </div>
  );
}
