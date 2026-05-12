import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bus, Palmtree, ArrowRight, MapPin, Navigation } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ClientNav } from "@/components/ClientNav";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { DESTINATIONS, formatFCFA } from "@/lib/destinations";
import { BookingDialog, type BookingTarget } from "@/components/BookingDialog";
import heroImg from "@/assets/client-hero.jpg";

// Mapping destination id (destinations.ts) -> slug du circuit en BDD
const DESTINATION_SLUG: Record<string, string> = {
  "pongara": "pongara-baignade",
  "cap-caravane": "cap-caravane",
  "mondah": "baie-mondah",
  "ndzessi": "ndossi-village",
  "raponda-walker": "raponda-walker",
};

// Coordonnées GPS des sites touristiques
const DESTINATION_COORDS: Record<string, { lat: number; lng: number }> = {
  "pongara": { lat: 0.2647, lng: 9.3274 },
  "cap-caravane": { lat: 0.3208, lng: 9.2541 },
  "mondah": { lat: 0.5812, lng: 9.3636 },
  "ndzessi": { lat: 0.4528, lng: 9.5189 },
  "raponda-walker": { lat: 0.5097, lng: 9.3994 },
};

function openGoogleMaps(destId: string, destName: string) {
  console.log("bouton cliqué", destId);
  const coords = DESTINATION_COORDS[destId];
  if (!coords) {
    toast.error("Position GPS indisponible pour ce site touristique.");
    return;
  }
  const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving`;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    // fallback si popup bloquée
    window.location.href = url;
  }
  toast.success(`Itinéraire vers ${destName} ouvert dans Google Maps.`);
}

export const Route = createFileRoute("/espace-client")({
  head: () => ({
    meta: [
      { title: "Mon Espace — Agence Wina" },
      { name: "description", content: "Votre tableau de bord voyage : réservez transport et activités au Gabon." },
    ],
  }),
  component: EspaceClient,
});

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

function EspaceClient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Voyageur";
  const [target, setTarget] = useState<BookingTarget | null>(null);

  const openCircuitNavigation = (slug: string) => {
    navigate({ to: "/circuits/suivi/$slug", params: { slug } });
  };

  return (
    <div className="pb-20">
      <AnnouncementBanner />
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <motion.img
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            src={heroImg}
            alt="Transport Libreville"
            className="h-full w-full object-cover"
            width={1200}
            height={600}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/40 to-transparent" />
        </div>
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="relative px-5 pb-8 pt-12"
        >
          <motion.p variants={fadeUp} className="text-sm font-medium text-primary-foreground/80">
            Bonjour 👋
          </motion.p>
          <motion.h1 variants={fadeUp} className="mt-1 text-2xl font-bold text-primary-foreground">
            {firstName}, où allez-vous ?
          </motion.h1>

          <motion.div variants={stagger} className="mt-6 grid grid-cols-2 gap-3">
            <motion.div variants={fadeUp} whileTap={{ scale: 0.96 }}>
              <Link
                to="/reserver-transport"
                className="flex items-center gap-3 rounded-2xl bg-primary/90 px-4 py-4 text-primary-foreground backdrop-blur-sm"
              >
                <Bus className="h-6 w-6 shrink-0" />
                <div>
                  <div className="text-sm font-bold">Transport</div>
                  <div className="text-[10px] opacity-80">Réserver un trajet</div>
                </div>
              </Link>
            </motion.div>
            <motion.a
              variants={fadeUp}
              whileTap={{ scale: 0.96 }}
              href="/activites"
              className="flex items-center gap-3 rounded-2xl bg-accent/90 px-4 py-4 text-accent-foreground backdrop-blur-sm"
            >
              <Palmtree className="h-6 w-6 shrink-0" />
              <div>
                <div className="text-sm font-bold">Activités</div>
                <div className="text-[10px] opacity-80">Explorer le Gabon</div>
              </div>
            </motion.a>
          </motion.div>
        </motion.div>
      </section>

      {/* Popular destinations */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={stagger}
        className="px-5 pt-8"
      >
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Suggestions populaires</h2>
          <a href="/activites" className="flex items-center gap-1 text-xs font-semibold text-primary">
            Tout voir <ArrowRight className="h-3 w-3" />
          </a>
        </motion.div>

        <motion.div variants={stagger} className="mt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {DESTINATIONS.map((dest) => (
            <motion.article
              key={dest.id}
              role="link"
              tabIndex={0}
              aria-label={`Naviguer vers le circuit ${dest.name}`}
              onClick={(event) => {
                if (isInteractiveTarget(event.target)) return;
                openCircuitNavigation(DESTINATION_SLUG[dest.id] ?? gpsSlug(dest.name));
              }}
              onKeyDown={(event) => {
                if (isInteractiveTarget(event.target)) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openCircuitNavigation(DESTINATION_SLUG[dest.id] ?? gpsSlug(dest.name));
                }
              }}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.97 }}
              className="group w-40 shrink-0 cursor-pointer overflow-hidden rounded-2xl border bg-card text-left transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                <p className="mt-2 text-sm font-bold text-primary">
                  {formatFCFA(dest.price)}
                  <span className="text-[10px] font-normal text-muted-foreground">/pers</span>
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setTarget({
                      kind: "circuit",
                      id: null,
                      slug: DESTINATION_SLUG[dest.id],
                      name: dest.name,
                      basePrice: dest.price,
                    })
                  }
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Réserver
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openGoogleMaps(dest.id, dest.name);
                  }}
                  aria-label={`Naviguer vers le circuit ${dest.name}`}
                  className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border bg-card px-3 py-3 text-xs font-bold leading-tight text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Navigation className="h-4 w-4 shrink-0 text-primary" />
                  <span>Naviguer</span>
                </button>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </motion.section>

      {/* Quick activities */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={stagger}
        className="px-5 pt-8"
      >
        <motion.h2 variants={fadeUp} className="text-lg font-bold">
          Que souhaitez-vous faire ?
        </motion.h2>
        <motion.div variants={stagger} className="mt-4 grid grid-cols-2 gap-3">
          {[
            { emoji: "🏞️", label: "Excursion", desc: "Nature & découverte" },
            { emoji: "🎣", label: "Pêche", desc: "En mer ou rivière" },
            { emoji: "🍽️", label: "Gastronomie", desc: "Saveurs locales" },
            { emoji: "🥾", label: "Randonnée", desc: "Sentiers & forêts" },
          ].map((act) => (
            <motion.a
              key={act.label}
              variants={fadeUp}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              href="/activites"
              className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted"
            >
              <span className="text-2xl">{act.emoji}</span>
              <div>
                <div className="text-sm font-semibold">{act.label}</div>
                <div className="text-[10px] text-muted-foreground">{act.desc}</div>
              </div>
            </motion.a>
          ))}
        </motion.div>
      </motion.section>

      {target && <BookingDialog target={target} onClose={() => setTarget(null)} />}
      <ClientNav />
    </div>
  );
}

function gpsSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("a, button, input, select, textarea"));
}
