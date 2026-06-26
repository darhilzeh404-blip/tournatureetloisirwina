import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface SplashScreenProps {
  onComplete: (session: { user: { id: string } | null; role: string | null } | null) => void;
}

// Splash visible uniquement à la toute première ouverture dans l'onglet.
// Les actualisations suivantes le sautent (sessionStorage) pour ne pas masquer le preview.
const SPLASH_SEEN_KEY = "wina_splash_seen";
const alreadySeen = typeof window !== "undefined" && window.sessionStorage?.getItem(SPLASH_SEEN_KEY) === "1";
const MIN_SPLASH_MS = alreadySeen ? 0 : 900;
const MAX_SPLASH_MS = alreadySeen ? 100 : 2000;

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const startTime = performance.now();
    try { window.sessionStorage?.setItem(SPLASH_SEEN_KEY, "1"); } catch {}

    let cancelled = false;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      let role: string | null = null;
      if (session?.user) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .limit(1)
          .single();
        role = roleRow?.role ?? null;
      }

      const elapsed = performance.now() - startTime;
      const remainingMin = Math.max(0, MIN_SPLASH_MS - elapsed);
      const remainingMax = Math.max(0, MAX_SPLASH_MS - elapsed);

      // Wait at least the minimum splash time
      await new Promise((r) => setTimeout(r, remainingMin));

      if (cancelled) return;

      // Start exit animation
      setPhase("exit");

      // After exit animation (600ms), notify parent
      setTimeout(() => {
        if (!cancelled) {
          onComplete(session?.user ? { user: session.user, role } : null);
        }
      }, 600);
    };

    // Small delay before starting "hold" animation feel
    const holdTimer = setTimeout(() => setPhase("hold"), 400);

    checkSession();

    // Hard safety cap
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setPhase("exit");
        setTimeout(() => onComplete(null), 600);
      }
    }, MAX_SPLASH_MS + 200);

    return () => {
      cancelled = true;
      clearTimeout(holdTimer);
      clearTimeout(safetyTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== "exit" && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{
            background: "linear-gradient(160deg, oklch(0.55 0.17 250) 0%, oklch(0.42 0.16 255) 50%, oklch(0.35 0.14 245) 100%)",
          }}
        >
          {/* Subtle ambient background rings */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 1.2, 1.5], opacity: [0, 0.08, 0] }}
              transition={{ duration: 2.5, ease: "easeOut", repeat: Infinity, repeatDelay: 0.5 }}
              className="absolute left-1/2 top-[45%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20"
            />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 1.4, 1.8], opacity: [0, 0.05, 0] }}
              transition={{ duration: 2.5, ease: "easeOut", repeat: Infinity, repeatDelay: 0.5, delay: 0.6 }}
              className="absolute left-1/2 top-[45%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
            />
          </div>

          {/* Logo container */}
          <div className="relative flex flex-col items-center gap-5">
            {/* Logo image with scale + pulse */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{
                scale: phase === "enter" ? [0.6, 1.05, 1] : [1, 1.04, 1],
                opacity: 1,
              }}
              transition={{
                scale: phase === "enter"
                  ? { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
                  : { duration: 2, ease: "easeInOut", repeat: Infinity },
                opacity: { duration: 0.4 },
              }}
              className="relative"
            >
              <img
                src="/icon-192.png"
                alt="Tour Wina"
                className="h-20 w-20 rounded-2xl shadow-2xl"
                style={{
                  boxShadow: "0 16px 48px -12px oklch(0.2 0.05 250 / 0.4)",
                }}
              />
              {/* Soft glow behind logo */}
              <div
                className="absolute inset-0 -z-10 rounded-2xl blur-xl"
                style={{
                  background: "oklch(0.75 0.1 250 / 0.35)",
                }}
              />
            </motion.div>

            {/* App name */}
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-1"
            >
              <h1 className="text-xl font-extrabold tracking-tight text-white">
                Tour Wina
              </h1>
              <p className="text-xs font-medium text-white/60 tracking-wide">
                Transport & Tourisme au Gabon
              </p>
            </motion.div>

            {/* Loading dots / pulse indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.3 }}
              className="mt-2 flex items-center gap-1.5"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-white/70"
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.div>
          </div>

          {/* Bottom tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="absolute bottom-8 text-[10px] font-medium tracking-widest text-white uppercase"
          >
            Agence Wina
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
