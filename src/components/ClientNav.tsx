import { Link, useLocation } from "@tanstack/react-router";
import { Home, Bus, Palmtree, CalendarCheck, User } from "lucide-react";

const NAV_ITEMS = [
  { to: "/espace-client", label: "Accueil", icon: Home },
  { to: "/reserver-transport", label: "Transport", icon: Bus },
  { to: "/activites", label: "Activités", icon: Palmtree },
  { to: "/mes-reservations", label: "Réservations", icon: CalendarCheck },
  { to: "/mon-compte", label: "Profil", icon: User },
] as const;

export function ClientNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-lg safe-area-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${
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
