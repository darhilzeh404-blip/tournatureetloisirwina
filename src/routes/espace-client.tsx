import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bus, Palmtree, ArrowRight, MapPin, Navigation, CarFront, Ticket, Mountain } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ClientNav } from "@/components/ClientNav";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { DESTINATIONS, formatFCFA } from "@/lib/destinations";
import { BookingDialog, type BookingTarget } from "@/components/BookingDialog";
import heroImg from "@/assets/client-hero.png";
import bus3d from "@/assets/icons/bus-3d.jpg";
import navetteBus3d from "@/assets/icons/Navette bus-3d.webp";
import circuit3d from "@/assets/icons/circuit-3d.webp";
import vtc3d from "@/assets/icons/vtc-3d.ico";
import site3d from "@/assets/icons/site-3d.webp";
import billetterie3d from "@/assets/icons/billeterie 3d.webp";
import promo3d from "@/assets/icons/Promos 3d.webp";
import support3d from "@/assets/icons/Support 3d.jpg";

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
  const { user, isLoading, isAuthenticated } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Voyageur";
  const [target, setTarget] = useState<BookingTarget | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/connexion" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || !isAuthenticated) {
    return <EspaceClientSkeleton />;
  }


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
            width={1080}
            height={1024}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/40 to-transparent" />
        </div>
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="relative px-5 pb-8 pt-12"
        ><motion.p variants={fadeUp}>
  Bonjour {firstName} 👋
</motion.p>

          <motion.h1 variants={fadeUp} className="mt-1 text-2xl font-bold text-primary-foreground">
  Voyage, Transport et Tourism
</motion.h1>

        </motion.div>
      </section>


      {/* Dashboard Nos Services */}
        <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={stagger}
        className="px-5 pt-8"
      >
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Nos services</h2>
          <span className="text-[11px] font-medium text-muted-foreground">Accès rapide</span>
        </motion.div>
        <motion.div variants={stagger} className="mt-4 grid grid-cols-3 gap-3">
  {[
    {
      to: "/reserver-transport",
      label: "Navette bus",
      desc: "Bus & trajets",
      image: navetteBus3d,
      tint: "from-primary/20 to-primary/5"
    },
    {
      to: "/activites",
      label: "Circuits touristique",
      desc: "Explorer",
      image: circuit3d,
      tint: "from-accent/25 to-accent/5"
    },
    {
      to: "/vtc",
      label: "VTC",
      desc: "Course privée",
      image: vtc3d,
      tint: "from-primary/15 to-accent/10"
    },
    {
      to: "/sites-touristiques",
      label: "Sites touristique",
      desc: "À découvrir",
      image: site3d,
      tint: "from-accent/20 to-primary/10"
    },
    {
      to: "/billets",
      label: "Billetterie",
      desc: "Événements",
      image: billetterie3d,
      tint: "from-accent/20 to-primary/10"
    },
   {  
  to: "/promos",
  label: "Promos",
  desc: "Offres",
  image: promo3d,
  tint: "from-primary/15 to-primary/5"
},
{
  to: "/support",
  label: "Support",
  desc: "24/7",
  image: support3d,
  tint: "from-accent/15 to-accent/5"
},

  ].map((srv) => (
    <motion.div
      key={srv.to}
      variants={fadeUp}
      whileHover={{ y: -4, scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
    >
      <Link
        to={srv.to}
        className={`relative flex h-full flex-col items-center gap-2 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br ${srv.tint} p-3 shadow-sm`}
      >
        <img
          src={srv.image}
          alt={srv.label}
          className="h-12 w-12 object-contain"
        />

        <div className="text-center">
          <div className="text-sm font-bold leading-tight">
            {srv.label}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {srv.desc}
          </div>
        </div>
      </Link>
    </motion.div>
  ))}
</motion.div>
</motion.section>

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
               
              }}
              onKeyDown={(event) => {
                if (isInteractiveTarget(event.target)) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();

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

function EspaceClientSkeleton() {
  return (
    <div className="pb-20 animate-pulse">
      <div className="relative h-56 overflow-hidden bg-muted">
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent" />
        <div className="relative px-5 pt-12">
          <div className="h-3 w-20 rounded bg-background/40" />
          <div className="mt-2 h-6 w-56 rounded bg-background/50" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="h-16 rounded-2xl bg-background/40" />
            <div className="h-16 rounded-2xl bg-background/40" />
          </div>
        </div>
      </div>

      <div className="px-5 pt-8">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl border border-border/60 bg-muted" />
          ))}
        </div>
      </div>

      <div className="px-5 pt-8">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="mt-4 flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-52 w-40 shrink-0 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>

      <div className="px-5 pt-8">
        <div className="h-4 w-48 rounded bg-muted" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
