import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Bus,
  Globe,
  ArrowRight,
  Shield,
  Clock,
  CreditCard,
  MapPin,
  Compass,
  Sparkles,
} from "lucide-react";
import { ServiceCard } from "@/components/ServiceCard";
import { DESTINATIONS, ACTIVITIES, formatFCFA } from "@/lib/destinations";
import heroImg from "@/assets/hero-transport.jpg";
import scolaireImg from "@/assets/transport-scolaire.jpg";
import busImg from "@/assets/location-bus.jpg";
import circuitsImg from "@/assets/circuits-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agence Wina — Voyagez et explorez le Gabon" },
      {
        name: "description",
        content:
          "Découvrez le Gabon : circuits touristiques, plages, parcs nationaux, transport scolaire et location de bus. Réservation en ligne sécurisée.",
      },
      { property: "og:title", content: "Agence Wina — Voyagez et explorez le Gabon" },
      {
        property: "og:description",
        content:
          "Circuits touristiques, plages, parcs nationaux, transport scolaire et location de bus au Gabon.",
      },
      { property: "og:image", content: heroImg },
      { name: "twitter:image", content: heroImg },
    ],
  }),
  component: HomePage,
});

import type { Variants } from "framer-motion";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

function HomePage() {
  return (
    <>
      {/* HERO — tourism inspiration */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <motion.img
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            src={heroImg}
            alt="Découvrez le Gabon avec Agence Wina"
            className="h-full w-full object-cover"
            width={1920}
            height={960}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/80 via-foreground/55 to-foreground/30" />
        </div>
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="relative mx-auto max-w-7xl px-4 py-24 lg:px-8 lg:py-36"
        >
          <div className="max-w-2xl">
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-sm font-medium text-primary-foreground backdrop-blur-sm"
            >
              <Sparkles className="h-4 w-4" /> Évadez-vous au Gabon
            </motion.span>
            <motion.h1
              variants={fadeUp}
              className="mt-6 text-4xl font-extrabold leading-tight text-primary-foreground lg:text-6xl"
            >
              Explorez. Voyagez. <span className="text-accent">Vivez le Gabon.</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-4 text-lg text-primary-foreground/85"
            >
              Plages, parcs nationaux, randonnées, sorties scolaires et bus pour vos
              événements. Tout ce qu'il faut pour partir à l'aventure — réservé en
              ligne en quelques clics.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/circuits"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg transition-transform hover:scale-105"
              >
                <Compass className="h-4 w-4" /> Explorer les voyages
              </Link>
              <Link
                to="/reserver-transport"
                className="inline-flex items-center gap-2 rounded-xl border border-primary-foreground/30 bg-primary-foreground/10 px-6 py-3 text-sm font-semibold text-primary-foreground backdrop-blur-sm transition-colors hover:bg-primary-foreground/20"
              >
                Réserver un transport <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* FEATURED DESTINATIONS */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        variants={stagger}
        className="mx-auto max-w-7xl px-4 py-16 lg:px-8"
      >
        <motion.div variants={fadeUp} className="flex items-end justify-between gap-4">
          <div>
            <span className="text-sm font-semibold text-primary">Destinations</span>
            <h2 className="mt-1 text-3xl font-bold">Des lieux à couper le souffle</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Plages, mangroves, forêts tropicales et villages culturels — choisissez
              votre prochaine évasion.
            </p>
          </div>
          <Link
            to="/circuits"
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex"
          >
            Tout voir <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div
          variants={stagger}
          className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {DESTINATIONS.map((dest) => (
            <motion.div
              key={dest.id}
              variants={fadeUp}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                to="/circuits"
                className="group block overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-xl"
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={dest.image}
                    alt={dest.name}
                    loading="lazy"
                    width={800}
                    height={600}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-primary-foreground">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      <span className="text-base font-bold">{dest.name}</span>
                    </div>
                    <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">
                      dès {formatFCFA(dest.price)}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-muted-foreground">{dest.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {dest.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* ACTIVITIES STRIP */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={stagger}
        className="border-y bg-card"
      >
        <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <motion.div variants={fadeUp} className="text-center">
            <span className="text-sm font-semibold text-primary">Activités</span>
            <h2 className="mt-1 text-3xl font-bold">À chacun son aventure</h2>
          </motion.div>
          <motion.div
            variants={stagger}
            className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"
          >
            {ACTIVITIES.map((a) => (
              <motion.div
                key={a.id}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.96 }}
              >
                <Link
                  to="/activites"
                  className="flex h-full flex-col items-center gap-2 rounded-2xl border bg-background p-4 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="text-3xl" aria-hidden>
                    {a.icon}
                  </span>
                  <span className="text-xs font-semibold leading-tight">{a.label}</span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* TRANSPORT SERVICES */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        variants={stagger}
        className="mx-auto max-w-7xl px-4 py-16 lg:px-8"
      >
        <motion.div variants={fadeUp} className="text-center">
          <span className="text-sm font-semibold text-primary">Transport</span>
          <h2 className="mt-1 text-3xl font-bold">Des solutions pour chaque trajet</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            Que ce soit pour vos enfants, votre événement ou votre escapade — nos
            véhicules sont prêts.
          </p>
        </motion.div>
        <motion.div variants={stagger} className="mt-10 grid gap-6 md:grid-cols-3">
          <motion.div variants={fadeUp}>
            <ServiceCard
              title="Transport Scolaire"
              description="Abonnements mensuels pour le trajet maison-école de vos enfants. Standard ou VIP."
              icon={<GraduationCap className="h-5 w-5" />}
              image={scolaireImg}
              to="/transport-scolaire"
              badge="Populaire"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <ServiceCard
              title="Location de Bus"
              description="Bus de 14 à 32 places pour mariages, excursions, événements d'entreprise."
              icon={<Bus className="h-5 w-5" />}
              image={busImg}
              to="/location-bus"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <ServiceCard
              title="Circuits Touristiques"
              description="Découvrez le Gabon : parcs nationaux, plages, chutes et réserves naturelles."
              icon={<Globe className="h-5 w-5" />}
              image={circuitsImg}
              to="/circuits"
              badge="Nouveau"
            />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* TRUST BADGES */}
      <section className="border-t bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-10 sm:grid-cols-3 lg:px-8">
          {[
            {
              icon: <Shield className="h-5 w-5 text-primary" />,
              title: "Sécurité garantie",
              desc: "Véhicules inspectés et chauffeurs certifiés",
            },
            {
              icon: <Clock className="h-5 w-5 text-primary" />,
              title: "Ponctualité",
              desc: "Respect strict des horaires de transport",
            },
            {
              icon: <CreditCard className="h-5 w-5 text-primary" />,
              title: "Paiement flexible",
              desc: "50% à la réservation, le reste après validation",
            },
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

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-accent">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl font-bold text-primary-foreground lg:text-4xl"
          >
            Prêt pour votre prochaine aventure ?
          </motion.h2>
          <p className="mx-auto mt-3 max-w-md text-primary-foreground/85">
            Inscription gratuite. Réservation en moins de 2 minutes. Paiement
            sécurisé.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              to="/inscription"
              className="inline-flex items-center gap-2 rounded-xl bg-background px-8 py-3 text-sm font-semibold text-foreground shadow-lg transition-transform hover:scale-105"
            >
              Créer mon compte <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/circuits"
              className="inline-flex items-center gap-2 rounded-xl border border-primary-foreground/40 px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10"
            >
              Découvrir les voyages
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
