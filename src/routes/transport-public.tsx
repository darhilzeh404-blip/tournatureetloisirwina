import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bus, Zap, CalendarClock, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useAuth, getRoleRedirectPath, waitForAuth } from "@/hooks/use-auth";
import heroImg from "@/assets/hero-transport.jpg";

export const Route = createFileRoute("/transport-public")({
  head: () => ({
    meta: [
      { title: "Transport — Agence Wina" },
      {
        name: "description",
        content: "Transport immédiat ou planifié au Gabon. Connectez-vous pour réserver en 1 clic.",
      },
      { property: "og:title", content: "Transport — Agence Wina" },
      { property: "og:description", content: "Transport immédiat ou planifié au Gabon." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const auth = await waitForAuth();
    if (auth.isAuthenticated && auth.role) {
      const path = auth.role === "client" ? "/espace-client" : getRoleRedirectPath(auth.role);
      throw redirect({ to: path, replace: true });
    }
  },
  component: TransportPublic,
});

function TransportPublic() {
  const { isAuthenticated, role, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated && role) {
      const path = role === "client" ? "/espace-client" : getRoleRedirectPath(role);
      navigate({ to: path, replace: true });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  if (isAuthenticated) return null;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImg}
          alt="Transport au Gabon"
          className="h-full w-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-foreground/85 via-foreground/65 to-foreground/45" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-8 lg:px-8">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium text-primary-foreground backdrop-blur-sm hover:bg-primary-foreground/20"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Accueil
        </Link>

        <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.7 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl"
          >
            <Bus className="h-8 w-8" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-5 text-3xl font-extrabold leading-tight text-primary-foreground lg:text-5xl"
          >
            Transport immédiat
            <br />
            <span className="text-accent">ou planifié</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 max-w-md text-base text-primary-foreground/85"
          >
            Choisissez la formule qui vous convient. Connexion requise pour réserver.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 grid w-full max-w-md gap-3 sm:grid-cols-2"
          >
            <Link
              to="/connexion"
              className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-6 text-accent-foreground shadow-xl transition-transform hover:scale-105"
            >
              <Zap className="h-7 w-7" />
              <span className="text-base font-bold">Prendre immédiat</span>
              <span className="text-xs opacity-80">Trajet maintenant</span>
            </Link>
            <Link
              to="/connexion"
              className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-6 text-primary-foreground shadow-xl transition-transform hover:scale-105"
            >
              <CalendarClock className="h-7 w-7" />
              <span className="text-base font-bold">Planifier</span>
              <span className="text-xs opacity-80">Date & heure</span>
            </Link>
          </motion.div>
        </section>

        {/* Strong signup CTA */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/30 to-primary/30 p-5 text-center backdrop-blur-md"
        >
          <Sparkles className="mx-auto h-6 w-6 text-accent-foreground" />
          <p className="mt-2 text-sm font-semibold text-primary-foreground">
            Pas encore de compte ?
          </p>
          <p className="mt-1 text-xs text-primary-foreground/80">
            Créez le vôtre gratuitement en 30 secondes.
          </p>
          <Link
            to="/inscription"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-background px-6 py-2.5 text-sm font-bold text-foreground shadow-lg transition-transform hover:scale-105"
          >
            Créer un compte gratuit <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.footer>
      </div>
    </main>
  );
}
