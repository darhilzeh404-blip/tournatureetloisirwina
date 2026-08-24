import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth, getRoleRedirectPath, waitForAuth } from "@/hooks/use-auth";
import { FlagGabon } from "@/components/FlagGabon";
import vtcImg from "@/assets/landing/vtc.jpg";
import tourismeImg from "@/assets/landing/tourisme.jpg";
import busImg from "@/assets/landing/bus.jpg";
import voyageImg from "@/assets/landing/voyage.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WINA TOUR — Mobilité, voyages & tourisme au Gabon" },
      {
        name: "description",
        content:
          "VTC, voyages, tourisme, transport et déménagement au Gabon : une seule application pour tous vos déplacements.",
      },
      { property: "og:title", content: "WINA TOUR — Mobilité, voyages & tourisme au Gabon" },
      {
        property: "og:description",
        content: "Une seule application pour vos déplacements, voyages et découvertes au Gabon.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const auth = await waitForAuth();
    if (auth.isAuthenticated && auth.role) {
      const path = auth.role === "client" ? "/espace-client" : getRoleRedirectPath(auth.role);
      if (path !== "/") throw redirect({ to: path, replace: true });
    }
  },
  component: HomePage,
});

const SLIDES = [
  {
    img: voyageImg,
    kicker: "Voyages",
    title: "Partez d'ici,",
    highlight: "arrivez partout.",
    desc: "Billets d'avion, bus, train et navire réservés en quelques secondes.",
  },
  {
    img: tourismeImg,
    kicker: "Tourisme",
    title: "Découvrez le Gabon,",
    highlight: "autrement.",
    desc: "Pongara, Cap Caravane, la Mondah : circuits et excursions organisés pour vous.",
  },
  {
    img: busImg,
    kicker: "Transport",
    title: "Des trajets fiables,",
    highlight: "chaque jour.",
    desc: "Navettes bus, transport scolaire et déplacements de groupe.",
  },
  {
    img: vtcImg,
    kicker: "Mobilité",
    title: "Votre chauffeur,",
    highlight: "en un geste.",
    desc: "VTC, déménagement et colis, partout à Libreville.",
  },
] as const;

function HomePage() {
  const { isAuthenticated, role, isLoading } = useAuth();
  const navigate = useNavigate();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!isLoading && isAuthenticated && role) {
      const path = role === "client" ? "/espace-client" : getRoleRedirectPath(role);
      navigate({ to: path, replace: true });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % SLIDES.length), 5200);
    return () => clearInterval(t);
  }, []);

  if (isLoading || isAuthenticated) return null;

  const slide = SLIDES[i];

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-foreground">
      <AnimatePresence initial={false}>
        <motion.img
          key={slide.img}
          src={slide.img}
          alt={`${slide.kicker} — WINA TOUR au Gabon`}
          width={1024}
          height={1280}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.9 }, scale: { duration: 6, ease: "linear" } }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/70 to-foreground/25" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-6">
        <div className="flex items-center gap-3 text-primary-foreground">
          <img src="/icon-192.png" alt="WINA TOUR" className="h-11 w-11 rounded-2xl shadow-lg" />
          <div className="leading-tight">
            <p className="text-base font-extrabold tracking-tight">WINA TOUR</p>
            <p className="flex items-center gap-1.5 text-[11px] text-primary-foreground/75">
              <FlagGabon className="h-3 w-[18px]" /> Gabon · Mobilité & Tourisme
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-end pb-6">
          <AnimatePresence mode="wait">
            <motion.section
              key={slide.kicker}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="inline-flex items-center rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent backdrop-blur-md">
                {slide.kicker}
              </span>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] text-primary-foreground">
                {slide.title}
                <br />
                <span className="text-accent">{slide.highlight}</span>
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-primary-foreground/80">{slide.desc}</p>
            </motion.section>
          </AnimatePresence>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            {SLIDES.map((s, idx) => (
              <button
                key={s.kicker}
                type="button"
                aria-label={`Voir ${s.kicker}`}
                onClick={() => setI(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === idx ? "w-7 bg-accent" : "w-1.5 bg-primary-foreground/35"
                }`}
              />
            ))}
          </div>

          <Link
            to="/inscription"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-sm font-bold text-accent-foreground shadow-xl"
          >
            Créer mon compte <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/connexion"
            className="flex w-full items-center justify-center rounded-2xl border border-primary-foreground/35 bg-primary-foreground/10 py-4 text-sm font-bold text-primary-foreground backdrop-blur-md"
          >
            J'ai déjà un compte
          </Link>
        </div>
      </div>
    </main>
  );
}
