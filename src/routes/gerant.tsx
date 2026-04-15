import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "@tanstack/react-router";
import { Map, BarChart3, LogOut, Menu } from "lucide-react";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/gerant")({
  head: () => ({
    meta: [
      { title: "Espace Gérant — Agence Wina" },
      { name: "description", content: "Gérez vos circuits et réservations." },
    ],
  }),
  component: GerantLayout,
});

function GerantLayout() {
  const { isAuthenticated, isLoading, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (role && role !== "gerant" && role !== "admin"))) {
      navigate({ to: "/connexion" });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><p>Chargement...</p></div>;
  if (!isAuthenticated || (role !== "gerant" && role !== "admin")) return null;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <Map className="h-5 w-5 text-primary" />
          <span className="font-bold">Espace Gérant</span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          <Link to="/gerant" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary" activeOptions={{ exact: true }} activeProps={{ className: "rounded-lg px-3 py-2 text-sm font-medium bg-secondary" }}>
            <span className="flex items-center gap-2"><Map className="h-4 w-4" /> Mes Circuits</span>
          </Link>
          <Link to="/gerant" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary">
            <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Réservations</span>
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
          <span className="ml-2 font-bold">Espace Gérant</span>
        </div>
        <div className="p-4 lg:p-8">
          <h1 className="text-2xl font-bold">Mes Circuits</h1>
          <p className="mt-1 text-sm text-muted-foreground">Consultez et gérez vos circuits assignés.</p>
          <div className="mt-6 rounded-2xl border bg-card p-8 text-center text-muted-foreground">
            <Map className="mx-auto h-12 w-12 opacity-30" />
            <p className="mt-3">Aucun circuit assigné pour le moment.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
