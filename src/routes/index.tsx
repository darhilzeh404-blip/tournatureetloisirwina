import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { GraduationCap, Bus, Globe, ArrowRight, Shield, Clock, CreditCard } from "lucide-react";
import { ServiceCard } from "@/components/ServiceCard";
import heroImg from "@/assets/hero-transport.jpg";
import scolaireImg from "@/assets/transport-scolaire.jpg";
import busImg from "@/assets/location-bus.jpg";
import circuitsImg from "@/assets/circuits-hero.jpg";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="Transport au Gabon" className="h-full w-full object-cover" width={1920} height={960} />
          <div className="absolute inset-0 hero-gradient opacity-85" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-24 lg:px-8 lg:py-36">
          <div className="max-w-2xl">
            <span className="inline-block rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-sm font-medium text-primary-foreground">
              🇬🇦 N°1 du transport au Gabon
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-primary-foreground lg:text-6xl">
              Voyagez en toute <span className="text-accent">sérénité</span>
            </h1>
            <p className="mt-4 text-lg text-primary-foreground/80">
              Transport scolaire, location de bus et circuits touristiques. Réservez en quelques clics avec un paiement sécurisé.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/transport-scolaire" className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90">
                Réserver maintenant <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/circuits" className="inline-flex items-center gap-2 rounded-xl border border-primary-foreground/30 px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10">
                Voir les circuits
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-3 lg:px-8">
          {[
            { icon: <Shield className="h-5 w-5 text-primary" />, title: "Sécurité garantie", desc: "Véhicules inspectés et chauffeurs certifiés" },
            { icon: <Clock className="h-5 w-5 text-primary" />, title: "Ponctualité", desc: "Respect strict des horaires de transport" },
            { icon: <CreditCard className="h-5 w-5 text-primary" />, title: "Paiement flexible", desc: "50% à la réservation, le reste après validation" },
          ].map((item) => (
            <div key={item.title} className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                {item.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <div className="text-center">
          <span className="text-sm font-semibold text-primary">Nos Services</span>
          <h2 className="mt-2 text-3xl font-bold">Tout pour vos déplacements</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            Du transport scolaire aux circuits touristiques, nous couvrons tous vos besoins de mobilité au Gabon.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <ServiceCard
            title="Transport Scolaire"
            description="Abonnements mensuels pour le trajet maison-école de vos enfants. Standard ou VIP."
            icon={<GraduationCap className="h-5 w-5" />}
            image={scolaireImg}
            to="/transport-scolaire"
            badge="Populaire"
          />
          <ServiceCard
            title="Location de Bus"
            description="Bus de 14 à 32 places pour mariages, excursions, événements d'entreprise."
            icon={<Bus className="h-5 w-5" />}
            image={busImg}
            to="/location-bus"
          />
          <ServiceCard
            title="Circuits Touristiques"
            description="Découvrez le Gabon : parcs nationaux, plages, chutes et réserves naturelles."
            icon={<Globe className="h-5 w-5" />}
            image={circuitsImg}
            to="/circuits"
            badge="Nouveau"
          />
        </div>
      </section>

      {/* CTA */}
      <section className="hero-gradient">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center lg:px-8">
          <h2 className="text-3xl font-bold text-primary-foreground">Prêt à réserver ?</h2>
          <p className="mx-auto mt-3 max-w-md text-primary-foreground/80">
            Inscription gratuite. Réservez en moins de 2 minutes. Paiement sécurisé.
          </p>
          <Link to="/transport-scolaire" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90">
            Commencer <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
