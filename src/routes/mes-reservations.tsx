import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, CheckCircle, XCircle, AlertCircle, Compass, ArrowRight, Wallet, Loader2, MapPin, Radio, Users, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useShareClientPosition } from "@/hooks/use-client-position";
import { ReservationListSkeleton } from "@/components/skeletons";
import { TripEtaInline } from "@/components/TripEtaInline";
import { ClientNav } from "@/components/ClientNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { downloadTrainReceipt } from "@/lib/train-receipt";
import { downloadBoatReceipt } from "@/lib/boat-receipt";

/** Reçu PDF d'une réservation de billet (train ou navire). */
function downloadTrainReceiptFor(res: { id: string; total_amount: number; paid_amount: number; created_at: string; reference_code?: string | null; details: Record<string, unknown> | null }) {
  const d = (res.details ?? {}) as Record<string, any>;
  if (d.mode === "bateau") {
    downloadBoatReceipt({
      reference: d.reference_code ?? res.reference_code ?? res.id.slice(0, 8).toUpperCase(),
      agency: d.agency ?? "—",
      vessel: d.vessel ?? "—",
      origin: d.origin ?? "—",
      destination: d.destination ?? "—",
      departureDate: d.departure_date ? new Date(d.departure_date).toLocaleDateString("fr-FR") : "—",
      departureTime: d.departure_time ? String(d.departure_time).slice(0, 5) : null,
      returnDate: d.return_date ? new Date(d.return_date).toLocaleDateString("fr-FR") : null,
      passenger: d.passenger_name ?? "—",
      passengerPhone: d.passenger_phone ?? null,
      passengerEmail: d.passenger_email ?? null,
      adults: d.adults ?? 0,
      children: d.children ?? 0,
      infants: d.infants ?? 0,
      passengers: d.passengers ?? [],
      baggageKg: d.baggage_kg ?? 0,
      baggageFee: d.baggage_fee ?? 0,
      services: d.services ?? [],
      amountPaid: res.paid_amount || res.total_amount,
      paidAt: new Date(res.created_at).toLocaleString("fr-FR"),
    });
    toast.success("Reçu PDF téléchargé");
    return;
  }
  downloadTrainReceipt({
    reference: d.reference_code ?? res.reference_code ?? res.id.slice(0, 8).toUpperCase(),
    agency: d.agency ?? "—",
    trainType: d.train_type ?? "—",
    travelClass: d.travel_class ?? "—",
    departureDate: d.departure_date ? new Date(d.departure_date).toLocaleDateString("fr-FR") : "—",
    origin: d.station_from ?? d.origin ?? "—",
    destination: d.station_to ?? d.destination ?? "—",
    passenger: d.passenger_name ?? "—",
    passengerPhone: d.passenger_phone ?? null,
    passengerEmail: d.passenger_email ?? null,
    idDocument: d.id_document_label ?? null,
    children: d.children ?? [],
    baggageCount: d.baggage_count ?? 0,
    baggageFee: d.baggage_fee ?? 0,
    grossTotal: d.gross_total,
    discountLines: d.discounts ?? [],
    amountPaid: res.paid_amount || res.total_amount,
    paidAt: new Date(res.created_at).toLocaleString("fr-FR"),
  });
  toast.success("Reçu PDF téléchargé");
}

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
  trip_id?: string | null;
  reference_code?: string | null;
  agent_code?: string | null;
}

interface GroupRideRow {
  id: string;
  status: string;
  price_per_seat: number;
  seats_taken: number;
  max_seats: number;
  departure_deadline: string;
  created_at: string;
  passenger_status: string;
  seat_index: number;
  pickup_address: string | null;
  destination_address: string | null;
  route_name: string | null;
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
  VTC: "Transfert privé VTC",
  BILLET: "Billet",
  LOCATION_CATALOGUE: "Location véhicule (catalogue)",
};

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function summarize(details: Record<string, unknown> | null, type: ServiceType): string {
  if (!details) return SERVICE_LABEL[type];
  const d = details as Record<string, string | number | boolean>;
  if (type === "VTC") {
    if (d.flow === "vtc_subscription") {
      return `${d.plan_label ?? "Abonnement Berline"} — ${d.duration_label ?? "1 mois"}`;
    }
    if (d.flow === "vtc_mariage") {
      return `Mariage — ${d.vehicle_label ?? "Berline"} · ${d.duration_hours ?? ""}h`;
    }
    if (d.flow === "vtc_group") {
      const pickupLbl = (d.pickup as any)?.label ?? "Départ";
      const dests = ((d.destinations as unknown) as any[] | undefined)?.map((s) => s?.label).filter(Boolean) ?? [];
      const pax = d.passengers ? ` · ${d.passengers} pers.` : "";
      return `Course de groupe — ${pickupLbl} → ${dests.join(" → ") || "Destination"}${pax}`;
    }
    const pickup = (d.pickup as any)?.label ?? d.pickup ?? "Départ";
    const dest = (d.destination as any)?.label ?? d.destination ?? "Arrivée";
    return `${pickup} → ${dest}${d.category_label ? ` — ${d.category_label}` : ""}`;
  }
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
  const [payTarget, setPayTarget] = useState<Reservation | null>(null);
  const [groupRides, setGroupRides] = useState<GroupRideRow[]>([]);

  // Trouve un trip actif (pending|active) pour partager auto la position
  const activeTripId = reservations.find(
    (r) => r.trip_id && (r.status === "CONFIRMED")
  )?.trip_id ?? null;
  const { sharing, error: gpsError } = useShareClientPosition(user?.id ?? null, activeTripId);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/connexion" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, service_type, reservation_date, total_amount, paid_amount, status, details, created_at, reference_code, agent_code")
        .eq("user_id", user.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const list = (data as Reservation[]) ?? [];
      // Attach trip_id if a trip exists for this reservation
      if (list.length > 0) {
        const ids = list.map((r) => r.id);
        const { data: trips } = await supabase
          .from("trips")
          .select("id, reservation_id")
          .in("reservation_id", ids)
          .is("archived_at", null);
        const tripMap: Record<string, string> = {};
        (trips ?? []).forEach((t) => (tripMap[t.reservation_id] = t.id));
        list.forEach((r) => (r.trip_id = tripMap[r.id] ?? null));
      }
      setReservations(list);
      setLoading(false);
    })();

    // Realtime: mise à jour automatique quand l'admin modifie une réservation
    const channel = supabase
      .channel(`reservations-user-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            const updated = payload.new as Reservation & { archived_at?: string | null };
            if (updated.archived_at) {
              setReservations((prev) => prev.filter((r) => r.id !== updated.id));
              return;
            }
            setReservations((prev) =>
              prev.map((r) => (r.id === updated.id ? { ...r, ...updated, trip_id: r.trip_id } : r))
            );
            if (payload.old && (payload.old as Reservation).status !== updated.status) {
              if (updated.status === "CONFIRMED") toast.success("Votre réservation a été confirmée ✅");
              else if (updated.status === "REJECTED") toast.error("Votre paiement a été refusé. Voir les détails.");
            }
          } else if (payload.eventType === "INSERT" && payload.new) {
            const created = payload.new as Reservation;
            setReservations((prev) => (prev.find((r) => r.id === created.id) ? prev : [created, ...prev]));
          } else if (payload.eventType === "DELETE" && payload.old) {
            const removed = payload.old as Reservation;
            setReservations((prev) => prev.filter((r) => r.id !== removed.id));
          }
        }
      )
      .subscribe();

    // Realtime trips: dès qu'un trip est créé/MAJ pour ce client, on attache le trip_id
    // pour faire apparaître le bouton "Suivre en direct" sans rechargement.
    const tripsChannel = supabase
      .channel(`trips-client-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips", filter: `client_id=eq.${user.id}` },
        (payload) => {
          const t = (payload.new ?? payload.old) as { id: string; reservation_id: string; archived_at?: string | null; status?: string } | null;
          if (!t) return;
          const isGone = payload.eventType === "DELETE" || !!t.archived_at || t.status === "completed" || t.status === "cancelled";
          if (isGone) {
            setReservations((prev) =>
              prev.map((r) => (r.id === t.reservation_id ? { ...r, trip_id: null } : r))
            );
          } else {
            setReservations((prev) =>
              prev.map((r) => (r.id === t.reservation_id ? { ...r, trip_id: t.id } : r))
            );
            if (payload.eventType === "INSERT") {
              toast.success("Votre course est prête, vous pouvez la suivre en direct 📍");
            }
          }
        }
      )
      .subscribe();

    // Fetch group rides (courses de groupe actives où l'utilisateur est passager)
    const ACTIVE_STATUSES = ["searching", "matched", "driver_arriving", "active"];
    const loadGroupRides = async () => {
      const { data: pax } = await supabase
        .from("group_ride_passengers")
        .select("ride_id, status, seat_index, pickup_address, destination_address, joined_at, group_rides!inner(id, status, price_per_seat, seats_taken, max_seats, departure_deadline, created_at, archived_at, route_id)")
        .eq("user_id", user.id)
        .neq("status", "cancelled")
        .order("joined_at", { ascending: false });
      const active = (pax ?? []).filter((row: any) => {
        const r = row.group_rides;
        return r && r.archived_at === null && ACTIVE_STATUSES.includes(r.status);
      });
      const routeIds = Array.from(new Set(active.map((row: any) => row.group_rides.route_id).filter(Boolean)));
      let routeMap: Record<string, string> = {};
      if (routeIds.length > 0) {
        const { data: routes } = await supabase
          .from("group_routes")
          .select("id, name")
          .in("id", routeIds);
        (routes ?? []).forEach((rt: any) => (routeMap[rt.id] = rt.name));
      }
      if (cancelled) return;
      setGroupRides(active.map((row: any) => ({
        id: row.group_rides.id,
        status: row.group_rides.status,
        price_per_seat: row.group_rides.price_per_seat,
        seats_taken: row.group_rides.seats_taken,
        max_seats: row.group_rides.max_seats,
        departure_deadline: row.group_rides.departure_deadline,
        created_at: row.group_rides.created_at,
        passenger_status: row.status,
        seat_index: row.seat_index,
        pickup_address: row.pickup_address,
        destination_address: row.destination_address,
        route_name: row.group_rides.route_id ? routeMap[row.group_rides.route_id] ?? null : null,
      })));
    };
    void loadGroupRides();

    const groupChannel = supabase
      .channel(`group-rides-user-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_ride_passengers", filter: `user_id=eq.${user.id}` }, () => { void loadGroupRides(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_rides" }, () => { void loadGroupRides(); })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(tripsChannel);
      supabase.removeChannel(groupChannel);
    };
  }, [user]);

  const handlePaymentSubmitted = (updated: Reservation) => {
    setReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setPayTarget(null);
  };

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 pb-28 lg:px-8">
      <h1 className="text-2xl font-bold">Mes Réservations</h1>
      <p className="mt-1 text-sm text-muted-foreground">Suivez le statut de toutes vos réservations.</p>

      {sharing && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-success">
          <Radio className="h-4 w-4 animate-pulse" />
          <span className="flex-1">
            <strong>Position partagée</strong> — votre chauffeur peut vous localiser pour venir vous chercher.
          </span>
        </div>
      )}
      {gpsError && activeTripId && (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          GPS bloqué : {gpsError.message}. Autorisez la géolocalisation pour que le chauffeur vous trouve.
        </div>
      )}

      {groupRides.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Users className="h-5 w-5 text-primary" />
            Mes courses de groupe
            <span className="ml-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {groupRides.length} active{groupRides.length > 1 ? "s" : ""}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Vous pouvez consulter vos réservations ci-dessous sans interrompre votre course en cours.
          </p>
          {groupRides.map((gr) => {
            const statusLabel: Record<string, string> = {
              searching: "Recherche de passagers",
              matched: "Course confirmée",
              driver_arriving: "Chauffeur en route",
              active: "Course en cours",
            };
            const isLive = gr.status === "driver_arriving" || gr.status === "active";
            return (
              <div key={gr.id} className="card-hover rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/0 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">#{gr.id.slice(0, 8).toUpperCase()}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
                        {statusLabel[gr.status] ?? gr.status}
                      </span>
                    </div>
                    <h3 className="mt-1 font-bold">{gr.route_name ?? "Course de groupe"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {gr.pickup_address ?? "Départ"} → {gr.destination_address ?? "Destination"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Place {gr.seat_index + 1} · {gr.seats_taken}/{gr.max_seats} passagers
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Prix/place</p>
                    <p className="text-lg font-bold">{formatXAF(gr.price_per_seat)}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end border-t border-primary/10 pt-4">
                  <Link to="/deplacement-groupe/waiting/$rideId" params={{ rideId: gr.id }}>
                    <Button size="sm" className="gap-2">
                      <MapPin className="h-4 w-4" />
                      Rejoindre la salle d'attente
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              const remaining = Math.max(0, res.total_amount - res.paid_amount);
              const canPay = res.status === "PENDING_PAYMENT" && remaining > 0;
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
                      {canPay && (
                        <p className="mt-0.5 text-xs font-semibold text-warning-foreground">
                          Reste : {formatXAF(remaining)}
                        </p>
                      )}
                    </div>
                  </div>
                  {res.reference_code && (
                    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">Code de réservation</p>
                          <p className="mt-0.5 font-mono text-lg font-bold tracking-[0.2em] text-primary">{res.reference_code}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">À présenter à l'agent ou à mentionner lors du paiement.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(res.reference_code!);
                            toast.success("Code copié");
                          }}
                          className="rounded-lg border border-primary/30 bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                        >
                          Copier
                        </button>
                      </div>
                      {res.agent_code && res.status === "CONFIRMED" && (
                        <p className="mt-2 border-t border-primary/10 pt-2 text-[11px] text-muted-foreground">
                          Code de confirmation agent : <span className="font-mono font-bold tracking-wider text-foreground">{res.agent_code}</span>
                        </p>
                      )}
                    </div>
                  )}
                  {(canPay || res.trip_id || res.service_type === "VTC" || (res.details as any)?.train_booking) && (
                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">
                      {(res.details as any)?.train_booking && (
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => downloadTrainReceiptFor(res)}>
                          <Download className="h-4 w-4" />
                          Reçu PDF
                        </Button>
                      )}
                      {res.service_type === "VTC" && (
                        <Link to="/vtc/suivi/$reservationId" params={{ reservationId: res.id }}>
                          <Button size="sm" variant="outline" className="gap-2">
                            <MapPin className="h-4 w-4" />
                            Suivi VTC
                          </Button>
                        </Link>
                      )}
                      {res.trip_id && (
                        <>
                          <TripEtaInline tripId={res.trip_id} />
                          <Link to="/suivi/$tripId" params={{ tripId: res.trip_id }}>
                            <Button size="sm" variant="outline" className="gap-2">
                              <MapPin className="h-4 w-4" />
                              Suivre en direct
                            </Button>
                          </Link>
                        </>
                      )}
                      {canPay && (
                        <Link to="/paiement/$reservationId" params={{ reservationId: res.id }}>
                          <Button size="sm" className="gap-2">
                            <Wallet className="h-4 w-4" />
                            Payer ({formatXAF(remaining)})
                          </Button>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PaymentDialog
        reservation={payTarget}
        userId={user?.id ?? null}
        onClose={() => setPayTarget(null)}
        onSuccess={handlePaymentSubmitted}
      />
      <ClientNav />
    </section>
  );
}

function PaymentDialog({
  reservation,
  userId,
  onClose,
  onSuccess,
}: {
  reservation: Reservation | null;
  userId: string | null;
  onClose: () => void;
  onSuccess: (updated: Reservation) => void;
}) {
  const [provider, setProvider] = useState<"Airtel Money" | "Moov Money">("Airtel Money");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (reservation) {
      setProvider("Airtel Money");
      setPhone("");
    }
  }, [reservation?.id]);

  const open = !!reservation;
  const remaining = reservation ? Math.max(0, reservation.total_amount - reservation.paid_amount) : 0;

  const submit = async () => {
    if (!reservation || !userId) return;
    const cleaned = phone.replace(/\s+/g, "");
    if (!/^0?[0-9]{8,9}$/.test(cleaned)) {
      toast.error("Numéro invalide. Format : 074XXXXXX ou 06XXXXXXX.");
      return;
    }
    setSubmitting(true);
    const { error: payError } = await supabase.from("payments").insert({
      reservation_id: reservation.id,
      user_id: userId,
      amount: remaining,
      method: `${provider} (${cleaned})`,
      status: "PENDING",
    });
    if (payError) {
      setSubmitting(false);
      toast.error("Erreur lors de l'enregistrement du paiement : " + payError.message);
      return;
    }
    const newPaid = reservation.paid_amount + remaining;
    const { data: updatedRes, error: resError } = await supabase
      .from("reservations")
      .update({ paid_amount: newPaid })
      .eq("id", reservation.id)
      .select("id, service_type, reservation_date, total_amount, paid_amount, status, details, created_at, reference_code, agent_code")
      .single();
    setSubmitting(false);
    if (resError || !updatedRes) {
      toast.error("Paiement enregistré mais mise à jour impossible.");
      return;
    }
    toast.success("Paiement envoyé ! L'admin va valider votre transaction sous peu.");
    onSuccess(updatedRes as Reservation);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payer le solde via Mobile Money</DialogTitle>
          <DialogDescription>
            Solde à régler : <span className="font-bold text-foreground">{formatXAF(remaining)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-2 block text-sm">Opérateur</Label>
            <RadioGroup value={provider} onValueChange={(v) => setProvider(v as typeof provider)} className="grid grid-cols-2 gap-2">
              {(["Airtel Money", "Moov Money"] as const).map((p) => (
                <Label
                  key={p}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm transition-colors ${
                    provider === p ? "border-primary bg-primary/5 font-semibold" : "border-border"
                  }`}
                >
                  <RadioGroupItem value={p} />
                  {p}
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="phone" className="mb-2 block text-sm">Numéro Mobile Money</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="074 12 34 56"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Vous recevrez une notification {provider} pour confirmer le paiement.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            Après validation manuelle par notre équipe (sous 24h ouvrées), votre réservation passera au statut « Confirmée ».
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting || !phone} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmer le paiement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
