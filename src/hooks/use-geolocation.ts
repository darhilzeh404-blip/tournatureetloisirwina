import { useEffect, useRef, useState } from "react";

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface UseGeolocationOptions {
  enabled: boolean;
  intervalMs?: number;
  onUpdate?: (pos: GeoPosition) => void;
}

/**
 * Tracks the device GPS position while `enabled` is true.
 * Emits updates via watchPosition (more battery-efficient than polling).
 * `onUpdate` is called for every new fix.
 */
export type GeoErrorCode = "unsupported" | "permission_denied" | "unavailable" | "timeout" | "unknown";

export interface GeoError {
  code: GeoErrorCode;
  message: string;
}

export function useGeolocation({ enabled, onUpdate }: UseGeolocationOptions) {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<GeoError | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError({ code: "unsupported", message: "Géolocalisation non supportée par ce navigateur." });
      return;
    }

    let mounted = true;
    const nav = navigator as Navigator & { permissions?: { query: (d: { name: PermissionName }) => Promise<PermissionStatus> } };
    nav.permissions?.query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (!mounted) return;
        if (status.state === "denied") {
          setError({ code: "permission_denied", message: "Autorisation GPS refusée. Activez la localisation dans les réglages du navigateur." });
        }
      })
      .catch((err) => {
        console.error("[useGeolocation] permissions.query error:", err);
      });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!mounted) return;
        const next: GeoPosition = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        setPosition(next);
        setError(null);
        onUpdateRef.current?.(next);
      },
      (err) => {
        if (!mounted) return;
        const code: GeoErrorCode =
          err.code === err.PERMISSION_DENIED ? "permission_denied"
          : err.code === err.POSITION_UNAVAILABLE ? "unavailable"
          : err.code === err.TIMEOUT ? "timeout"
          : "unknown";
        const message =
          code === "permission_denied" ? "Autorisation GPS refusée. Activez la localisation pour ce site."
          : code === "unavailable" ? "Position indisponible. Vérifiez votre signal GPS."
          : code === "timeout" ? "Délai dépassé pour obtenir la position."
          : err.message || "Erreur GPS inconnue.";
        setError({ code, message });
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => {
      mounted = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled]);

  return { position, error };
}

/** Haversine distance in kilometers */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** ETA in minutes assuming an average speed (km/h). */
export function estimateEtaMinutes(distanceKm: number, avgSpeedKmh = 35): number {
  if (distanceKm <= 0) return 0;
  return Math.max(1, Math.round((distanceKm / avgSpeedKmh) * 60));
}
