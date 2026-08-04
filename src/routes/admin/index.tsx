import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DollarSign, CalendarCheck, Clock, Users, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const fmtXAF = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} XAF`;

type Counts = {
  totalRevenue: number;
  reservations: number;
  pendingPayments: number;
  activeClients: number;
};

function AdminDashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        { data: payConfirmed },
        { count: reservationsCount },
        { count: pendingCount },
        { count: clientsCount },
      ] = await Promise.all([
        supabase.from("payments").select("amount").eq("status", "VALIDATED" as any),
        supabase.from("reservations").select("*", { count: "exact", head: true }).is("archived_at", null),
        supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "PENDING" as any),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "actif"),
      ]);
      const totalRevenue = (payConfirmed ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
      setCounts({
        totalRevenue,
        reservations: reservationsCount ?? 0,
        pendingPayments: pendingCount ?? 0,
        activeClients: clientsCount ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Revenus encaissés", value: counts ? fmtXAF(counts.totalRevenue) : "—", icon: DollarSign, color: "bg-primary/10 text-primary" },
    { label: "Réservations", value: counts?.reservations ?? "—", icon: CalendarCheck, color: "bg-accent/10 text-accent-foreground" },
    { label: "Paiements en attente", value: counts?.pendingPayments ?? "—", icon: Clock, color: "bg-warning/10 text-warning-foreground" },
    { label: "Clients actifs", value: counts?.activeClients ?? "—", icon: Users, color: "bg-success/10 text-success" },
  ];

  const quickLinks = [
  { to: "/admin/reservations", label: "Réservations" },
  { to: "/admin/demenagements", label: "Déménagements" },
  { to: "/admin/paiements", label: "Paiements" },
  { to: "/admin/billets", label: "Billets" },
  { to: "/admin/bus-billetterie", label: "Billetterie Bus" },
  { to: "/admin/vtc-chauffeurs", label: "VTC Chauffeurs" },
  { to: "/admin/vehicule-types", label: "Types véhicules" },
  { to: "/admin/circuits", label: "Circuits" },
  { to: "/admin/transport-scolaire", label: "Transport scolaire" },
] as const;
  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble — données en temps réel</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{loading ? "…" : s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accès rapides</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {quickLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm font-medium hover:bg-accent transition-colors"
            >
              {l.label}
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
