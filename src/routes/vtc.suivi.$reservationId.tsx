import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { isNightHoursNow, requestNotificationPermission, showAppNotification } from "@/lib/notifications";
import { ArrowLeft, CalendarClock, CarFront, CheckCircle2, Clock, Loader2, MapPin, Navigation, Phone, RefreshCw, Search, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LazyLiveMap, type MapMarker } from "@/components/LazyLiveMap";
import { useDriverPosition } from "@/hooks/use-driver-position";
import { useShareClientPosition } from "@/hooks/use-client-position";
import { distanceKm, estimateEtaMinutes } from "@/hooks/use-geolocation";
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

interface DriverInfo {
  full_name: string | null;
  phone: string | null;
  vehicle_type: string | null;
  license_plate: string | null;
}

function VtcTrackingPage() {
  const { reservationId } = Route.useParams();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [reservation, setReservation] = useState<VtcReservation | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharePosition, setSharePosition] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [searchRadiusKm, setSearchRadiusKm] = useState(5);
  const [retrying, setRetrying] = useState(false);
  const driverPos = useDriverPosition(trip?.driver_id ?? null);
  const clientPosition = useShareClientPosition(user?.id, trip?.id, sharePosition && trip?.status !== "completed");

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
      setDriverInfo(null);
      return;
    }
    (async () => {
      const driverId = trip.driver_id;
      if (!driverId || !trip?.id) return;
      const [{ data: profile }, { data: driverRows }] = await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("user_id", driverId).maybeSingle(),
        supabase.rpc("get_assigned_vtc_driver" as never, { _trip_id: trip.id } as never),
      ]);
      const driver = Array.isArray(driverRows) ? (driverRows[0] as { full_name?: string; phone?: string; vehicle_type?: string; license_plate?: string } | undefined) : undefined;

      setDriverInfo({
        full_name: driver?.full_name || profile?.full_name || null,
        phone: driver?.phone || profile?.phone || null,
        vehicle_type: driver?.vehicle_type ?? null,
        license_plate: driver?.license_plate ?? null,
      });
    })();
  }, [trip?.driver_id, trip?.id]);

  const driverName = driverInfo?.full_name ?? "";

  const markers = useMemo<MapMarker[]>(() => {
    const details = reservation?.details ?? {};
    const pickupPoint = trip?.origin_lat && trip.origin_lng ? { lat: Number(trip.origin_lat), lng: Number(trip.origin_lng) } : parsePosition(details.pickup);
    const destinationPoint = trip?.destination_lat && trip.destination_lng ? { lat: Number(trip.destination_lat), lng: Number(trip.destination_lng) } : parsePosition(details.destination);
    const next: MapMarker[] = [];
    if (pickupPoint) next.push({ id: "pickup", type: "client", lat: pickupPoint.lat, lng: pickupPoint.lng, label: String(details.pickup ?? trip?.origin_address ?? "Départ") });
    if (destinationPoint) next.push({ id: "destination", type: "destination", lat: destinationPoint.lat, lng: destinationPoint.lng, label: String(details.destination ?? trip?.destination_address ?? "Arrivée") });
    if (driverPos) next.push({ id: "driver", type: "driver", lat: Number(driverPos.latitude), lng: Number(driverPos.longitude), label: driverName || "Chauffeur", service: "vtc", heading: driverPos.heading });
    return next;
  }, [driverName, driverPos, reservation?.details, trip]);


  const details = reservation?.details ?? {};
  const status = reservation ? STATUS_COPY[reservation.status] : null;
  const isInstantRequest = details.instant_request === true;
  const availabilityLabel = typeof details.availability_estimate_label === "string" ? details.availability_estimate_label : null;
  const preConfirmationMessage = typeof details.pre_confirmation_message === "string" ? details.pre_confirmation_message : null;
  const tripEta = useMemo(() => {
    if (trip?.eta_minutes) return trip.eta_minutes;
    if (!driverPos) return null;
    const pickupPoint = trip?.origin_lat && trip.origin_lng ? { latitude: Number(trip.origin_lat), longitude: Number(trip.origin_lng) } : null;
    const destinationPoint = trip?.destination_lat && trip.destination_lng ? { latitude: Number(trip.destination_lat), longitude: Number(trip.destination_lng) } : null;
    const target = trip?.status === "active" && destinationPoint ? destinationPoint : pickupPoint;
    if (!target) return null;
    return estimateEtaMinutes(distanceKm({ latitude: Number(driverPos.latitude), longitude: Number(driverPos.longitude) }, target));
  }, [driverPos, trip]);
  const milestones = [
    { key: "pickup", label: "Pris en charge", active: Boolean(trip), done: Boolean(trip && ["assigned", "active", "completed"].includes(trip.status)) },
    { key: "route", label: "En route", active: trip?.status === "active", done: trip?.status === "active" || trip?.status === "completed" },
    { key: "arrived", label: "Arrivé", active: trip?.status === "completed", done: trip?.status === "completed" },
  ];

  // Dispatch progression: 4 steps from creation to driver on the way.
  const dispatchStep: "searching" | "no_driver" | "found" | "assigned" | "active" | "completed" =
    !trip ? "searching"
    : trip.status === "no_driver_found" ? "no_driver"
    : trip.status === "pending" && !trip.driver_id ? "searching"
    : trip.status === "assigned" || (trip.driver_id && trip.status === "pending") ? "found"
    : trip.status === "active" ? "active"
    : trip.status === "completed" ? "completed"
    : "searching";

  const dispatchSteps = [
    { key: "request", label: "Demande envoyée", icon: CheckCircle2, done: true, active: dispatchStep === "searching" },
    { key: "search", label: "Recherche de chauffeur", icon: Search, done: dispatchStep !== "searching" && dispatchStep !== "no_driver", active: dispatchStep === "searching" },
    { key: "found", label: "Chauffeur trouvé", icon: CarFront, done: ["found", "assigned", "active", "completed"].includes(dispatchStep), active: dispatchStep === "found" },
    { key: "onway", label: "En route vers vous", icon: Navigation, done: ["active", "completed"].includes(dispatchStep), active: dispatchStep === "active" },
  ];

  // ============= Replanification automatique =============
  // Tant qu'aucun chauffeur n'est trouvé et que la course est encore en
  // attente, on relance une recherche toutes les 30s, en élargissant le
  // rayon (5 → 8 → 12 → 20 km) jusqu'à 5 tentatives. L'insertion d'un trip
  // ne se refait pas : on appelle l'RPC `trigger_driver_search` qui se
  // contente d'évaluer le pool. Côté chauffeur, l'INSERT initial est déjà
  // diffusé en realtime, mais on rafraîchit aussi `updated_at` pour relancer
  // les notifications proximité dès qu'un nouveau chauffeur passe en ligne.
  const waitingForDriver = trip && !trip.driver_id && trip.status === "pending";
  const noDriverFound = trip?.status === "no_driver_found";
  const shouldReplan = (waitingForDriver || noDriverFound) && reservation?.status === "CONFIRMED";

  const runReplan = async (manualRadiusKm?: number) => {
    if (!trip?.id) return;
    setRetrying(true);
    try {
      // 1. Relance la recherche côté serveur (compteur de chauffeurs joignables).
      const { data, error } = await supabase.rpc("trigger_driver_search", { _trip_id: trip.id });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const nearby = Number(row?.nearby_count ?? 0);

      // 2. Si le trip avait été marqué 'no_driver_found', on le rebascule
      //    en 'pending' pour rouvrir le pool aux chauffeurs.
      if (noDriverFound) {
        await supabase
          .from("trips")
          .update({ status: "pending", updated_at: new Date().toISOString() })
          .eq("id", trip.id)
          .eq("client_id", user?.id ?? "");
      } else {
        // 3. Bump updated_at pour rappeler la course aux chauffeurs en ligne.
        await supabase
          .from("trips")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", trip.id)
          .eq("client_id", user?.id ?? "");
      }

      setRetryCount((n) => n + 1);
      if (manualRadiusKm) setSearchRadiusKm(manualRadiusKm);
      if (nearby > 0) {
        // attendre l'événement realtime
      }
      void loadTracking();
    } catch (e) {
      console.error("[vtc-suivi] replan", e);
    } finally {
      setRetrying(false);
    }
  };

  // Auto-retry toutes les 30s tant qu'aucun chauffeur n'est assigné.
  useEffect(() => {
    if (!shouldReplan || retryCount >= 5) return;
    const radii = [5, 8, 12, 20, 30];
    const id = window.setTimeout(() => {
      const nextRadius = radii[Math.min(retryCount, radii.length - 1)];
      setSearchRadiusKm(nextRadius);
      void runReplan(nextRadius);
    }, 30_000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReplan, retryCount, trip?.id]);

  // ===== Notifications client : assignation, démarrage, fin =====
  // On garde une référence sur le dernier statut notifié pour éviter les doublons
  // lorsque le canal realtime renvoie plusieurs updates rapides.
  const lastNotifiedRef = useRef<{ driverId?: string | null; status?: string }>({});
  useEffect(() => {
    if (!trip) return;
    const paymentMode = (reservation?.details as Record<string, unknown> | null)?.payment_mode;
    const cashReminder = paymentMode === "cash" || isNightHoursNow()
      ? " Préparez le règlement en espèces."
      : " Paiement déjà validé, rien à régler à bord.";

    (async () => {
      await requestNotificationPermission();

      if (trip.driver_id && lastNotifiedRef.current.driverId !== trip.driver_id) {
        lastNotifiedRef.current.driverId = trip.driver_id;
        await showAppNotification("Chauffeur assigné", {
          body: `Un chauffeur a accepté votre course.${cashReminder}`,
          tag: `vtc-assigned-${trip.id}`,
        });
      }

      if (trip.status !== lastNotifiedRef.current.status) {
        lastNotifiedRef.current.status = trip.status;
        if (trip.status === "active") {
          await showAppNotification("Course démarrée", {
            body: `Vous êtes à bord — bon trajet !${cashReminder}`,
            tag: `vtc-active-${trip.id}`,
          });
        } else if (trip.status === "completed") {
          await showAppNotification("Course terminée", {
            body: paymentMode === "cash" || isNightHoursNow()
              ? "Merci d'avoir voyagé avec Wina. Pensez à régler en espèces au chauffeur."
              : "Merci d'avoir voyagé avec Wina. Paiement confirmé.",
            tag: `vtc-done-${trip.id}`,
          });
        }
      }
    })();
  }, [trip, reservation?.details]);




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
        <div className="border-b bg-primary/5 px-4 py-3 text-sm">
          <p className="font-semibold text-primary">Paiement par portefeuille WINA</p>
          <p className="text-xs text-muted-foreground">
            Toutes les courses VTC, y compris de nuit (21h–06h), sont réglées par portefeuille. Aucun règlement en espèces au chauffeur.
          </p>
        </div>


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

        {/* Dispatch progression — temps réel */}
        <section className="border-b bg-background p-4">
          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Avancement de la demande</p>
              {dispatchStep === "searching" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {dispatchStep === "no_driver" && <XCircle className="h-4 w-4 text-destructive" />}
            </div>

            <ol className="grid grid-cols-4 gap-2">
              {dispatchSteps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.key} className="flex flex-col items-center text-center">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                      s.done ? "border-primary bg-primary text-primary-foreground"
                      : s.active ? "border-primary bg-primary/10 text-primary animate-pulse"
                      : "border-muted bg-muted/30 text-muted-foreground"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className={`mt-1 text-[10px] font-semibold leading-tight ${s.done || s.active ? "text-foreground" : "text-muted-foreground"}`}>
                      {s.label}
                    </p>
                    {i < dispatchSteps.length - 1 && (
                      <div className={`absolute hidden ${s.done ? "bg-primary" : "bg-muted"}`} />
                    )}
                  </li>
                );
              })}
            </ol>

            {/* === Statut de recherche détaillé + replanification === */}
            {shouldReplan && (
              <div className={`mt-4 rounded-xl border p-3 text-sm ${
                noDriverFound
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-primary/30 bg-primary/5"
              }`}>
                <div className="flex items-start gap-2">
                  {noDriverFound ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">
                      {noDriverFound
                        ? "Aucun chauffeur n'a pu prendre votre course"
                        : retryCount === 0
                          ? `Recherche d'un chauffeur dans un rayon de ${searchRadiusKm} km…`
                          : `Nouvelle recherche élargie à ${searchRadiusKm} km (tentative ${retryCount + 1}/5)`}
                    </p>
                    <p className="mt-1 text-xs opacity-80">
                      {noDriverFound
                        ? "Nous avons élargi la zone plusieurs fois sans réponse. Relancez la recherche ou annulez."
                        : "Votre demande est diffusée à tous les chauffeurs en ligne. Dès qu'un chauffeur accepte, vous serez notifié(e)."}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={noDriverFound ? "default" : "outline"}
                    disabled={retrying}
                    onClick={() => {
                      const next = Math.min(searchRadiusKm + 5, 30);
                      void runReplan(next);
                    }}
                    className="gap-1.5"
                  >
                    {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {noDriverFound ? "Relancer la recherche" : `Élargir à ${Math.min(searchRadiusKm + 5, 30)} km`}
                  </Button>
                  <Link to="/mes-reservations">
                    <Button size="sm" variant="ghost">Annuler</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>


        {/* Carte chauffeur sélectionné — visible dès qu'un chauffeur est assigné */}
        {trip?.driver_id && (
          <section className="border-b bg-primary/5 p-4">
            <div className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <CarFront className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Chauffeur assigné</p>
                  <p className="mt-0.5 truncate text-base font-bold text-foreground">{driverInfo?.full_name ?? "Chauffeur Wina"}</p>
                  <p className="text-xs text-muted-foreground">
                    {driverInfo?.vehicle_type ?? "VTC"}
                    {driverInfo?.license_plate ? ` · ${driverInfo.license_plate}` : ""}
                  </p>
                </div>
                {driverInfo?.phone && (
                  <a href={`tel:${driverInfo.phone}`}>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> Appeler
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {isInstantRequest && !trip?.driver_id && dispatchStep !== "no_driver" && (
          <section className="border-b bg-primary/5 p-4">
            <div className="rounded-xl border border-primary/20 bg-card p-4 text-sm">
              <p className="flex items-center gap-2 text-xs font-bold text-primary"><Clock className="h-3.5 w-3.5" /> Disponibilité estimée</p>
              <p className="mt-1 text-lg font-extrabold text-foreground">{availabilityLabel ?? "10 à 20 min en moyenne"}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {preConfirmationMessage ?? "Votre demande est envoyée aux chauffeurs disponibles. Un chauffeur doit confirmer avant le départ ; vous serez notifié dès l’assignation."}
              </p>
            </div>
          </section>
        )}


        <section className="grid gap-3 border-b bg-background p-4 text-sm lg:grid-cols-[1fr_auto]">
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Estimation d’arrivée</p>
                <p className="mt-1 text-lg font-extrabold">{tripEta ? `${tripEta} min` : "En attente"}</p>
              </div>
              <Badge variant="outline">Temps réel</Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {milestones.map((step) => (
                <div key={step.key} className={`rounded-lg border px-2 py-2 text-center ${step.done ? "border-primary/40 bg-primary/10 text-primary" : "bg-background text-muted-foreground"}`}>
                  <span className={`mx-auto mb-1 block h-2 w-2 rounded-full ${step.active ? "bg-primary" : step.done ? "bg-primary/70" : "bg-muted"}`} />
                  <p className="text-[11px] font-semibold">{step.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-3">
            <Button
              type="button"
              onClick={() => setSharePosition((value) => !value)}
              disabled={!trip || trip.status === "completed"}
              className="w-full gap-2 rounded-xl"
              variant={sharePosition ? "default" : "secondary"}
            >
              <MapPin className="h-4 w-4" /> {sharePosition ? "Position partagée" : "Partager la position avec le chauffeur"}
            </Button>
            <p className={`mt-2 text-xs ${clientPosition.error ? "text-destructive" : "text-muted-foreground"}`}>
              {clientPosition.error ? clientPosition.error.message : sharePosition ? "Votre position est transmise au chauffeur." : "Activez pour faciliter le départ."}
            </p>
          </div>
        </section>

        <section className="relative min-h-[420px] flex-1">
          {markers.length > 0 ? (
            <LazyLiveMap markers={markers} showRoute followMarkerId={driverPos ? "driver" : undefined} height="100%" />
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