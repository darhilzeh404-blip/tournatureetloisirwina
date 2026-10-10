import { createFileRoute } from "@tanstack/react-router";
import { paymentRevenue, serviceAmount } from "@/lib/app-fees";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Ticket, Building2, Wallet, Users, Bus, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

interface Stats {
  reservations: number;
  pending: number;
  confirmed: number;
  cancelled: number;
  partnerBookings: number;
  activeTickets: number;
  agencies: number;
  clients: number;
  revenue: number;
  commission: number;
  commissionRate: number;
}

const EMPTY: Stats = {
  reservations: 0,
  pending: 0,
  confirmed: 0,
  cancelled: 0,
  partnerBookings: 0,
  activeTickets: 0,
  agencies: 0,
  clients: 0,
  revenue: 0,
  commission: 0,
  commissionRate: 10,
};

function formatXAF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}

function AdminDashboard() {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reservationsRes, paymentsRes, bookingsRes, ticketsRes, agenciesRes, clientsRes, feesRes] =
        await Promise.all([
          supabase.from("reservations").select("status, total_amount, paid_amount, service_amount").limit(5000),
          supabase.from("payments").select("amount, status, reservations(total_amount, service_amount)").eq("status", "VALIDATED").limit(5000),
          supabase.from("partner_bookings").select("status, total_amount").limit(5000),
          supabase.from("partner_tickets").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("partner_agencies").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase
            .from("application_fees")
            .select("amount, fee_type, is_active")
            .eq("is_active", true)
            .limit(20),
        ]);

      if (reservationsRes.error) throw reservationsRes.error;

      const reservations = reservationsRes.data ?? [];
      const payments = paymentsRes.data ?? [];
      const bookings = bookingsRes.data ?? [];

      const paymentsRevenue = payments.reduce((s, p: any) => s + paymentRevenue(Number(p.amount ?? 0), p.reservations), 0);
      const bookingsRevenue = bookings
        .filter((b) => b.status !== "cancelled")
        .reduce((s, b) => s + Number(b.total_amount ?? 0), 0);
      const revenue = paymentsRevenue + bookingsRevenue;

      const percentFee = (feesRes.data ?? []).find((f) => f.fee_type === "percentage");
      const commissionRate = percentFee ? Number(percentFee.amount) : 10;

      setStats({
        reservations: reservations.length,
        pending: reservations.filter((r) => r.status === "PENDING_PAYMENT").length,
        confirmed: reservations.filter((r) => r.status === "CONFIRMED").length,
        cancelled: reservations.filter((r) => r.status === "CANCELLED" || r.status === "REJECTED").length,
        partnerBookings: bookings.length,
        activeTickets: ticketsRes.count ?? 0,
        agencies: agenciesRes.count ?? 0,
        clients: clientsRes.count ?? 0,
        revenue,
        commission: (revenue * commissionRate) / 100,
        commissionRate,
      });
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger les statistiques.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeTable("reservations", () => void load());
  useRealtimeTable("payments", () => void load());
  useRealtimeTable("partner_bookings", () => void load());

  const cards = [
    { label: "Réservations", value: stats.reservations, icon: Ticket, hint: `${stats.pending} en attente` },
    { label: "Confirmées", value: stats.confirmed, icon: Bus, hint: `${stats.cancelled} annulées` },
    { label: "Billets partenaires actifs", value: stats.activeTickets, icon: Ticket, hint: `${stats.partnerBookings} réservations` },
    { label: "Agences partenaires", value: stats.agencies, icon: Building2, hint: "Réseau WINA TOUR" },
    { label: "Clients", value: stats.clients, icon: Users, hint: "Comptes enregistrés" },
  ];

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Données réelles, mises à jour en temps réel</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="card-hover">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <c.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs uppercase text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold">{loading ? "…" : c.value}</p>
                <p className="text-xs text-muted-foreground">{c.hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Wallet className="h-4 w-4" /> Chiffre d'affaires encaissé
            </div>
            <p className="mt-2 text-3xl font-bold text-primary">
              {loading ? "…" : formatXAF(stats.revenue)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Paiements validés + réservations partenaires actives
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Wallet className="h-4 w-4" /> Commission WINA ({stats.commissionRate}%)
            </div>
            <p className="mt-2 text-3xl font-bold">
              {loading ? "…" : formatXAF(stats.commission)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Calculée sur le chiffre d'affaires réel</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
