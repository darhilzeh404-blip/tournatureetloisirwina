import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "@tanstack/react-router";
import { Truck, MapPin, LogOut, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/chauffeur")({
  head: () => ({
    meta: [
      { title: "Espace Chauffeur — Agence Wina" },
      { name: "description", content: "Gérez vos trajets et passagers." },
    ],
  }),
  component: ChauffeurLayout,
});

function ChauffeurLayout() {
  const { isAuthenticated, isLoading, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (role && role !== "chauffeur" && role !== "admin"))) {
      navigate({ to: "/connexion" });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><p>Chargement...</p></div>;
  if (!isAuthenticated || (role !== "chauffeur" && role !== "admin")) return null;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <Truck className="h-5 w-5 text-primary" />
          <span className="font-bold">Espace Chauffeur</span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          <Link to="/chauffeur" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary" activeOptions={{ exact: true }} activeProps={{ className: "rounded-lg px-3 py-2 text-sm font-medium bg-secondary" }}>
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Mes Trajets</span>
          </Link>
        </nav>
        <div className="absolute bottom-0 w-full border-t p-3">
          <button onClick={() => { signOut(); navigate({ to: "/" }); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className="flex-1 overflow-x-hidden">
        <div className="flex h-16 items-center border-b px-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2"><Menu className="h-5 w-5" /></button>
          <span className="ml-2 font-bold">Espace Chauffeur</span>
        </div>
        <div className="p-4 lg:p-8">
          <h1 className="text-2xl font-bold">Mes Trajets</h1>
          <p className="mt-1 text-sm text-muted-foreground">Consultez vos trajets assignés.</p>
          <div className="mt-6 rounded-2xl border bg-card p-8 text-center text-muted-foreground">
            <Truck className="mx-auto h-12 w-12 opacity-30" />
            <p className="mt-3">Aucun trajet assigné pour le moment.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
