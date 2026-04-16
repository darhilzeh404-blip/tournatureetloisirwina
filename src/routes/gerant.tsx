import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "@tanstack/react-router";
import { Map, BarChart3, LogOut, Menu, CalendarCheck, Users, TrendingUp, Clock, CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/gerant")({
  head: () => ({
    meta: [
      { title: "Espace Gérant — Agence Wina" },
      { name: "description", content: "Gérez vos circuits et réservations." },
    ],
  }),
  component: GerantLayout,
});

interface Circuit {
  id: string;
  nom: string;
  description: string;
}

interface Reservation {
  id: string;
  service_type: string;
  status: string;
  reservation_date: string;
  total_amount: number;
  paid_amount: number;
  details: Record<string, unknown>;
  created_at: string;
}

type TabType = "circuits" | "reservations";

function GerantLayout() {
  const { isAuthenticated, isLoading, role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("circuits");
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (role && role !== "gerant" && role !== "admin"))) {
      navigate({ to: "/connexion" });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch assigned circuits
        const { data: userCircuits } = await supabase
          .from("user_circuits")
          .select("circuit_id")
          .eq("user_id", user.id);

        if (userCircuits && userCircuits.length > 0) {
          const circuitIds = userCircuits.map((uc) => uc.circuit_id);
          const { data: circuitData } = await supabase
            .from("circuits")
            .select("*")
            .in("id", circuitIds);
          setCircuits(circuitData || []);
        } else {
          setCircuits([]);
        }

        // Fetch CIRCUIT_TOURISTIQUE reservations (gérant can see all of them)
        const { data: resData } = await supabase
          .from("reservations")
          .select("*")
          .eq("service_type", "CIRCUIT_TOURISTIQUE")
          .order("created_at", { ascending: false });
        setReservations((resData as Reservation[]) || []);
      } catch (err) {
        console.error("[GERANT] Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><p>Chargement...</p></div>;
  if (!isAuthenticated || (role !== "gerant" && role !== "admin")) return null;

  const tabs = [
    { key: "circuits" as TabType, label: "Mes Circuits", icon: Map },
    { key: "reservations" as TabType, label: "Réservations", icon: CalendarCheck },
  ];

  const statusBadge = (s: string) => {
    switch (s) {
      case "PENDING_PAYMENT": return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">En attente</Badge>;
      case "CONFIRMED": return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Confirmée</Badge>;
      case "REJECTED": return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Rejetée</Badge>;
      case "CANCELLED": return <Badge className="bg-muted text-muted-foreground">Annulée</Badge>;
      default: return <Badge variant="secondary">{s}</Badge>;
    }
  };

  const confirmed = reservations.filter((r) => r.status === "CONFIRMED").length;
  const pending = reservations.filter((r) => r.status === "PENDING_PAYMENT").length;
  const totalRevenue = reservations
    .filter((r) => r.status === "CONFIRMED")
    .reduce((sum, r) => sum + r.paid_amount, 0);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <Map className="h-5 w-5 text-primary" />
          <span className="font-bold">Espace Gérant</span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSidebarOpen(false); }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t p-3 space-y-1">
          <Link to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
            ← Retour au site
          </Link>
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
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2"><Map className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{circuits.length}</p>
                  <p className="text-xs text-muted-foreground">Circuits</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-blue-500/10 p-2"><CalendarCheck className="h-5 w-5 text-blue-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{reservations.length}</p>
                  <p className="text-xs text-muted-foreground">Réservations</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-green-500/10 p-2"><CheckCircle className="h-5 w-5 text-green-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{confirmed}</p>
                  <p className="text-xs text-muted-foreground">Confirmées</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-yellow-500/10 p-2"><TrendingUp className="h-5 w-5 text-yellow-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Revenus (FCFA)</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {activeTab === "circuits" && (
            <>
              <h1 className="text-2xl font-bold">Mes Circuits</h1>
              <p className="mt-1 text-sm text-muted-foreground">Circuits touristiques sous votre gestion.</p>
              {loading ? (
                <div className="mt-6 text-center text-muted-foreground">Chargement...</div>
              ) : circuits.length === 0 ? (
                <div className="mt-6 rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                  <Map className="mx-auto h-12 w-12 opacity-30" />
                  <p className="mt-3">Aucun circuit assigné pour le moment.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {circuits.map((c) => {
                    const circuitReservations = reservations.filter(
                      (r) => {
                        const details = r.details as Record<string, unknown>;
                        return details?.circuit_id === c.id || details?.circuit === c.nom;
                      }
                    );
                    return (
                      <Card key={c.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="rounded-lg bg-primary/10 p-2.5 mt-0.5">
                              <Map className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold">{c.nom}</h3>
                              <p className="text-sm text-muted-foreground mt-0.5">{c.description || "Aucune description"}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><CalendarCheck className="h-3 w-3" />{circuitReservations.length} réservation(s)</span>
                              </div>
                            </div>
                            <Badge variant="secondary">Actif</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === "reservations" && (
            <>
              <h1 className="text-2xl font-bold">Réservations Circuits</h1>
              <p className="mt-1 text-sm text-muted-foreground">Toutes les réservations de circuits touristiques.</p>
              {loading ? (
                <div className="mt-6 text-center text-muted-foreground">Chargement...</div>
              ) : reservations.length === 0 ? (
                <div className="mt-6 rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                  <CalendarCheck className="mx-auto h-12 w-12 opacity-30" />
                  <p className="mt-3">Aucune réservation pour le moment.</p>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead className="text-right">Payé</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reservations.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            {new Date(r.reservation_date).toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell className="text-right">{r.total_amount.toLocaleString()} F</TableCell>
                          <TableCell className="text-right">{r.paid_amount.toLocaleString()} F</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
