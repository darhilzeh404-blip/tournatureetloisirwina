import { Link, useLocation } from "@tanstack/react-router";
import { Home, CalendarCheck, Gift, User, Wallet } from "lucide-react";
import { useEffect } from "react";

const NAV_ITEMS = [
  { to: "/espace-client", label: "Accueil", icon: Home },
  { to: "/wina-coins", label: "Récompenses", icon: Gift },
  { to: "/wallet", label: "Wallet", icon: Wallet },
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
    <>
    <nav className="sticky top-0 z-50 hidden border-b border-border/70 bg-card/90 backdrop-blur-xl md:block">
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 px-4 py-2.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`relative flex items-center gap-2 rounded-[var(--radius-control)] px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>

    <nav className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-50 mx-auto max-w-md rounded-[1.75rem] border border-primary-foreground/10 bg-primary/95 px-2 shadow-[var(--shadow-premium)] backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5 items-center py-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className={`relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-semibold transition-colors ${
                active
                  ? "bg-primary-foreground/12 text-accent"
                  : "text-primary-foreground/65 hover:text-primary-foreground"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>

    </>
  );
}
