import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bus, ArrowRight, Users, Calendar } from "lucide-react";
import { PricingCard } from "@/components/PricingCard";
import busImg from "@/assets/location-bus.jpg";

export const Route = createFileRoute("/location-bus")({
  head: () => ({
    meta: [
      { title: "Location de Bus — Agence Wina" },
      { name: "description", content: "Louez un bus de 14 à 32 places pour vos événements au Gabon. Standard ou VIP." },
      { property: "og:title", content: "Location de Bus — Agence Wina" },
      { property: "og:description", content: "Location de bus événementiel au Gabon." },
    ],
  }),
  component: LocationBusPage,
});

const BUS_TYPES = [
  { places: 14, label: "Minibus 14 places" },
  { places: 16, label: "Minibus 16 places" },
  { places: 32, label: "Bus 32 places" },
];

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function LocationBusPage() {
  const [busType, setBusType] = useState(32);
  const [duree, setDuree] = useState<"journee" | "demi-journee">("journee");
  const [date, setDate] = useState("");
  const [evenement, setEvenement] = useState("");

  const standardPrice = duree === "journee" ? 180000 : 100000;
  const vipPrice = duree === "journee" ? 250000 : 130000;

  return (
    <>
      <section className="relative h-48 overflow-hidden lg:h-64">
        <img src={busImg} alt="Location de bus" className="h-full w-full object-cover" width={1280} height={720} />
        <div className="absolute inset-0 hero-gradient opacity-80" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
                <Bus className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary-foreground lg:text-3xl">Location de Bus</h1>
                <p className="text-sm text-primary-foreground/80">Pour tous vos événements</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 lg:px-8">
        {/* Config */}
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-bold">Configurez votre location</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Type de bus</label>
              <div className="space-y-2">
                {BUS_TYPES.map((b) => (
                  <button key={b.places} onClick={() => setBusType(b.places)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${busType === b.places ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground hover:bg-secondary"}`}>
                    <Users className="h-4 w-4" /> {b.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Durée</label>
              <div className="space-y-2">
                {([["journee", "Journée complète"], ["demi-journee", "Demi-journée"]] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setDuree(val)} className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors ${duree === val ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground hover:bg-secondary"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Date souhaitée</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Type d'événement</label>
              <select value={evenement} onChange={(e) => setEvenement(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                <option value="">Choisir...</option>
                <option value="mariage">Mariage</option>
                <option value="excursion">Excursion</option>
                <option value="entreprise">Événement d'entreprise</option>
                <option value="autre">Autre</option>
              </select>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <PricingCard
            title="Standard"
            price={formatXAF(standardPrice)}
            unit={duree === "journee" ? "/ journée" : "/ demi-journée"}
            features={[
              `Bus ${busType} places`,
              "Chauffeur professionnel",
              "Climatisation",
              "Assurance incluse",
            ]}
          />
          <PricingCard
            title="VIP"
            price={formatXAF(vipPrice)}
            unit={duree === "journee" ? "/ journée" : "/ demi-journée"}
            highlighted
            features={[
              `Bus VIP ${busType} places`,
              "Chauffeur haut de gamme",
              "WiFi & climatisation premium",
              "Sièges cuir & écrans",
              "Boissons offertes",
            ]}
          />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Paiement de 50% requis à la réservation. Réservation min. 48h à l'avance.
        </p>
      </section>
    </>
  );
}
