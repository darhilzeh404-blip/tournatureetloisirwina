import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, CalendarCheck, CreditCard, Users, Bus, Tag, ArrowLeft, Menu, X, Map, LogOut, Shield, Route as RouteIcon, Radio, Truck, ClipboardCheck, Car, Megaphone, Ticket, Settings2, UsersRound } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";

const adminLinks = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/admin/utilisateurs", label: "Utilisateurs", icon: Shield, exact: false },
  { to: "/admin/reservations", label: "Réservations", icon: CalendarCheck, exact: false },
  { to: "/admin/bus-reservations", label: "Validation Bus", icon: ClipboardCheck, exact: false },
  { to: "/admin/paiements", label: "Paiements", icon: CreditCard, exact: false },
  { to: "/admin/clients", label: "Clients", icon: Users, exact: false },
  { to: "/admin/bus", label: "Flotte Bus", icon: Bus, exact: false },
  { to: "/admin/offres", label: "Offres", icon: Tag, exact: false },
  { to: "/admin/circuits", label: "Circuits", icon: Map, exact: false },
  { to: "/admin/transport", label: "Module Transport", icon: RouteIcon, exact: false },
  { to: "/admin/trips", label: "Courses GPS", icon: Truck, exact: false },
  { to: "/admin/group-rides", label: "Courses Groupées", icon: UsersRound, exact: false },
  { to: "/admin/vtc-chauffeurs", label: "VTC Chauffeurs", icon: Car, exact: false },
  { to: "/admin/vehicule-types", label: "Types véhicules", icon: Settings2, exact: false },
  { to: "/admin/billets", label: "Billets", icon: Ticket, exact: false },
  { to: "/admin/annonces", label: "Annonces", icon: Megaphone, exact: false },
  { to: "/admin/suivi", label: "Suivi temps réel", icon: Radio, exact: false },
] as const;

export function AdminSidebar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const isActive = (to: string, exact: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  const nav = (
    <nav className="flex flex-col gap-1">
      {adminLinks.map((link) => {
        const active = isActive(link.to, link.exact);
        return (
          <Link
            key={link.to}
            to={link.to}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <link.icon className="h-4 w-4 shrink-0" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg lg:hidden"
        aria-label="Menu admin"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r bg-sidebar transition-transform lg:relative lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Bus className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold text-foreground">Wina Admin</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3">{nav}</div>

        <div className="border-t p-3 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au site
          </Link>
          <button
            onClick={() => { signOut(); navigate({ to: "/" }); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}
