import { createFileRoute } from "@tanstack/react-router";
import { PartyPopper } from "lucide-react";
import { TransportBookingForm } from "@/components/TransportBookingForm";
import { ClientNav } from "@/components/ClientNav";

export const Route = createFileRoute("/location-bus")({
  head: () => ({
    meta: [
      { title: "Location de Bus Événementiel — Agence Wina" },
      { name: "description", content: "Mariages, excursions, transport urbain. Bus 14, 16 ou 32 places. Devis instantané." },
      { property: "og:title", content: "Location de Bus — Agence Wina" },
      { property: "og:description", content: "Bus pour mariages, excursions et événements." },
    ],
  }),
  component: LocationBusPage,
});

function LocationBusPage() {
  return (
    <div className="pb-24">
      <section className="hero-gradient px-5 pb-6 pt-8 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
              <PartyPopper className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground lg:text-2xl">Événementiel</h1>
              <p className="text-sm text-primary-foreground/80">Mariage, excursion, urbain — 14/16/32 places</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 pt-6 lg:px-10">
        <TransportBookingForm
          categorySlug="evenementiel"
          serviceType="LOCATION_BUS"
          showAcOption
          showPackages
        />
      </div>

      <ClientNav />
    </div>
  );
}
