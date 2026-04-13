import { createFileRoute } from "@tanstack/react-router";
import { DollarSign, CalendarCheck, Clock, Users, TrendingUp, Bus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const stats = [
  { label: "Revenus totaux", value: "4 850 000 XAF", icon: DollarSign, delta: "+12%", color: "bg-primary/10 text-primary" },
  { label: "Réservations", value: "127", icon: CalendarCheck, delta: "+8%", color: "bg-accent/10 text-accent" },
  { label: "Paiements en attente", value: "14", icon: Clock, delta: "—", color: "bg-warning/10 text-warning-foreground" },
  { label: "Clients actifs", value: "89", icon: Users, delta: "+5%", color: "bg-success/10 text-success" },
];

const monthlyRevenue = [
  { month: "Jan", montant: 320000 },
  { month: "Fév", montant: 450000 },
  { month: "Mar", montant: 580000 },
  { month: "Avr", montant: 620000 },
  { month: "Mai", montant: 780000 },
  { month: "Jun", montant: 720000 },
];

const serviceBreakdown = [
  { name: "Transport scolaire", value: 45 },
  { name: "Location bus", value: 25 },
  { name: "Circuits", value: 30 },
];

const PIE_COLORS = [
  "oklch(0.45 0.18 250)",
  "oklch(0.55 0.17 155)",
  "oklch(0.65 0.15 75)",
];

const recentReservations = [
  { id: "RES-127", client: "Marie Ndong", type: "Transport Scolaire", montant: 160000, statut: "PENDING_PAYMENT" },
  { id: "RES-126", client: "Pierre Obame", type: "Location Bus", montant: 250000, statut: "CONFIRMED" },
  { id: "RES-125", client: "Alice Mba", type: "Circuit Pongara", montant: 85000, statut: "CONFIRMED" },
  { id: "RES-124", client: "Jean Nzeng", type: "Transport Scolaire", montant: 80000, statut: "REJECTED" },
  { id: "RES-123", client: "Sophie Ondo", type: "Location Bus", montant: 180000, statut: "PENDING_PAYMENT" },
];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING_PAYMENT: { label: "En attente", cls: "bg-warning/10 text-warning-foreground" },
  CONFIRMED: { label: "Confirmée", cls: "bg-success/10 text-success" },
  REJECTED: { label: "Refusée", cls: "bg-destructive/10 text-destructive" },
  CANCELLED: { label: "Annulée", cls: "bg-muted text-muted-foreground" },
};

function formatXAF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " XAF";
}

function AdminDashboard() {
  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble de l'activité Agence Wina</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" /> {s.delta}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenus mensuels</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v: number) => formatXAF(v)} />
                <Bar dataKey="montant" fill="oklch(0.45 0.18 250)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition services</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={serviceBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {serviceBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Legend fontSize={12} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent reservations table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dernières réservations</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="pb-3 pr-4">ID</th>
                <th className="pb-3 pr-4">Client</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Montant</th>
                <th className="pb-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {recentReservations.map((r) => {
                const st = STATUS_LABELS[r.statut];
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{r.id}</td>
                    <td className="py-3 pr-4">{r.client}</td>
                    <td className="py-3 pr-4">{r.type}</td>
                    <td className="py-3 pr-4">{formatXAF(r.montant)}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
