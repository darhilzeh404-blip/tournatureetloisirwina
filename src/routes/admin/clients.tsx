import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Mail, Phone, CalendarCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/clients")({
  component: AdminClients,
});

interface Client {
  id: string;
  nom: string;
  email: string;
  telephone: string;
  reservations: number;
  totalDepense: number;
  dernierReservation: string;
}

const CLIENTS: Client[] = [
  { id: "CLI-001", nom: "Marie Ndong", email: "marie@email.com", telephone: "+241 77 12 34 56", reservations: 5, totalDepense: 620000, dernierReservation: "2026-04-15" },
  { id: "CLI-002", nom: "Pierre Obame", email: "pierre@email.com", telephone: "+241 66 98 76 54", reservations: 3, totalDepense: 430000, dernierReservation: "2026-05-10" },
  { id: "CLI-003", nom: "Alice Mba", email: "alice@email.com", telephone: "+241 77 55 44 33", reservations: 2, totalDepense: 170000, dernierReservation: "2026-04-20" },
  { id: "CLI-004", nom: "Jean Nzeng", email: "jean@email.com", telephone: "+241 66 11 22 33", reservations: 4, totalDepense: 380000, dernierReservation: "2026-04-18" },
  { id: "CLI-005", nom: "Sophie Ondo", email: "sophie@email.com", telephone: "+241 77 99 88 77", reservations: 1, totalDepense: 250000, dernierReservation: "2026-05-02" },
  { id: "CLI-006", nom: "Eric Mba", email: "eric@email.com", telephone: "+241 66 44 55 66", reservations: 2, totalDepense: 145000, dernierReservation: "2026-04-25" },
];

function formatXAF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " XAF";
}

function AdminClients() {
  const [search, setSearch] = useState("");

  const filtered = CLIENTS.filter(
    (c) =>
      c.nom.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.telephone.includes(search)
  );

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="text-sm text-muted-foreground">{CLIENTS.length} clients enregistrés</p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher un client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Client cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => (
          <Card key={c.id} className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold">{c.nom}</h3>
                  <p className="text-xs text-muted-foreground">{c.id}</p>
                </div>
                <Badge variant="secondary">{c.reservations} rés.</Badge>
              </div>

              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> {c.email}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> {c.telephone}
                </div>
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-3.5 w-3.5" /> Dernière rés. : {c.dernierReservation}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">Total dépensé</span>
                <span className="font-bold text-primary">{formatXAF(c.totalDepense)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">Aucun client trouvé.</div>
      )}
    </div>
  );
}
