import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Compass, Bus, ArrowRight, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getRoleRedirectPath } from "@/hooks/use-auth";
import heroImg from "@/assets/hero-transport.jpg";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Redirect connected clients straight to their dashboard
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .limit(1)
        .single();
      const role = roleRow?.role;
      if (role === "client") throw redirect({ to: "/espace-client" });
      if (role === "admin") throw redirect({ to: "/admin" });
      if (role === "gerant") throw redirect({ to: "/gerant" });
      if (role === "chauffeur") throw redirect({ to: "/chauffeur" });
    }
  },
  head: () => ({
    meta: [
      { title: "Agence Wina — Bus & Circuits au Gabon" },
      {
        name: "description",
        content: "Réservez bus et circuits touristiques au Gabon en 1 clic. Inscription gratuite.",
      },
      { property: "og:title", content: "Agence Wina — Bus & Circuits au Gabon" },
      { property: "og:description", content: "Réservez bus et circuits touristiques au Gabon en 1 clic." },
      { property: "og:image", content: heroImg },
      { name: "twitter:image", content: heroImg },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { isAuthenticated, role, isLoading } = useAuth();
  const navigate = useNavigate();

  // Client-side guard: si la session est restaurée après le SSR, on redirige aussi
  useEffect(() => {
    if (!isLoading && isAuthenticated && role) {
      const path = role === "client" ? "/espace-client" : getRoleRedirectPath(role);
      navigate({ to: path, replace: true });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  // Pendant la redirection, on ne flash pas la landing
  if (isAuthenticated) return null;

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <motion.img
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          src={heroImg}
          alt="Voyagez et explorez le Gabon avec Agence Wina"
          className="h-full w-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-foreground/85 via-foreground/65 to-foreground/40" />
      </div>

      {/* Content */}
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-between px-5 py-10 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-primary-foreground"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" /> Agence Wina · Gabon
          </span>
        </motion.header>

        {/* Hero + 2 CTAs */}
        <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl font-extrabold leading-tight text-primary-foreground lg:text-6xl"
          >
            Voyagez. Explorez.
            <br />
            <span className="text-accent">Vivez le Gabon.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-5 max-w-md text-base text-primary-foreground/85 lg:text-lg"
          >
            Réservez bus & circuits touristiques en 1 clic. Inscription gratuite.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 grid w-full max-w-md gap-3 sm:grid-cols-2"
          >
            <Link
              to="/circuits"
              className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-6 text-accent-foreground shadow-xl transition-transform hover:scale-105"
            >
              <Compass className="h-8 w-8" />
              <span className="text-base font-bold">Circuits Touristiques</span>
              <span className="text-xs opacity-80">Découvrir le Gabon</span>
            </Link>
            <Link
              to="/transport-public"
              className="group flex flex-col items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-6 text-primary-foreground shadow-xl transition-transform hover:scale-105"
            >
              <Bus className="h-8 w-8" />
              <span className="text-base font-bold">Transport</span>
              <span className="text-xs opacity-80">Bus & trajets</span>
            </Link>
          </motion.div>
        </section>

        {/* Footer login/signup */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-5 text-center backdrop-blur-md"
        >
          <p className="text-sm font-medium text-primary-foreground">
            Réservez bus & circuits en 1 clic ✨
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link
              to="/connexion"
              className="inline-flex items-center gap-1.5 rounded-xl bg-background px-5 py-2.5 text-sm font-semibold text-foreground shadow transition-transform hover:scale-105"
            >
              Se connecter <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/inscription"
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary-foreground/40 px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10"
            >
              Créer un compte
            </Link>
          </div>
        </motion.footer>
      </div>
    </main>
  );
}
