import { useEffect, useState } from "react";

export interface OsrmRoute {
  geometry: [number, number][]; // [lat, lng] pairs
  distanceKm: number;
  durationMin: number;
  steps: OsrmStep[];
}

export interface OsrmStep {
  instruction: string;
  distanceM: number;
  durationMin: number;
  location: { lat: number; lng: number };
}

interface Point {
  lat: number;
  lng: number;
}

interface OsrmRawStep {
  name?: string;
  distance: number;
  duration: number;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
  };
}

function formatStep(step: OsrmRawStep): OsrmStep {
  const road = step.name ? ` sur ${step.name}` : "";
  const action = instructionFor(step.maneuver.type, step.maneuver.modifier);
  return {
    instruction: `${action}${road}`,
    distanceM: step.distance,
    durationMin: Math.max(1, Math.round(step.duration / 60)),
    location: { lat: step.maneuver.location[1], lng: step.maneuver.location[0] },
  };
}

function instructionFor(type: string, modifier?: string) {
  if (type === "depart") return "Démarrer";
  if (type === "arrive") return "Vous êtes arrivé";
  if (type === "roundabout") return "Entrer dans le rond-point";
  if (type === "merge") return "Rejoindre la voie";
  if (type === "new name") return "Continuer";
  if (type === "turn") {
    if (modifier?.includes("left")) return "Tourner à gauche";
    if (modifier?.includes("right")) return "Tourner à droite";
  }
  if (modifier?.includes("left")) return "Rester à gauche";
  if (modifier?.includes("right")) return "Rester à droite";
  return "Continuer tout droit";
}

/**
 * Fetches a real road route from OSRM (public demo server, free, no API key).
 * Returns null while loading or on error.
 */
export function useOsrmRoute(
  from: Point | null,
  to: Point | null,
  enabled = true,
  refreshKey: string | number = 0
): { route: OsrmRoute | null; loading: boolean; error: string | null } {
  const [route, setRoute] = useState<OsrmRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !from || !to) {
      setRoute(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const fetchRoute = async () => {
      setLoading(true);
      setError(null);
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${from.lng},${from.lat};${to.lng},${to.lat}` +
          `?overview=full&geometries=geojson&steps=true`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`OSRM ${res.status}`);
        const data = await res.json();

        if (cancelled) return;
        if (!data.routes?.[0]) {
          setRoute(null);
          setError("Aucun itinéraire trouvé");
          return;
        }

        const r = data.routes[0];
        const coords: [number, number][] = (r.geometry.coordinates as [number, number][]).map(
          ([lng, lat]) => [lat, lng]
        );
        setRoute({
          geometry: coords,
          distanceKm: r.distance / 1000,
          durationMin: Math.round(r.duration / 60),
          steps: ((r.legs?.[0]?.steps ?? []) as OsrmRawStep[]).map(formatStep),
        });
      } catch (e) {
        if (cancelled || (e as Error).name === "AbortError") return;
        setError((e as Error).message || "Erreur OSRM");
        setRoute(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRoute();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from?.lat, from?.lng, to?.lat, to?.lng, enabled, refreshKey]);

  return { route, loading, error };
}
