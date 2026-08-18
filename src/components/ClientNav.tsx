import { Link, useLocation } from "@tanstack/react-router";
import { Home, CalendarCheck, Gift, User, CarFront, Wallet, LayoutGrid, Lock } from "lucide-react";
import { useEffect } from "react";
import { isVtcAvailable } from "@/lib/vtc-availability";

const NAV_ITEMS = [
  { to: "/espace-client", label: "Accueil", icon: Home },
  { to: "/vtc", label: "VTC", icon: CarFront },
  { to: "/wina-coins", label: "Récompenses", icon: Gift },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/mes-reservations", label: "Réserv.", icon: CalendarCheck },
  { to: "/mon-compte", label: "Profil", icon: User },
] as const;


export function ClientNav() {
  const location = useLocation();
  const vtcLocked = !isVtcAvailable();

  // Reserve space at the bottom of the page so the fixed nav never
  // covers footer content (Footer, sticky CTAs, etc.).
  useEffect(() => {
    document.body.classList.add("has-client-nav");
    return () => document.body.classList.remove("has-client-nav");
  }, []);

  return (
    <>
    {/* Desktop / tablet : barre de navigation horizontale en haut */}
    <nav className="sticky top-0 z-50 hidden border-b bg-card/95 backdrop-blur-lg md:block">
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-1 px-4 py-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          const locked = vtcLocked && to === "/vtc";
          return (
            <Link
              key={to}
              to={to}
              title={locked ? "VTC indisponible pour le moment" : undefined}
              className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              } ${locked ? "opacity-70" : ""}`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {locked && <Lock className="h-3 w-3" aria-label="Service indisponible" />}
            </Link>
          );
        })}
      </div>
    </nav>

    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-lg safe-area-bottom md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-0.5 py-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          const locked = vtcLocked && to === "/vtc";
          return (
            <Link
              key={to}
              to={to}
              aria-label={locked ? `${label} — indisponible pour le moment` : label}
              className={`relative flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-[9px] font-medium transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              } ${locked ? "opacity-70" : ""}`}
            >
              <span className="relative">
                <Icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
                {locked && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1.5 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-foreground text-background"
                  >
                    <Lock className="h-2 w-2" />
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>

    </>
  );
}
