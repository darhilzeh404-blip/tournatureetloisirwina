import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, CheckCircle, XCircle, AlertCircle, Compass, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ReservationListSkeleton } from "@/components/skeletons";
import type { Database } from "@/integrations/supabase/types";

type ReservationStatus = Database["public"]["Enums"]["reservation_status"];
type ServiceType = Database["public"]["Enums"]["service_type"];

interface Reservation {
  id: string;
  service_type: ServiceType;
  reservation_date: string;
  total_amount: number;
  paid_amount: number;
  status: ReservationStatus;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const Route = createFileRoute("/mes-reservations")({
  head: () => ({
    meta: [
      { title: "Mes Réservations — Agence Wina" },
      { name: "description", content: "Suivez vos réservations de transport et circuits touristiques." },
    ],
  }),
  component: MesReservationsPage,
});

const STATUS_CONFIG: Record<ReservationStatus, { label: string; icon: React.ReactNode; className: string }> = {
  PENDING_PAYMENT: { label: "En attente de paiement", icon: <Clock className="h-4 w-4" />, className: "bg-warning/10 text-warning-foreground border-warning/30" },
  CONFIRMED: { label: "Confirmée", icon: <CheckCircle className="h-4 w-4" />, className: "bg-success/10 text-success border-success/30" },
  REJECTED: { label: "Refusée", icon: <XCircle className="h-4 w-4" />, className: "bg-destructive/10 text-destructive border-destructive/30" },
  CANCELLED: { label: "Annulée", icon: <AlertCircle className="h-4 w-4" />, className: "bg-muted text-muted-foreground border-muted" },
};

const SERVICE_LABEL: Record<ServiceType, string> = {
  TRANSPORT_SCOLAIRE: "Transport Scolaire",
  LOCATION_BUS: "Location de Bus",
  CIRCUIT_TOURISTIQUE: "Circuit Touristique",
};

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function summarize(details: Record<string, unknown> | null, type: ServiceType): string {
  if (!details) return SERVICE_LABEL[type];
  const d = details as Record<string, string | number | boolean>;
  if (type === "CIRCUIT_TOURISTIQUE") {
    const dest = d.destination || d.circuit;
    const persons = d.persons ? ` — ${d.persons} pers.` : "";
    const days = d.days ? ` — ${d.days} jour(s)` : "";
    return `${dest ?? "Destination"}${persons}${days}`;
  }
  if (type === "TRANSPORT_SCOLAIRE") {
    const route = d.trajet || d.route;
    const formula = d.formule ? ` — ${d.formule}` : "";
    const kids = d.children || d.enfants;
    return `${route ?? "Trajet"}${formula}${kids ? ` — ${kids} enfant(s)` : ""}`;
  }
  if (type === "LOCATION_BUS") {
    const seats = d.places || d.seats;
    const event = d.evenement || d.event;
    return `${seats ? `Bus ${seats} places` : "Bus"}${event ? ` — ${event}` : ""}`;
  }
  return SERVICE_LABEL[type];
}

function MesReservationsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/connexion" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("reservations")
      .select("id, service_type, reservation_date, total_amount, paid_amount, status, details, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
        } else {
          setReservations((data as Reservation[]) ?? []);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
      <h1 className="text-2xl font-bold">Mes Réservations</h1>
      <p className="mt-1 text-sm text-muted-foreground">Suivez le statut de toutes vos réservations.</p>

      <div className="mt-8">
        {loading ? (
          <ReservationListSkeleton count={4} />
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
            Impossible de charger vos réservations. {error}
          </div>
        ) : reservations.length === 0 ? (
          <div className="rounded-2xl border bg-card p-10 text-center">
            <Compass className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <h2 className="mt-4 text-lg font-bold">Aucune réservation pour le moment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Découvrez nos circuits et transports pour commencer votre prochaine aventure.
            </p>
            <Link
              to="/circuits"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Explorer les voyages <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {reservations.map((res) => {
              const cfg = STATUS_CONFIG[res.status];
              return (
                <div key={res.id} className="card-hover rounded-2xl border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">
                          #{res.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <h3 className="mt-1 font-bold text-card-foreground">
                        {SERVICE_LABEL[res.service_type]}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {summarize(res.details, res.service_type)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Date : {new Date(res.reservation_date).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-lg font-bold">{formatXAF(res.total_amount)}</p>
                      {res.paid_amount > 0 && (
                        <p className="text-xs text-accent">Payé : {formatXAF(res.paid_amount)}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
