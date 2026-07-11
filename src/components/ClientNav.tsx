import { Link, useLocation } from "@tanstack/react-router";
import { Home, CalendarCheck, User, CarFront, Wallet, Gift } from "lucide-react";
import { useEffect } from "react";

const NAV_ITEMS = [
  { to: "/espace-client", label: "Accueil", icon: Home },
  { to: "/vtc", label: "VTC", icon: CarFront },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/wina-coins", label: "Récompenses", icon: Gift },
  { to: "/mes-reservations", label: "Réserv.", icon: CalendarCheck },
  { to: "/mon-compte", label: "Profil", icon: User },
] as const;

export function ClientNav() {
  const location = useLocation();

  // Reserve space at the bottom of the page so the fixed nav never
  // covers footer content (Footer, sticky CTAs, etc.).
  useEffect(() => {
    document.body.classList.add("has-client-nav");
    return () => document.body.classList.remove("has-client-nav");
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-lg safe-area-bottom md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-0.5 py-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-[9px] font-medium transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
