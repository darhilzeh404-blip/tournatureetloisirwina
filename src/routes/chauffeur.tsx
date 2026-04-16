import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "@tanstack/react-router";
import { Truck, MapPin, LogOut, Menu, Bus, CheckCircle, AlertCircle, Navigation } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/chauffeur")({
  head: () => ({
    meta: [
      { title: "Espace Chauffeur — Agence Wina" },
      { name: "description", content: "Gérez vos trajets et passagers." },
    ],
  }),
  component: ChauffeurLayout,
});

interface Circuit {
  id: string;
  nom: string;
  description: string;
}

interface BusInfo {
  id: string;
  immatriculation: string;
  type: string;
  statut: string;
}

interface Ride {
  id: string;
  pickup: string;
  destination: string;
  price: number;
  status: string;
  driver_id: string | null;
  scheduled_at: string | null;
  notes: string | null;
  created_at: string;
}

type TabType = "courses" | "circuits" | "bus";

function ChauffeurLayout() {
  const { isAuthenticated, isLoading, role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("courses");
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [buses, setBuses] = useState<BusInfo[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (role && role !== "chauffeur" && role !== "admin"))) {
      navigate({ to: "/connexion" });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  const fetchRides = useCallback(async () => {
    const { data } = await supabase
      .from("rides")
      .select("*")
      .order("created_at", { ascending: false });
    setRides((data as Ride[]) || []);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        await fetchRides();

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

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.full_name) {
          const { data: busData } = await supabase
            .from("buses")
            .select("*")
            .ilike("chauffeur", `%${profile.full_name}%`);
          setBuses(busData || []);
        }
      } catch (err) {
        console.error("[CHAUFFEUR] Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, fetchRides]);

  // Realtime subscription for rides
  useEffect(() => {
    const channel = supabase
      .channel("rides-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides" },
        () => {
          fetchRides();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRides]);

  const handleAcceptRide = async (rideId: string) => {
    if (!user) return;
    setAcceptingId(rideId);
    try {
      const { data, error } = await supabase
        .from("rides")
        .update({ status: "en_cours", driver_id: user.id })
        .eq("id", rideId)
        .eq("status", "disponible")
        .select();

      if (error) {
        toast.error("Erreur lors de l'acceptation de la course.");
        console.error("[ACCEPT RIDE]", error);
      } else if (!data || data.length === 0) {
        toast.error("Course déjà prise par un autre chauffeur.");
      } else {
        toast.success("Course acceptée avec succès !");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setAcceptingId(null);
    }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><p>Chargement...</p></div>;
  if (!isAuthenticated || (role !== "chauffeur" && role !== "admin")) return null;

  const availableRides = rides.filter((r) => r.status === "disponible");
  const myRides = rides.filter((r) => r.driver_id === user?.id && r.status === "en_cours");

  const tabs = [
    { key: "courses" as TabType, label: "Courses", icon: Navigation },
    { key: "circuits" as TabType, label: "Mes Circuits", icon: MapPin },
    { key: "bus" as TabType, label: "Mes Bus", icon: Bus },
  ];

  const statusColor = (s: string) => {
    switch (s.toLowerCase()) {
      case "disponible": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "en_cours": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "terminee": return "bg-muted text-muted-foreground";
      case "en service": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "en maintenance": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <Truck className="h-5 w-5 text-primary" />
          <span className="font-bold">Espace Chauffeur</span>
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
          <span className="ml-2 font-bold">Espace Chauffeur</span>
        </div>
        <div className="p-4 lg:p-8">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-green-500/10 p-2"><Navigation className="h-5 w-5 text-green-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{availableRides.length}</p>
                  <p className="text-xs text-muted-foreground">Disponibles</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-blue-500/10 p-2"><CheckCircle className="h-5 w-5 text-blue-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{myRides.length}</p>
                  <p className="text-xs text-muted-foreground">En cours</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2"><MapPin className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{circuits.length}</p>
                  <p className="text-xs text-muted-foreground">Circuits</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {activeTab === "courses" && (
            <>
              {/* My active rides */}
              {myRides.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                    <CheckCircle className="h-5 w-5 text-blue-500" /> Mes courses en cours
                  </h2>
                  <div className="space-y-3">
                    {myRides.map((r) => (
                      <Card key={r.id} className="border-blue-500/30">
                        <CardContent className="flex items-center gap-4 p-4">
                          <div className="rounded-lg bg-blue-500/10 p-2.5">
                            <Navigation className="h-5 w-5 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold">{r.pickup} → {r.destination}</h3>
                            <p className="text-sm text-muted-foreground">{r.price.toLocaleString()} FCFA</p>
                            {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                          </div>
                          <Badge className={statusColor("en_cours")}>En cours</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Available rides */}
              <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-green-500" /> Courses disponibles
              </h2>
              {loading ? (
                <div className="mt-4 text-center text-muted-foreground">Chargement...</div>
              ) : availableRides.length === 0 ? (
                <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                  <Navigation className="mx-auto h-12 w-12 opacity-30" />
                  <p className="mt-3">Aucune course disponible pour le moment.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableRides.map((r) => (
                    <Card key={r.id}>
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-green-500/10 p-2.5">
                          <Navigation className="h-5 w-5 text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold">{r.pickup} → {r.destination}</h3>
                          <p className="text-sm text-muted-foreground">{r.price.toLocaleString()} FCFA</p>
                          {r.scheduled_at && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Prévu: {new Date(r.scheduled_at).toLocaleString("fr-FR")}
                            </p>
                          )}
                          {r.notes && <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAcceptRide(r.id)}
                          disabled={acceptingId === r.id}
                        >
                          {acceptingId === r.id ? "..." : "Accepter"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "circuits" && (
            <>
              <h1 className="text-2xl font-bold">Mes Circuits</h1>
              <p className="mt-1 text-sm text-muted-foreground">Circuits qui vous sont assignés.</p>
              {loading ? (
                <div className="mt-6 text-center text-muted-foreground">Chargement...</div>
              ) : circuits.length === 0 ? (
                <div className="mt-6 rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                  <MapPin className="mx-auto h-12 w-12 opacity-30" />
                  <p className="mt-3">Aucun circuit assigné pour le moment.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {circuits.map((c) => (
                    <Card key={c.id}>
                      <CardContent className="flex items-start gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-2.5 mt-0.5">
                          <MapPin className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold">{c.nom}</h3>
                          <p className="text-sm text-muted-foreground mt-0.5">{c.description || "Aucune description"}</p>
                        </div>
                        <Badge variant="secondary">Actif</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "bus" && (
            <>
              <h1 className="text-2xl font-bold">Mes Bus</h1>
              <p className="mt-1 text-sm text-muted-foreground">Véhicules qui vous sont assignés.</p>
              {loading ? (
                <div className="mt-6 text-center text-muted-foreground">Chargement...</div>
              ) : buses.length === 0 ? (
                <div className="mt-6 rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                  <Bus className="mx-auto h-12 w-12 opacity-30" />
                  <p className="mt-3">Aucun bus assigné pour le moment.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {buses.map((b) => (
                    <Card key={b.id}>
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-blue-500/10 p-2.5">
                          <Bus className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold">{b.immatriculation}</h3>
                          <p className="text-sm text-muted-foreground">{b.type}</p>
                        </div>
                        <Badge className={statusColor(b.statut)}>{b.statut}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
