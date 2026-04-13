import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle, XCircle, Eye, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/reservations")({
  component: AdminReservations,
});

type Status = "PENDING_PAYMENT" | "CONFIRMED" | "REJECTED" | "CANCELLED";

interface Reservation {
  id: string;
  client: string;
  type: string;
  details: string;
  date: string;
  total: number;
  paid: number;
  status: Status;
}

const INITIAL: Reservation[] = [
  { id: "RES-127", client: "Marie Ndong", type: "Transport Scolaire", details: "Akanda ↔ Libreville — VIP — 1 enfant", date: "2026-04-15", total: 150000, paid: 75000, status: "PENDING_PAYMENT" },
  { id: "RES-126", client: "Pierre Obame", type: "Location Bus", details: "Bus 32 places — Standard — Mariage", date: "2026-05-10", total: 180000, paid: 90000, status: "CONFIRMED" },
  { id: "RES-125", client: "Alice Mba", type: "Circuit", details: "Parc national de Pongara", date: "2026-04-20", total: 85000, paid: 42500, status: "CONFIRMED" },
  { id: "RES-124", client: "Jean Nzeng", type: "Transport Scolaire", details: "Owendo ↔ Libreville — Standard — 2 enfants", date: "2026-04-18", total: 160000, paid: 80000, status: "REJECTED" },
  { id: "RES-123", client: "Sophie Ondo", type: "Location Bus", details: "Bus 16 places — VIP — Excursion", date: "2026-05-02", total: 250000, paid: 125000, status: "PENDING_PAYMENT" },
  { id: "RES-122", client: "Eric Mba", type: "Circuit", details: "Cocobeach", date: "2026-04-25", total: 65000, paid: 32500, status: "CANCELLED" },
];

const STATUS_MAP: Record<Status, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING_PAYMENT: { label: "En attente", variant: "outline" },
  CONFIRMED: { label: "Confirmée", variant: "default" },
  REJECTED: { label: "Refusée", variant: "destructive" },
  CANCELLED: { label: "Annulée", variant: "secondary" },
};

function formatXAF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " XAF";
}

function AdminReservations() {
  const [reservations, setReservations] = useState(INITIAL);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const filtered = reservations.filter((r) => {
    const matchSearch = r.client.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase());
    if (tab === "all") return matchSearch;
    return matchSearch && r.status === tab;
  });

  const updateStatus = (id: string, status: Status) => {
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Réservations</h1>
        <p className="text-sm text-muted-foreground">Gérez toutes les réservations clients</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par ID ou client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Toutes ({reservations.length})</TabsTrigger>
          <TabsTrigger value="PENDING_PAYMENT">En attente ({reservations.filter((r) => r.status === "PENDING_PAYMENT").length})</TabsTrigger>
          <TabsTrigger value="CONFIRMED">Confirmées ({reservations.filter((r) => r.status === "CONFIRMED").length})</TabsTrigger>
          <TabsTrigger value="REJECTED">Refusées ({reservations.filter((r) => r.status === "REJECTED").length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="p-4">ID</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Type</th>
                    <th className="p-4 hidden md:table-cell">Détails</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Payé</th>
                    <th className="p-4">Statut</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const st = STATUS_MAP[r.status];
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-4 font-medium">{r.id}</td>
                        <td className="p-4">{r.client}</td>
                        <td className="p-4">{r.type}</td>
                        <td className="p-4 hidden md:table-cell text-muted-foreground">{r.details}</td>
                        <td className="p-4">{r.date}</td>
                        <td className="p-4 font-medium">{formatXAF(r.total)}</td>
                        <td className="p-4">{formatXAF(r.paid)}</td>
                        <td className="p-4">
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            {r.status === "PENDING_PAYMENT" && (
                              <>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-success" title="Confirmer" onClick={() => updateStatus(r.id, "CONFIRMED")}>
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Rejeter" onClick={() => updateStatus(r.id, "REJECTED")}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Voir">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">Aucune réservation trouvée.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
