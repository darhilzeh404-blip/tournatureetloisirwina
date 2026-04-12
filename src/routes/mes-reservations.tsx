import { createFileRoute } from "@tanstack/react-router";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/mes-reservations")({
  head: () => ({
    meta: [
      { title: "Mes Réservations — Agence Wina" },
      { name: "description", content: "Suivez vos réservations de transport et circuits touristiques." },
    ],
  }),
  component: MesReservationsPage,
});

const STATUS_CONFIG = {
  PENDING_PAYMENT: { label: "En attente de paiement", icon: <Clock className="h-4 w-4" />, className: "bg-warning/10 text-warning-foreground border-warning/30" },
  CONFIRMED: { label: "Confirmée", icon: <CheckCircle className="h-4 w-4" />, className: "bg-success/10 text-success border-success/30" },
  REJECTED: { label: "Refusée", icon: <XCircle className="h-4 w-4" />, className: "bg-destructive/10 text-destructive border-destructive/30" },
  CANCELLED: { label: "Annulée", icon: <AlertCircle className="h-4 w-4" />, className: "bg-muted text-muted-foreground border-muted" },
} as const;

const MOCK_RESERVATIONS = [
  { id: "RES-001", type: "Transport Scolaire", details: "Akanda ↔ Libreville — Standard — 2 enfants", date: "2026-04-15", total: 160000, paid: 80000, status: "CONFIRMED" as const },
  { id: "RES-002", type: "Location de Bus", details: "Bus 32 places — VIP — Mariage", date: "2026-05-10", total: 250000, paid: 125000, status: "PENDING_PAYMENT" as const },
  { id: "RES-003", type: "Circuit Touristique", details: "Parc national de Pongara", date: "2026-04-20", total: 85000, paid: 42500, status: "REJECTED" as const },
];

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function MesReservationsPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
      <h1 className="text-2xl font-bold">Mes Réservations</h1>
      <p className="mt-1 text-sm text-muted-foreground">Suivez le statut de toutes vos réservations.</p>

      <div className="mt-8 space-y-4">
        {MOCK_RESERVATIONS.map((res) => {
          const statusCfg = STATUS_CONFIG[res.status];
          return (
            <div key={res.id} className="card-hover rounded-2xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-muted-foreground">{res.id}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusCfg.className}`}>
                      {statusCfg.icon} {statusCfg.label}
                    </span>
                  </div>
                  <h3 className="mt-1 font-bold text-card-foreground">{res.type}</h3>
                  <p className="text-sm text-muted-foreground">{res.details}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Date : {res.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{formatXAF(res.total)}</p>
                  <p className="text-xs text-accent">Payé : {formatXAF(res.paid)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {MOCK_RESERVATIONS.length === 0 && (
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">Aucune réservation pour le moment.</p>
        </div>
      )}
    </section>
  );
}
