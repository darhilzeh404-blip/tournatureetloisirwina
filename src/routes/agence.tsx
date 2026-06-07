import { createFileRoute, Outlet, Link, Navigate, useLocation, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, Ticket, UserCog, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/agence")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw redirect({ to: "/connexion" });
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", session.user.id).limit(1).single();
    if (roleRow?.role !== "agence" && roleRow?.role !== "admin") throw redirect({ to: "/" });
  },
  component: AgenceLayout,
});

function AgenceLayout() {
  const { isLoading, isAuthenticated, role, signOut } = useAuth();
  const location = useLocation();

  if (isLoading) return <p className="p-10 text-center text-sm text-muted-foreground">Chargement…</p>;
  if (!isAuthenticated) return <Navigate to="/connexion" />;
  if (role !== "agence" && role !== "admin") return <Navigate to="/" />;

  const links = [
    { to: "/agence", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
    { to: "/agence/billets", label: "Mes billets", icon: Ticket },
    { to: "/agence/profil", label: "Profil agence", icon: UserCog },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <h1 className="text-lg font-bold">Espace Agence</h1>
          <button onClick={() => signOut()} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-5 pb-3">
          {links.map((l) => {
            const active = l.exact ? location.pathname === l.to : location.pathname.startsWith(l.to);
            return (
              <Link key={l.to} to={l.to} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                <l.icon className="h-3.5 w-3.5" /> {l.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}
