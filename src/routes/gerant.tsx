import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { MapIcon, LogOut, Menu, CalendarCheck, Users, Eye, Phone, Mail, X } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/gerant")({
  head: () => ({
    meta: [
      { title: "Espace Gérant — Agence Wina" },
      { name: "description", content: "Suivi en lecture seule de vos circuits assignés." },
    ],
  }),
  component: GerantLayout,
});

interface Circuit { id: string; nom: string; description: string }
interface Reservation {
  id: string;
  user_id: string;
  status: string;
  reservation_date: string;
  total_amount: number;
  paid_amount: number;
  details: Record<string, unknown>;
  created_at: string;
}
interface Profile { user_id: string; full_name: string; email: string | null; phone: string | null }

type TabType = "circuits" | "reservations" | "clients";

function GerantLayout() {
  const { isAuthenticated, isLoading, role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("circuits");
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Reservation | null>(null);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (role && role !== "gerant" && role !== "admin"))) {
      navigate({ to: "/connexion" });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      try {
        // 1. circuits assigned to this gerant
        const { data: uc } = await supabase
          .from("user_circuits")
          .select("circuit_id")
          .eq("user_id", user.id);

        const circuitIds = (uc ?? []).map((x) => x.circuit_id);
        let circuitData: Circuit[] = [];
        if (circuitIds.length > 0) {
          const { data } = await supabase
            .from("circuits")
            .select("id, nom, description")
            .in("id", circuitIds);
          circuitData = data ?? [];
        }
        if (cancelled) return;
        setCircuits(circuitData);

        // 2. reservations — RLS already filters to assigned circuits only
        const { data: resData } = await supabase
          .from("reservations")
          .select("id, user_id, status, reservation_date, total_amount, paid_amount, details, created_at")
          .eq("service_type", "CIRCUIT_TOURISTIQUE")
          .order("created_at", { ascending: false });
        const reservs = (resData as Reservation[]) ?? [];
        if (cancelled) return;
        setReservations(reservs);

        // 3. client profiles — RLS allows only profiles of clients linked to our reservations
        const userIds = Array.from(new Set(reservs.map((r) => r.user_id)));
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, full_name, email, phone")
            .in("user_id", userIds);
          const map = new Map<string, Profile>();
          (profs ?? []).forEach((p) => map.set(p.user_id, p as Profile));
          if (!cancelled) setProfiles(map);
        }
      } catch (err) {
        console.error("[GERANT] fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [user]);

  const clients = useMemo(() => {
    const seen = new Map<string, { profile: Profile | undefined; count: number }>();
    reservations.forEach((r) => {
      const cur = seen.get(r.user_id);
      seen.set(r.user_id, {
        profile: profiles.get(r.user_id),
        count: (cur?.count ?? 0) + 1,
      });
    });
    return Array.from(seen.entries()).map(([user_id, v]) => ({ user_id, ...v }));
  }, [reservations, profiles]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><p>Chargement...</p></div>;
  if (!isAuthenticated || (role !== "gerant" && role !== "admin")) return null;

  const tabs = [
    { key: "circuits" as TabType, label: "Mes Circuits", icon: MapIcon, count: circuits.length },
    { key: "reservations" as TabType, label: "Réservations", icon: CalendarCheck, count: reservations.length },
    { key: "clients" as TabType, label: "Clients", icon: Users, count: clients.length },
  ];

  const statusBadge = (s: string) => {
    switch (s) {
      case "PENDING_PAYMENT": return <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20">En attente paiement</Badge>;
      case "CONFIRMED": return <Badge className="bg-green-500/10 text-green-700 border-green-500/20">Confirmée</Badge>;
      case "REJECTED": return <Badge className="bg-red-500/10 text-red-700 border-red-500/20">Rejetée</Badge>;
      case "CANCELLED": return <Badge className="bg-muted text-muted-foreground">Annulée</Badge>;
      default: return <Badge variant="secondary">{s}</Badge>;
    }
  };

  const circuitLabel = (r: Reservation) => {
    const d = r.details ?? {};
    const cid = (d as Record<string, unknown>).circuit_id as string | undefined;
    const cname = (d as Record<string, unknown>).circuit as string | undefined;
    if (cid) {
      const c = circuits.find((c) => c.id === cid);
      if (c) return c.nom;
    }
    return cname ?? "—";
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <MapIcon className="h-5 w-5 text-primary" />
          <span className="font-bold">Espace Gérant</span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSidebarOpen(false); }}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              <span className="flex items-center gap-2"><tab.icon className="h-4 w-4" />{tab.label}</span>
              <span className={`text-xs rounded-full px-2 py-0.5 ${activeTab === tab.key ? "bg-primary-foreground/20" : "bg-muted"}`}>{tab.count}</span>
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
          {/* Read-only banner */}
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-700">
            <Eye className="h-4 w-4 shrink-0" />
            <span>Mode <strong>lecture seule</strong> — Vous suivez l'activité de vos circuits assignés. Toute action (validation, modification, paiement) est réservée à l'administrateur.</span>
          </div>

          {activeTab === "circuits" && (
            <>
              <h1 className="text-2xl font-bold">Mes Circuits</h1>
              <p className="mt-1 text-sm text-muted-foreground">Circuits touristiques sous votre supervision.</p>
              {loading ? (
                <div className="mt-4"><CircuitGridSkeleton count={4} /></div>
              ) : circuits.length === 0 ? (
                <div className="mt-6 rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                  <MapIcon className="mx-auto h-12 w-12 opacity-30" />
                  <p className="mt-3">Aucun circuit assigné. Contactez l'administrateur.</p>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {circuits.map((c) => {
                    const linked = reservations.filter((r) => circuitLabel(r) === c.nom);
                    return (
                      <Card key={c.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-primary/10 p-2.5"><MapIcon className="h-5 w-5 text-primary" /></div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold">{c.nom}</h3>
                              <p className="text-sm text-muted-foreground mt-0.5">{c.description || "Aucune description"}</p>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {linked.length} réservation(s) · {linked.filter(r => r.status === "CONFIRMED").length} confirmée(s)
                              </div>
                            </div>
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
              <h1 className="text-2xl font-bold">Réservations</h1>
              <p className="mt-1 text-sm text-muted-foreground">Toutes les réservations sur vos circuits assignés.</p>
              {loading ? (
                <div className="mt-4"><ReservationListSkeleton count={5} /></div>
              ) : reservations.length === 0 ? (
                <div className="mt-6 rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                  <CalendarCheck className="mx-auto h-12 w-12 opacity-30" />
                  <p className="mt-3">Aucune réservation pour vos circuits.</p>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border overflow-x-auto bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Circuit</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Détails</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reservations.map((r) => {
                        const p = profiles.get(r.user_id);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{new Date(r.reservation_date).toLocaleDateString("fr-FR")}</TableCell>
                            <TableCell>{p?.full_name || <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell>{circuitLabel(r)}</TableCell>
                            <TableCell>{statusBadge(r.status)}</TableCell>
                            <TableCell className="text-right">
                              <button onClick={() => setSelected(r)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-secondary">
                                <Eye className="h-3 w-3" /> Voir
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}

          {activeTab === "clients" && (
            <>
              <h1 className="text-2xl font-bold">Clients</h1>
              <p className="mt-1 text-sm text-muted-foreground">Clients ayant réservé sur vos circuits.</p>
              {loading ? (
                <div className="mt-4"><CircuitGridSkeleton count={4} /></div>
              ) : clients.length === 0 ? (
                <div className="mt-6 rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 opacity-30" />
                  <p className="mt-3">Aucun client pour le moment.</p>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {clients.map((c) => (
                    <Card key={c.user_id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-full bg-primary/10 h-10 w-10 flex items-center justify-center text-sm font-bold text-primary">
                            {(c.profile?.full_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{c.profile?.full_name || "Client"}</h3>
                            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                              {c.profile?.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {c.profile.email}</div>}
                              {c.profile?.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.profile.phone}</div>}
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">{c.count} réservation(s)</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Read-only reservation detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Détail réservation</h2>
              <button onClick={() => setSelected(null)} className="rounded-md p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Circuit</div>
                <div className="font-medium">{circuitLabel(selected)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Date</div>
                <div className="font-medium">{new Date(selected.reservation_date).toLocaleDateString("fr-FR")}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Statut</div>
                <div>{statusBadge(selected.status)}</div>
              </div>
              {(() => {
                const p = profiles.get(selected.user_id);
                if (!p) return null;
                return (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground mb-1">Client</div>
                    <div className="font-medium">{p.full_name}</div>
                    {p.email && <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</div>}
                    {p.phone && <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</div>}
                  </div>
                );
              })()}
              <div className="text-xs text-muted-foreground italic flex items-center gap-1.5 pt-2 border-t">
                <Eye className="h-3 w-3" /> Lecture seule. Pour toute action, contactez l'administrateur.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
