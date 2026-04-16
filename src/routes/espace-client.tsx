import { createFileRoute, Link } from "@tanstack/react-router";
import { Bus, Palmtree, ArrowRight, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ClientNav } from "@/components/ClientNav";
import { DESTINATIONS, formatFCFA } from "@/lib/destinations";
import heroImg from "@/assets/client-hero.jpg";

export const Route = createFileRoute("/espace-client")({
  head: () => ({
    meta: [
      { title: "Mon Espace — Agence Wina" },
      { name: "description", content: "Votre tableau de bord voyage : réservez transport et activités au Gabon." },
    ],
  }),
  component: EspaceClient,
});

function EspaceClient() {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Voyageur";

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="Transport Libreville" className="h-full w-full object-cover" width={1200} height={600} />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/40 to-transparent" />
        </div>
        <div className="relative px-5 pb-8 pt-12">
          <p className="text-sm font-medium text-primary-foreground/80">Bonjour 👋</p>
          <h1 className="mt-1 text-2xl font-bold text-primary-foreground">{firstName}, où allez-vous ?</h1>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link
              to="/reserver-transport"
              className="flex items-center gap-3 rounded-2xl bg-primary/90 px-4 py-4 text-primary-foreground backdrop-blur-sm transition-transform active:scale-[0.97]"
            >
              <Bus className="h-6 w-6 shrink-0" />
              <div>
                <div className="text-sm font-bold">Transport</div>
                <div className="text-[10px] opacity-80">Réserver un trajet</div>
              </div>
            </Link>
            <Link
              to="/activites"
              className="flex items-center gap-3 rounded-2xl bg-accent/90 px-4 py-4 text-accent-foreground backdrop-blur-sm transition-transform active:scale-[0.97]"
            >
              <Palmtree className="h-6 w-6 shrink-0" />
              <div>
                <div className="text-sm font-bold">Activités</div>
                <div className="text-[10px] opacity-80">Explorer le Gabon</div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Popular destinations */}
      <section className="px-5 pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Suggestions populaires</h2>
          <Link to="/activites" search={{}} className="flex items-center gap-1 text-xs font-semibold text-primary">
            Tout voir <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {DESTINATIONS.map((dest) => (
            <Link
              key={dest.id}
              to="/activites"
              search={{ destination: dest.id }}
              className="group w-40 shrink-0 overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg"
            >
              <div className="relative h-28 overflow-hidden">
                <img
                  src={dest.image}
                  alt={dest.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                  width={800}
                  height={600}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent" />
                <div className="absolute bottom-2 left-2 flex items-center gap-1 text-primary-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="text-xs font-semibold">{dest.name}</span>
                </div>
              </div>
              <div className="p-3">
                <p className="text-[11px] leading-snug text-muted-foreground">{dest.description}</p>
                <p className="mt-2 text-sm font-bold text-primary">{formatFCFA(dest.price)}<span className="text-[10px] font-normal text-muted-foreground">/pers</span></p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick activities */}
      <section className="px-5 pt-8">
        <h2 className="text-lg font-bold">Que souhaitez-vous faire ?</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { emoji: "🏞️", label: "Excursion", desc: "Nature & découverte" },
            { emoji: "🎣", label: "Pêche", desc: "En mer ou rivière" },
            { emoji: "🍽️", label: "Gastronomie", desc: "Saveurs locales" },
            { emoji: "🥾", label: "Randonnée", desc: "Sentiers & forêts" },
          ].map((act) => (
            <Link
              key={act.label}
              to="/activites"
              search={{}}
              className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted"
            >
              <span className="text-2xl">{act.emoji}</span>
              <div>
                <div className="text-sm font-semibold">{act.label}</div>
                <div className="text-[10px] text-muted-foreground">{act.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ClientNav />
    </div>
  );
}
