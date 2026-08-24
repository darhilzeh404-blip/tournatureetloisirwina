import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Car, Plane, Compass, Bus, PackageOpen, ArrowRight, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth, getRoleRedirectPath, waitForAuth } from "@/hooks/use-auth";
import heroImg from "@/assets/hero-transport.jpg";
import panther from "@/assets/panther-run.png";

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
      { property: "og:image", content: heroImg },
      { name: "twitter:image", content: heroImg },
    ],
  }),
  // Bloque le rendu de la landing tant qu'on ne sait pas si l'utilisateur est connecté.
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

const SERVICES = [
  { icon: Car, title: "VTC", desc: "Se déplacer facilement en ville." },
  { icon: Plane, title: "Voyages", desc: "Organiser ses déplacements." },
  { icon: Compass, title: "Tourisme", desc: "Sites, circuits & expériences." },
  { icon: Bus, title: "Transport", desc: "Bus, navettes et trajets." },
  { icon: PackageOpen, title: "Déménagement", desc: "Transporter ses biens." },
] as const;

const BENEFITS = [
  "Une seule application pour tous vos besoins",
  "Réservation simple et centralisée",
  "Gain de temps au quotidien",
  "Découverte du Gabon et de ses circuits",
  "Expérience pensée pour le mobile",
] as const;

function HomePage() {
  const { isAuthenticated, role, isLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1>(0);

  useEffect(() => {
    if (!isLoading && isAuthenticated && role) {
      const path = role === "client" ? "/espace-client" : getRoleRedirectPath(role);
      navigate({ to: path, replace: true });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  if (isLoading || isAuthenticated) return null;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImg}
          alt="Voyagez et explorez le Gabon avec WINA TOUR"
          className="h-full w-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/90 via-foreground/75 to-foreground/95" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-8 pt-6">
        {/* Logo */}
        <div className="flex items-center gap-3 text-primary-foreground">
          <img src="/icon-192.png" alt="WINA TOUR" className="h-11 w-11 rounded-2xl shadow-lg" />
          <div className="leading-tight">
            <p className="text-base font-extrabold tracking-tight">WINA TOUR</p>
            <p className="text-[11px] text-primary-foreground/70">Gabon · Mobilité & Tourisme</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center py-8">
          <AnimatePresence mode="wait" initial={false}>
            {step === 0 ? (
              <motion.section
                key="s1"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <h1 className="text-3xl font-extrabold leading-tight text-primary-foreground">
                  Tout le Gabon,
                  <br />
                  <span className="text-accent">dans une seule app.</span>
                </h1>
                <p className="mt-2 text-sm text-primary-foreground/80">
                  Déplacements, voyages, découvertes et déménagement.
                </p>

                <div className="mt-6 space-y-2.5">
                  {SERVICES.map(({ icon: Icon, title, desc }, i) => (
                    <motion.div
                      key={title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.05 * i, ease: "easeOut" }}
                      className="flex items-center gap-3 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-3 backdrop-blur-md"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 text-primary-foreground">
                        <span className="block text-sm font-bold">{title}</span>
                        <span className="block text-[11px] text-primary-foreground/70">{desc}</span>
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            ) : (
              <motion.section
                key="s2"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <h2 className="text-3xl font-extrabold leading-tight text-primary-foreground">
                  Une expérience
                  <br />
                  <span className="text-accent">centralisée.</span>
                </h2>
                <p className="mt-2 text-sm text-primary-foreground/80">
                  Mobilité, voyages, tourisme, transport et déménagement : réservez tout depuis WINA
                  TOUR.
                </p>

                <div className="mt-6 space-y-2.5">
                  {BENEFITS.map((b, i) => (
                    <motion.div
                      key={b}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.05 * i, ease: "easeOut" }}
                      className="flex items-center gap-3 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 px-3 py-2.5 backdrop-blur-md"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/25 text-accent">
                        <Check className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium text-primary-foreground">{b}</span>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-6 flex justify-center">
                  <motion.img
                    src={panther}
                    alt=""
                    aria-hidden="true"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 0.9, x: 0 }}
                    transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                    className="h-14 w-auto drop-shadow-xl"
                  />
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Indicateur + actions */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === i ? "w-6 bg-accent" : "w-1.5 bg-primary-foreground/35"
                }`}
              />
            ))}
          </div>

          {step === 0 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-bold text-accent-foreground shadow-xl"
            >
              Suivant <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="space-y-2.5">
              <Link
                to="/connexion"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-bold text-accent-foreground shadow-xl"
              >
                Se connecter
              </Link>
              <Link
                to="/inscription"
                className="flex w-full items-center justify-center rounded-2xl border border-primary-foreground/35 py-3.5 text-sm font-bold text-primary-foreground backdrop-blur-md"
              >
                S'inscrire
              </Link>
              <button
                type="button"
                onClick={() => setStep(0)}
                className="w-full py-1 text-xs font-medium text-primary-foreground/60"
              >
                Retour
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
