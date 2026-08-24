import { useState, useEffect } from "react";
import { waitForAuth } from "@/hooks/use-auth";
import pantherRun from "@/assets/panther-run.png";

interface SplashScreenProps {
  onComplete: (session: { user: { id: string } | null; role: string | null } | null) => void;
}

// Splash visible uniquement à la toute première ouverture dans l'onglet.
// Les actualisations suivantes le sautent (sessionStorage) pour ne pas masquer le preview.
const SPLASH_SEEN_KEY = "wina_splash_seen";
function hasSeenSplash() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage?.getItem(SPLASH_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

const alreadySeen = hasSeenSplash();
// Durée d'un cycle complet de course de la panthère (doit rester synchro avec le CSS)
// Allongée : la panthère traverse lentement, avec un mouvement crédible.
const RUN_CYCLE_MS = 3600;
const EXIT_MS = 600;
// Le splash dure toujours un cycle complet => la panthère court 3 secondes, jamais coupée
const MIN_SPLASH_MS = alreadySeen ? 0 : RUN_CYCLE_MS;
const MAX_SPLASH_MS = alreadySeen ? 100 : RUN_CYCLE_MS;

function alignToCycle(elapsed: number) {
  if (alreadySeen) return Math.max(0, MIN_SPLASH_MS - elapsed);
  const target = Math.min(
    MAX_SPLASH_MS,
    Math.ceil(Math.max(elapsed, MIN_SPLASH_MS) / RUN_CYCLE_MS) * RUN_CYCLE_MS,
  );
  return Math.max(0, target - elapsed);
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const startTime = performance.now();
    try { window.sessionStorage?.setItem(SPLASH_SEEN_KEY, "1"); } catch {}

    let cancelled = false;

    const checkSession = async () => {
      const auth = await waitForAuth();
      const elapsed = performance.now() - startTime;
      const remainingMin = alignToCycle(elapsed);

      // Wait at least the minimum splash time
      await new Promise((r) => setTimeout(r, remainingMin));

      if (cancelled) return;

      // Start exit animation
      setPhase("exit");

      // After exit animation (600ms), notify parent
      setTimeout(() => {
        if (!cancelled) {
          onComplete(auth.user ? { user: auth.user, role: auth.role } : null);
        }
      }, EXIT_MS);
    };

    // Small delay before starting "hold" animation feel
    const holdTimer = setTimeout(() => setPhase("hold"), 400);

    checkSession();

    // Hard safety cap
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setPhase("exit");
        setTimeout(() => onComplete(null), EXIT_MS);
      }
    }, MAX_SPLASH_MS + 200);

    return () => {
      cancelled = true;
      clearTimeout(holdTimer);
      clearTimeout(safetyTimer);
    };
  }, [onComplete]);

  return (
    <>
      {phase !== "exit" && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out"
          style={{
            background: "linear-gradient(160deg, oklch(0.55 0.17 250) 0%, oklch(0.42 0.16 255) 50%, oklch(0.35 0.14 245) 100%)",
          }}
        >
          {/* Subtle ambient background rings */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="splash-ring splash-ring-1" />
            <div className="splash-ring splash-ring-2" />
          </div>

          {/* Logo container */}
          <div className="relative flex flex-col items-center gap-5">
            {/* Logo image with scale + pulse */}
            <div className={`relative ${phase === "enter" ? "splash-logo-enter" : "splash-logo-pulse"}`}>
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
            </div>

            {/* App name */}
            <div className="splash-fade-up flex flex-col items-center gap-1">
              <h1 className="text-xl font-extrabold tracking-tight text-white">
                Tour Wina
              </h1>
              <p className="text-xs font-medium text-white/60 tracking-wide">
                Transport & Tourisme au Gabon
              </p>
            </div>

            {/* Panthère qui court juste à côté du nom */}
            <div
              className="splash-panther-track is-inline"
              aria-hidden="true"
              style={{ ["--splash-run-duration" as string]: `${RUN_CYCLE_MS}ms` }}
            >
              <div className="splash-panther-dust" />
              <div className="splash-panther">
                <img src={pantherRun} alt="" className="splash-panther-body" width={1024} height={512} />
              </div>
            </div>

            {/* Loading dots / pulse indicator */}
            <div className="splash-dots mt-2 flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-white/70"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>



          {/* Bottom tagline */}
          <p className="splash-tagline absolute bottom-8 text-[10px] font-medium tracking-widest text-white uppercase">
            Agence Wina
          </p>
        </div>
      )}
    </>
  );
}
