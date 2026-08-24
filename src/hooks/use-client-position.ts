import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGeolocation } from "@/hooks/use-geolocation";

export interface ClientPosition {
  client_id: string;
  trip_id: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updated_at: string;
}

/**
 * Côté CLIENT : pousse sa position GPS vers Supabase tant qu'un trip
 * actif (pending|active) lui est associé. Démarre tout seul.
 */
export function useShareClientPosition(
  clientId: string | null | undefined,
  activeTripId: string | null | undefined,
  manualEnabled = true
) {
  const enabled = manualEnabled && !!clientId && !!activeTripId;

  const { position, error } = useGeolocation({
    enabled,
    // Un upsert réseau par point GPS saturait la file de requêtes de la WebView
    // Android. On ne pousse qu'au maximum toutes les 8 s ou tous les 25 m.
    minIntervalMs: 8000,
    minDistanceM: 25,
    onUpdate: async (pos) => {
      if (!clientId || !activeTripId) return;
      const { error: upErr } = await supabase.from("client_positions").upsert(
        {
          client_id: clientId,
          trip_id: activeTripId,
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
          heading: pos.heading,
          speed: pos.speed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      );
      if (upErr) console.error("[client-position] upsert error", upErr);
    },
  });

  return { position, error, sharing: enabled };
}

/**
 * Côté CHAUFFEUR : suit la position d'un client donné via Realtime.
 * Retourne { position, loading, fetched } pour permettre l'affichage
 * d'un loader puis d'un fallback si aucune position n'existe.
 */
export function useClientPosition(clientId: string | null | undefined) {
  const [position, setPosition] = useState<ClientPosition | null>(null);
  const [loading, setLoading] = useState<boolean>(!!clientId);
  const [fetched, setFetched] = useState<boolean>(false);

  useEffect(() => {
    if (!clientId) {
      setPosition(null);
      setLoading(false);
      setFetched(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setFetched(false);

    supabase
      .from("client_positions")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle()
      .then(
        ({ data, error }) => {
          if (!mounted) return;
          if (error) {
            console.error("[useClientPosition] initial fetch error:", error);
          }
          setPosition((data as ClientPosition) ?? null);
          setLoading(false);
          setFetched(true);
        },
        (err) => {
          if (mounted) {
            console.error("[useClientPosition] fetch exception:", err);
            setLoading(false);
            setFetched(true);
          }
        }
      );

    const channel = supabase
      .channel(`client-pos-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_positions",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          if (!mounted) return;
          const next = payload.new as ClientPosition | null;
          if (next) {
            setPosition(next);
            setLoading(false);
            setFetched(true);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  return { position, loading, fetched };
}
