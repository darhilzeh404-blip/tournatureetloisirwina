import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, CalendarCheck, CreditCard, Users, Bus, Tag, ArrowLeft, Menu, X, Map, LogOut, Shield, Route as RouteIcon, Radio, Truck, ClipboardCheck, Car, Megaphone, Ticket, Settings2, UsersRound, Coins, Building2, Wallet, Percent, Mountain, LayoutGrid, Eye, Plane, TrainFront, Ship, ArrowDownToLine, Bell } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { setClientPreview } from "@/lib/admin-preview";

const adminLinks = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/admin/utilisateurs", label: "Utilisateurs", icon: Shield, exact: false },
  { to: "/admin/reservations", label: "Réservations", icon: CalendarCheck, exact: false },
  { to: "/admin/bus-reservations", label: "Validation Bus", icon: ClipboardCheck, exact: false },
  { to: "/admin/paiements", label: "Paiements", icon: CreditCard, exact: false },
  { to: "/admin/frais", label: "Frais application", icon: Percent, exact: false },
  { to: "/admin/recharges", label: "Recharges portefeuille", icon: Wallet, exact: false },
  { to: "/admin/vtc-wallets", label: "Portefeuilles VTC", icon: Wallet, exact: false },
  { to: "/admin/vtc-tarifs", label: "Tarifs VTC", icon: Percent, exact: false },
  { to: "/admin/retraits", label: "Retraits chauffeurs", icon: ArrowDownToLine, exact: false },
  { to: "/admin/fidelite", label: "Wina Coins", icon: Coins, exact: false },
  { to: "/admin/clients", label: "Clients", icon: Users, exact: false },
  { to: "/admin/bus", label: "Flotte Bus", icon: Bus, exact: false },
  { to: "/admin/offres", label: "Offres", icon: Tag, exact: false },
  { to: "/admin/circuits", label: "Circuits", icon: Map, exact: false },
  { to: "/admin/transport", label: "Module Transport", icon: RouteIcon, exact: false },
  { to: "/admin/trips", label: "Courses GPS", icon: Truck, exact: false },
  { to: "/admin/incidents", label: "Incidents (IA)", icon: Bell, exact: false },
  { to: "/admin/group-rides", label: "Courses Groupées", icon: UsersRound, exact: false },
  { to: "/admin/demenagements", label: "Déménagements", icon: Truck, exact: false },
  { to: "/admin/vtc-chauffeurs", label: "VTC Chauffeurs", icon: Car, exact: false },
  { to: "/admin/vehicule-types", label: "Types véhicules", icon: Settings2, exact: false },
  { to: "/admin/catalogue", label: "Catalogue véhicules", icon: LayoutGrid, exact: false },
  { to: "/admin/billets", label: "Billets", icon: Ticket, exact: false },
  { to: "/admin/bus-billetterie", label: "Billetterie Bus", icon: Bus, exact: false },
  { to: "/admin/trains", label: "Configuration Train", icon: TrainFront, exact: false },
  { to: "/admin/navires", label: "Navires & Billetterie", icon: Ship, exact: false },
  { to: "/admin/billets-reservations", label: "Réservations billets", icon: ClipboardCheck, exact: false },
  { to: "/admin/vols", label: "Programmes de vols", icon: Plane, exact: false },
  { to: "/admin/vols-demandes", label: "Demandes de vols", icon: ClipboardCheck, exact: false },
  { to: "/admin/billets-demandes", label: "Demandes billets", icon: ClipboardCheck, exact: false },
  { to: "/admin/agences", label: "Agences partenaires", icon: Building2, exact: false },
  { to: "/admin/sites-touristiques", label: "Sites touristiques", icon: Mountain, exact: false },
  { to: "/admin/annonces", label: "Annonces", icon: Megaphone, exact: false },
  { to: "/admin/notifications", label: "Notifications", icon: Bell, exact: false },
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
    <nav className="flex flex-col gap-1.5">
      {adminLinks.map((link) => {
        const active = isActive(link.to, link.exact);
        return (
          <Link
            key={link.to}
            to={link.to}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--shadow-card)]"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
        className="fixed left-4 top-[calc(1rem+env(safe-area-inset-top,0px))] z-50 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] lg:hidden"
        aria-label="Menu admin"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[var(--shadow-elevated)] transition-transform lg:sticky lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary">
            <Bus className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div><span className="block font-display text-sm font-bold">WINA TOUR</span><span className="text-[11px] text-sidebar-foreground/55">Administration</span></div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">{nav}</div>

        <div className="space-y-1 border-t border-sidebar-border p-3">
          <button
            onClick={() => {
              setClientPreview(true);
              setOpen(false);
              navigate({ to: "/espace-client" });
            }}
            className="flex w-full items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
          >
            <Eye className="h-4 w-4" />
            Voir comme client
          </button>
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
