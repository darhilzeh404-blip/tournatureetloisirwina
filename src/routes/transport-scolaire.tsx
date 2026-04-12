import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, ArrowRight } from "lucide-react";
import scolaireImg from "@/assets/transport-scolaire.jpg";

export const Route = createFileRoute("/transport-scolaire")({
  head: () => ({
    meta: [
      { title: "Transport Scolaire — Agence Wina" },
      { name: "description", content: "Réservez le transport scolaire pour vos enfants : Akanda-Libreville, Owendo-Libreville. Standard ou VIP." },
      { property: "og:title", content: "Transport Scolaire — Agence Wina" },
      { property: "og:description", content: "Transport scolaire sécurisé au Gabon." },
    ],
  }),
  component: TransportScolairePage,
});

const PRICES = {
  "akanda-libreville": { standard: { ar: 80000, simple: 50000 }, vip: { ar: 150000, simple: 80000 } },
  "owendo-libreville": { standard: { ar: 80000, simple: 50000 }, vip: { ar: 150000, simple: 80000 } },
} as const;

type Route_ = keyof typeof PRICES;
type Classe = "standard" | "vip";
type Abonnement = "aller-simple" | "retour-simple" | "aller-retour";

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function TransportScolairePage() {
  const [itineraire, setItineraire] = useState<Route_>("akanda-libreville");
  const [classe, setClasse] = useState<Classe>("standard");
  const [abonnement, setAbonnement] = useState<Abonnement>("aller-retour");
  const [nbEnfants, setNbEnfants] = useState(1);
  const [age, setAge] = useState("");
  const [niveau, setNiveau] = useState("");

  const priceKey = abonnement === "aller-retour" ? "ar" : "simple";
  const unitPrice = PRICES[itineraire][classe][priceKey];
  const totalPrice = unitPrice * nbEnfants;
  const deposit = Math.ceil(totalPrice * 0.5);

  return (
    <>
      <section className="relative h-48 overflow-hidden lg:h-64">
        <img src={scolaireImg} alt="Transport scolaire" className="h-full w-full object-cover" width={1280} height={720} />
        <div className="absolute inset-0 hero-gradient opacity-80" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
                <GraduationCap className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary-foreground lg:text-3xl">Transport Scolaire</h1>
                <p className="text-sm text-primary-foreground/80">Abonnements mensuels sécurisés</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Form */}
          <div className="space-y-6 lg:col-span-3">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-bold">Formulaire de réservation</h2>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Itinéraire</label>
                  <select value={itineraire} onChange={(e) => setItineraire(e.target.value as Route_)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                    <option value="akanda-libreville">Akanda ↔ Libreville</option>
                    <option value="owendo-libreville">Owendo ↔ Libreville</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Âge de l'enfant</label>
                    <input type="number" min={3} max={18} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Ex: 8" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Niveau scolaire</label>
                    <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                      <option value="">Choisir...</option>
                      <option value="maternelle">Maternelle</option>
                      <option value="primaire">Primaire</option>
                      <option value="college">Collège</option>
                      <option value="lycee">Lycée</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Type d'abonnement</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([["aller-simple", "Aller simple"], ["retour-simple", "Retour simple"], ["aller-retour", "Aller-retour"]] as const).map(([val, label]) => (
                      <button key={val} onClick={() => setAbonnement(val)} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${abonnement === val ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground hover:bg-secondary"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Classe</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([["standard", "Standard"], ["vip", "VIP"]] as const).map(([val, label]) => (
                      <button key={val} onClick={() => setClasse(val)} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${classe === val ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground hover:bg-secondary"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Nombre d'enfants</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setNbEnfants(Math.max(1, nbEnfants - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-sm font-bold hover:bg-secondary">-</button>
                    <span className="text-lg font-bold">{nbEnfants}</span>
                    <button onClick={() => setNbEnfants(Math.min(10, nbEnfants + 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-sm font-bold hover:bg-secondary">+</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-20 rounded-2xl border bg-card p-6">
              <h3 className="text-lg font-bold">Récapitulatif</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Itinéraire</span><span className="font-medium">{itineraire === "akanda-libreville" ? "Akanda ↔ LBV" : "Owendo ↔ LBV"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Classe</span><span className="font-medium capitalize">{classe}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Abonnement</span><span className="font-medium capitalize">{abonnement.replace("-", " ")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Enfants</span><span className="font-medium">{nbEnfants}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Prix unitaire</span><span className="font-medium">{formatXAF(unitPrice)}</span></div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatXAF(totalPrice)}</span></div>
                  <div className="mt-1 flex justify-between text-accent"><span className="text-sm">Acompte (50%)</span><span className="font-semibold">{formatXAF(deposit)}</span></div>
                </div>
              </div>
              <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                Réserver et payer <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Réservation min. 48h avant le début du service
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
