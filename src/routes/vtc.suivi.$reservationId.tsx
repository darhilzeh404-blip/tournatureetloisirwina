import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, CarFront, Clock, MapPin, Navigation, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveMap, type MapMarker } from "@/components/LiveMap";
import { useDriverPosition } from "@/hooks/use-driver-position";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/vtc/suivi/$reservationId")({
  head: () => ({
    meta: [
      { title: "Suivi VTC — Agence Wina" },
      { name: "description", content: "Suivez votre transfert VTC, son statut et la position du chauffeur en temps réel." },
    ],
  }),
  component: VtcTrackingPage,
});

type ReservationStatus = "PENDING_PAYMENT" | "CONFIRMED" | "REJECTED" | "CANCELLED";

interface VtcReservation {
  id: string;
  user_id: string;
  reservation_date: string;
  status: ReservationStatus;
  total_amount: number;
  details: Record<string, unknown> | null;
}

interface Trip {
  id: string;
  driver_id: string | null;
  status: string;
  origin_address: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  eta_minutes: number | null;
}

const STATUS_COPY: Record<ReservationStatus, { label: string; className: string }> = {
  PENDING_PAYMENT: { label: "En attente", className: "border-warning/30 bg-warning/10 text-warning-foreground" },
  CONFIRMED: { label: "Confirmé", className: "border-success/30 bg-success/10 text-success" },
  REJECTED: { label: "Refusé", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  CANCELLED: { label: "Annulé", className: "border-muted bg-muted text-muted-foreground" },
};

function parsePosition(value: unknown): { lat: number; lng: number } | null {
  if (typeof value !== "string") return null;
  const match = value.match(/\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/);
  if (!match) return null;
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

function VtcTrackingPage() {
  const { reservationId } = Route.useParams();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [reservation, setReservation] = useState<VtcReservation | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [driverName, setDriverName] = useState("");
  const [loading, setLoading] = useState(true);
  const driverPos = useDriverPosition(trip?.driver_id ?? null);

  const loadTracking = async () => {
    if (!user) return;
    setLoading(true);
    const { data: reservationData } = await supabase
      .from("reservations")
      .select("id, user_id, reservation_date, status, total_amount, details")
      .eq("id", reservationId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: tripData } = await supabase
      .from("trips")
      .select("id, driver_id, status, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, eta_minutes")
      .eq("reservation_id", reservationId)
      .maybeSingle();

    setReservation((reservationData as VtcReservation | null) ?? null);
    setTrip((tripData as Trip | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: "/connexion" });
  }, [isLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    loadTracking();

    const reservationChannel = supabase
      .channel(`vtc-reservation-${reservationId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reservations", filter: `id=eq.${reservationId}` }, (payload) => {
        if (mounted) setReservation(payload.new as VtcReservation);
      })
      .subscribe();

    const tripChannel = supabase
      .channel(`vtc-trip-${reservationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trips", filter: `reservation_id=eq.${reservationId}` }, (payload) => {
        if (!mounted) return;
        if (payload.eventType === "DELETE") setTrip(null);
        else setTrip(payload.new as Trip);
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(reservationChannel);
      supabase.removeChannel(tripChannel);
    };
  }, [reservationId, user]);

  useEffect(() => {
    if (!trip?.driver_id) {
      setDriverName("");
      return;
    }
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", trip.driver_id)
      .maybeSingle()
      .then(({ data }) => setDriverName(data?.full_name ?? ""));
  }, [trip?.driver_id]);

  const markers = useMemo<MapMarker[]>(() => {
    const details = reservation?.details ?? {};
    const pickupPoint = trip?.origin_lat && trip.origin_lng ? { lat: Number(trip.origin_lat), lng: Number(trip.origin_lng) } : parsePosition(details.pickup);
    const destinationPoint = trip?.destination_lat && trip.destination_lng ? { lat: Number(trip.destination_lat), lng: Number(trip.destination_lng) } : parsePosition(details.destination);
    const next: MapMarker[] = [];
    if (pickupPoint) next.push({ id: "pickup", type: "client", lat: pickupPoint.lat, lng: pickupPoint.lng, label: String(details.pickup ?? trip?.origin_address ?? "Départ") });
    if (destinationPoint) next.push({ id: "destination", type: "destination", lat: destinationPoint.lat, lng: destinationPoint.lng, label: String(details.destination ?? trip?.destination_address ?? "Arrivée") });
    if (driverPos) next.push({ id: "driver", type: "driver", lat: Number(driverPos.latitude), lng: Number(driverPos.longitude), label: driverName || "Chauffeur" });
    return next;
  }, [driverName, driverPos, reservation?.details, trip]);

  const details = reservation?.details ?? {};
  const status = reservation ? STATUS_COPY[reservation.status] : null;

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Chargement du suivi VTC...</div>;

  if (!reservation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <CarFront className="h-12 w-12 text-muted-foreground/50" />
        <p className="font-semibold">Suivi VTC introuvable.</p>
        <Link to="/mes-reservations"><Button variant="outline">Retour aux réservations</Button></Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/mes-reservations"><Button size="icon" variant="ghost"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">Suivi VTC</h1>
            <p className="truncate text-xs text-muted-foreground">{String(details.pickup ?? "Départ")} → {String(details.destination ?? "Arrivée")}</p>
          </div>
          {status && <Badge className={status.className}>{status.label}</Badge>}
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="grid gap-3 border-b bg-card/60 p-4 text-sm sm:grid-cols-3">
          <div className="rounded-xl border bg-background p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" /> Horaire</p>
            <p className="mt-1 font-semibold">{details.scheduled_at ? new Date(String(details.scheduled_at)).toLocaleString("fr-FR") : new Date(reservation.reservation_date).toLocaleDateString("fr-FR")}</p>
          </div>
          <div className="rounded-xl border bg-background p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><CarFront className="h-3.5 w-3.5" /> Véhicule</p>
            <p className="mt-1 font-semibold">{String(details.vehicle_type ?? "VTC")}</p>
          </div>
          <div className="rounded-xl border bg-background p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Navigation className="h-3.5 w-3.5" /> Chauffeur</p>
            <p className="mt-1 font-semibold">{driverName || (trip?.driver_id ? "Chauffeur assigné" : "En attente")}</p>
          </div>
        </section>

        <section className="relative min-h-[420px] flex-1">
          {markers.length > 0 ? (
            <LiveMap markers={markers} showRoute followMarkerId={driverPos ? "driver" : undefined} height="100%" />
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center p-6 text-center text-muted-foreground">
              <div><MapPin className="mx-auto h-12 w-12 opacity-40" /><p className="mt-2">Carte disponible dès que les coordonnées ou le chauffeur sont assignés.</p></div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4 rounded-2xl border bg-card/95 p-4 shadow-lg backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3"><Clock className="h-5 w-5 text-primary" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Statut de la course</p>
                <p className="font-semibold">{trip?.status === "active" ? "Chauffeur en route" : trip?.status === "completed" ? "Course terminée" : status?.label ?? "En attente"}</p>
                {driverPos && <p className="mt-1 text-xs text-muted-foreground">Position chauffeur mise à jour en temps réel.</p>}
              </div>
              <Button size="icon" variant="outline" onClick={loadTracking} aria-label="Rafraîchir le suivi"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}