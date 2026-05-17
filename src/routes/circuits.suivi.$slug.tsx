import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bike, Car, CarFront, CheckCircle2, Clock, ExternalLink, Footprints, LocateFixed, MapPin, Navigation, Play, Route as RouteIcon, Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveMap, type MapMarker } from "@/components/LiveMap";
import { distanceKm, estimateEtaMinutes, useGeolocation } from "@/hooks/use-geolocation";
import { useOsrmRoute, type OsrmProfile } from "@/hooks/use-osrm-route";

type TransportMode = {
  id: "car" | "moto" | "foot" | "vtc";
  label: string;
  icon: typeof Car;
  profile: OsrmProfile;
  gmaps: "driving" | "walking" | "bicycling" | "two-wheeler";
};

const TRANSPORT_MODES: TransportMode[] = [
  { id: "car", label: "Voiture", icon: Car, profile: "driving", gmaps: "driving" },
  { id: "moto", label: "Moto", icon: Bike, profile: "driving", gmaps: "two-wheeler" },
  { id: "foot", label: "Marche", icon: Footprints, profile: "foot", gmaps: "walking" },
  { id: "vtc", label: "VTC", icon: CarFront, profile: "driving", gmaps: "driving" },
];

export const Route = createFileRoute("/circuits/suivi/$slug")({
  head: () => ({
    meta: [
      { title: "GPS circuit — Agence Wina" },
      { name: "description", content: "Suivez l’itinéraire GPS depuis votre position vers le circuit touristique choisi." },
    ],
  }),
  component: CircuitGpsPage,
});

const CIRCUIT_POINTS: Record<string, { name: string; lat: number; lng: number }> = {
  "akanda-pongara": { name: "Parcs Nationaux d’Akanda et Pongara", lat: 0.5009, lng: 9.3274 },
  "parcs-nationaux-dakanda-et-pongara": { name: "Parcs Nationaux d’Akanda et Pongara", lat: 0.5009, lng: 9.3274 },
  "wonga-wongue": { name: "Réserve de Wonga Wongué", lat: -0.5907, lng: 9.3778 },
  "reserve-de-wonga-wongue": { name: "Réserve de Wonga Wongué", lat: -0.5907, lng: 9.3778 },
  "meyang": { name: "Chutes de Meyang", lat: 0.3542, lng: 10.0669 },
  "chutes-de-meyang": { name: "Chutes de Meyang", lat: 0.3542, lng: 10.0669 },
  cocobeach: { name: "Cocobeach", lat: 1.0007, lng: 9.5821 },
  "baie-de-la-mondah": { name: "Baie de la Mondah", lat: 0.5812, lng: 9.3636 },
  "arboretum-raponda-walker": { name: "Arboretum Raponda Walker", lat: 0.5097, lng: 9.3994 },
};

function CircuitGpsPage() {
  const { slug } = Route.useParams();
  const [guidance, setGuidance] = useState(false);
  const [voiceGuidance, setVoiceGuidance] = useState(false);
  const [arrived, setArrived] = useState(false);
  const lastSpokenStepRef = useRef<number | null>(null);
  const destination = CIRCUIT_POINTS[slug] ?? { name: titleFromSlug(slug), lat: 0.4162, lng: 9.4673 };
  const navigationHttpsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`;
  const { position, error } = useGeolocation({ enabled: !arrived });
  const from = position ? { lat: position.latitude, lng: position.longitude } : null;
  const to = { lat: destination.lat, lng: destination.lng };
  const refreshKey = position ? `${position.latitude.toFixed(3)}-${position.longitude.toFixed(3)}` : "waiting";
  const { route, loading: routeLoading } = useOsrmRoute(from, to, Boolean(from), refreshKey);
  const fallbackDistance = position ? distanceKm(position, { latitude: destination.lat, longitude: destination.lng }) : null;
  const distance = route?.distanceKm ?? fallbackDistance;
  const eta = route?.durationMin ?? (fallbackDistance ? estimateEtaMinutes(fallbackDistance) : null);
  const activeStepIndex = useMemo(() => {
    if (!position || !route?.steps.length) return 0;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    route.steps.forEach((step, index) => {
      const d = distanceKm(position, { latitude: step.location.lat, longitude: step.location.lng });
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = index;
      }
    });
    return Math.min(bestIndex + (bestDistance < 0.04 ? 1 : 0), route.steps.length - 1);
  }, [position, route?.steps]);
  const activeStep = route?.steps[activeStepIndex];

  useEffect(() => {
    if (!guidance || !voiceGuidance || !activeStep || arrived || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (lastSpokenStepRef.current === activeStepIndex) return;
    lastSpokenStepRef.current = activeStepIndex;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${activeStep.instruction}. Dans ${formatStepDistance(activeStep.distanceM)}.`);
    utterance.lang = "fr-FR";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }, [activeStep, activeStepIndex, arrived, guidance, voiceGuidance]);

  const finishGuidance = () => {
    setArrived(true);
    setGuidance(false);
    setVoiceGuidance(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`Vous êtes arrivé à ${destination.name}. Fin du guidage.`);
      utterance.lang = "fr-FR";
      window.speechSynthesis.speak(utterance);
    }
  };

  const markers: MapMarker[] = [
    { id: "destination", type: "destination", lat: destination.lat, lng: destination.lng, label: destination.name },
  ];
  if (position) {
    markers.unshift({ id: "client", type: "client", lat: position.latitude, lng: position.longitude, label: "Votre position" });
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b bg-card p-3">
        <Link to="/circuits">
          <Button size="icon" variant="ghost"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold">GPS circuit</h1>
          <p className="truncate text-xs text-muted-foreground">Vers {destination.name}</p>
        </div>
        <Badge className={arrived ? "border-success/30 bg-success/10 text-success" : "border-success/30 bg-success/10 text-success"}>{arrived ? "Arrivé" : "Actif"}</Badge>
      </header>

      <main className="relative flex-1">
        <LiveMap
          markers={markers}
          showRoute
          routePath={route?.geometry}
          followMarkerId={position ? "client" : undefined}
          height="100%"
        />

        <div className="absolute left-4 right-4 top-4 rounded-2xl border bg-card/95 p-4 shadow-lg backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-3"><RouteIcon className="h-5 w-5 text-primary" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{destination.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {position ? "Votre position GPS est suivie en direct." : "Autorisez la localisation pour démarrer le guidage."}
              </p>
              {error && <p className="mt-2 text-xs text-destructive">{error.message}</p>}
            </div>
          </div>
          <Button
            type="button"
            onClick={() => {
              setArrived(false);
              setGuidance((value) => !value);
            }}
            disabled={!position || arrived}
            className="mt-3 w-full rounded-2xl gap-2"
            variant={guidance ? "default" : "secondary"}
          >
            <Navigation className="h-4 w-4" /> {guidance ? "Mode guidage activé" : "Activer le mode guidage"}
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => setVoiceGuidance((value) => !value)}
              disabled={!guidance || arrived}
              className="rounded-2xl gap-2"
              variant="outline"
            >
              {voiceGuidance ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {voiceGuidance ? "Voix active" : "Guidage vocal"}
            </Button>
            <Button type="button" onClick={finishGuidance} disabled={arrived} className="rounded-2xl gap-2" variant="secondary">
              <CheckCircle2 className="h-4 w-4" /> Je suis arrivé
            </Button>
          </div>
        </div>

        {guidance && activeStep && (
          <div className="absolute left-4 right-4 top-36 rounded-2xl border bg-primary p-4 text-primary-foreground shadow-xl">
            <p className="text-xs font-semibold opacity-80">Étape {activeStepIndex + 1}/{route?.steps.length}</p>
            <p className="mt-1 text-lg font-extrabold leading-snug">{activeStep.instruction}</p>
            <p className="mt-2 text-xs opacity-85">
              Dans {formatStepDistance(activeStep.distanceM)} · environ {activeStep.durationMin} min
            </p>
          </div>
        )}

        {arrived && (
          <div className="absolute left-4 right-4 top-36 rounded-2xl border border-success/30 bg-card/95 p-4 text-center shadow-xl backdrop-blur">
            <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
            <p className="mt-2 font-extrabold">Arrivée confirmée</p>
            <p className="mt-1 text-xs text-muted-foreground">Le guidage vers ce circuit est terminé.</p>
          </div>
        )}

        <div className="absolute bottom-4 left-4 right-4 rounded-2xl border bg-card/95 p-4 shadow-lg backdrop-blur">
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <MapPin className="mx-auto h-4 w-4 text-primary" />
              <p className="mt-1 text-xs text-muted-foreground">Distance</p>
              <p className="font-bold">{distance ? `${distance.toFixed(1)} km` : "—"}</p>
            </div>
            <div>
              <Clock className="mx-auto h-4 w-4 text-primary" />
              <p className="mt-1 text-xs text-muted-foreground">ETA</p>
              <p className="font-bold">{routeLoading ? "…" : eta ? `${eta} min` : "—"}</p>
            </div>
            <div>
              <LocateFixed className="mx-auto h-4 w-4 text-primary" />
              <p className="mt-1 text-xs text-muted-foreground">GPS</p>
              <p className="font-bold">{position ? "OK" : "Attente"}</p>
            </div>
          </div>
          <a
            href={navigationHttpsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground"
          >
            <ExternalLink className="h-4 w-4" /> Ouvrir la navigation HTTPS
          </a>
          {guidance && route?.steps.length ? (
            <div className="mt-3 max-h-36 overflow-y-auto rounded-xl border bg-background p-2">
              {route.steps.slice(activeStepIndex, activeStepIndex + 4).map((step, index) => (
                <div key={`${step.instruction}-${index}`} className="flex gap-2 border-b py-2 last:border-b-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {activeStepIndex + index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{step.instruction}</p>
                    <p className="text-[11px] text-muted-foreground">{Math.round(step.distanceM)} m · {step.durationMin} min</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function titleFromSlug(slug: string) {
  return slug.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatStepDistance(distanceM: number) {
  return distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)} kilomètres` : `${Math.round(distanceM)} mètres`;
}