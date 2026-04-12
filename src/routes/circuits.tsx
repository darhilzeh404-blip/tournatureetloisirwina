import { createFileRoute } from "@tanstack/react-router";
import { Globe, MapPin, TreePine, Waves, Mountain, ArrowRight } from "lucide-react";
import circuitsImg from "@/assets/circuits-hero.jpg";

export const Route = createFileRoute("/circuits")({
  head: () => ({
    meta: [
      { title: "Circuits Touristiques — Agence Wina" },
      { name: "description", content: "Explorez le Gabon : parcs nationaux, plages paradisiaques, chutes et réserves naturelles." },
      { property: "og:title", content: "Circuits Touristiques — Agence Wina" },
      { property: "og:description", content: "Circuits et excursions touristiques au Gabon." },
    ],
  }),
  component: CircuitsPage,
});

const CIRCUITS = [
  { name: "Parc national d'Akanda", location: "Estuaire", activities: ["Safari", "Observation d'oiseaux", "Randonnée"], price: 75000, icon: <TreePine className="h-5 w-5" /> },
  { name: "Parc national de Pongara", location: "Estuaire", activities: ["Plage", "Tortues marines", "Baignade"], price: 85000, icon: <Waves className="h-5 w-5" /> },
  { name: "Réserve de Wonga Wongué", location: "Ogooué-Maritime", activities: ["Safari", "Faune sauvage", "Camping"], price: 120000, icon: <TreePine className="h-5 w-5" /> },
  { name: "Chutes de Meyang", location: "Woleu-Ntem", activities: ["Randonnée", "Baignade", "Culture locale"], price: 95000, icon: <Mountain className="h-5 w-5" /> },
  { name: "Cocobeach", location: "Estuaire", activities: ["Plage", "Baignade", "Buffet"], price: 65000, icon: <Waves className="h-5 w-5" /> },
  { name: "Baie de la Mondah", location: "Estuaire", activities: ["Excursion maritime", "Pique-nique", "Baignade"], price: 55000, icon: <Waves className="h-5 w-5" /> },
  { name: "Arboretum Raponda Walker", location: "Estuaire", activities: ["Randonnée", "Botanique", "Culture"], price: 45000, icon: <TreePine className="h-5 w-5" /> },
];

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function CircuitsPage() {
  return (
    <>
      <section className="relative h-48 overflow-hidden lg:h-64">
        <img src={circuitsImg} alt="Circuits touristiques" className="h-full w-full object-cover" width={1280} height={720} />
        <div className="absolute inset-0 hero-gradient opacity-80" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
                <Globe className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary-foreground lg:text-3xl">Circuits Touristiques</h1>
                <p className="text-sm text-primary-foreground/80">Découvrez les merveilles du Gabon</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CIRCUITS.map((circuit) => (
            <div key={circuit.name} className="card-hover overflow-hidden rounded-2xl border bg-card">
              <div className="flex items-center gap-3 border-b p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {circuit.icon}
                </div>
                <div>
                  <h3 className="font-bold text-card-foreground">{circuit.name}</h3>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {circuit.location}
                  </p>
                </div>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-1.5">
                  {circuit.activities.map((a) => (
                    <span key={a} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">{a}</span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Inclus : transport, activités, buffet (si applicable)</p>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground">À partir de</span>
                    <p className="text-lg font-bold text-foreground">{formatXAF(circuit.price)}</p>
                  </div>
                  <button className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                    Réserver <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Paiement de 50% requis à la réservation. Réservation min. 48h à l'avance.
        </p>
      </section>
    </>
  );
}
