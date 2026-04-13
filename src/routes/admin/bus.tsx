import { createFileRoute } from "@tanstack/react-router";
import { Bus, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/bus")({
  component: AdminBus,
});

const FLEET = [
  { id: "BUS-001", type: "32 places", immatriculation: "LBV-1234-A", statut: "Disponible", chauffeur: "Paul Essono", prochaineMission: "—" },
  { id: "BUS-002", type: "16 places", immatriculation: "LBV-5678-B", statut: "En mission", chauffeur: "Jacques Nze", prochaineMission: "RES-126 — 10/05/2026" },
  { id: "BUS-003", type: "32 places", immatriculation: "LBV-9012-C", statut: "Disponible", chauffeur: "André Mbeng", prochaineMission: "—" },
  { id: "BUS-004", type: "14 places", immatriculation: "LBV-3456-D", statut: "Maintenance", chauffeur: "—", prochaineMission: "—" },
  { id: "BUS-005", type: "16 places", immatriculation: "LBV-7890-E", statut: "Disponible", chauffeur: "Samuel Eko", prochaineMission: "RES-123 — 02/05/2026" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Disponible: "default",
  "En mission": "outline",
  Maintenance: "destructive",
};

function AdminBus() {
  const available = FLEET.filter((b) => b.statut === "Disponible").length;

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Flotte Bus</h1>
        <p className="text-sm text-muted-foreground">{FLEET.length} véhicules — {available} disponibles</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {FLEET.map((bus) => (
          <Card key={bus.id} className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Bus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold">{bus.type}</h3>
                    <p className="text-xs text-muted-foreground">{bus.immatriculation}</p>
                  </div>
                </div>
                <Badge variant={STATUS_VARIANT[bus.statut] || "secondary"}>{bus.statut}</Badge>
              </div>

              <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                <p>Chauffeur : <span className="text-foreground">{bus.chauffeur}</span></p>
                <p>Mission : <span className="text-foreground">{bus.prochaineMission}</span></p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
