import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DriverPosition {
  driver_id: string;
  trip_id: string | null;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  updated_at: string;
  archived_at: string | null;
}

/**
 * Subscribes to a single driver's position via Supabase Realtime.
 * RLS makes sure the caller is allowed to see it.
 */
export function useDriverPosition(driverId: string | null | undefined) {
  const [position, setPosition] = useState<DriverPosition | null>(null);

  useEffect(() => {
    if (!driverId) {
      setPosition(null);
      return;
    }

    let mounted = true;

    // Initial fetch
    supabase
      .from("driver_positions")
      .select("*")
      .eq("driver_id", driverId)
      .is("archived_at", null)
      .maybeSingle()
      .then(
        ({ data, error }) => {
          if (mounted) {
            if (error) console.error("[useDriverPosition] initial fetch error:", error);
            else if (data) setPosition(data as DriverPosition);
          }
        },
        (err) => {
          if (mounted) console.error("[useDriverPosition] fetch exception:", err);
        }
      );

    const channel = supabase
      .channel(`driver-pos-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_positions",
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          if (!mounted) return;
          const next = payload.new as DriverPosition | null;
        if (next?.archived_at) setPosition(null);
        else if (next) setPosition(next);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  return position;
}

/**
 * Subscribes to ALL driver positions (admin-only via RLS).
 */
export function useAllDriverPositions() {
  const [positions, setPositions] = useState<DriverPosition[]>([]);

  useEffect(() => {
    let mounted = true;

    supabase
      .from("driver_positions")
      .select("*")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (mounted && data) setPositions(data as DriverPosition[]);
      });

    // Les positions GPS arrivent en continu : sans tampon, chaque point déclenchait
    // un rendu complet de la carte et de la liste (écran figé côté Android).
    // On accumule les changements et on ne rend qu'une fois par seconde.
    const pending = new Map<string, DriverPosition | null>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      flushTimer = null;
      if (!mounted || pending.size === 0) return;
      const batch = new Map(pending);
      pending.clear();
      setPositions((prev) => {
        const next = new Map(prev.map((p) => [p.driver_id, p] as const));
        batch.forEach((row, driverId) => {
          if (row === null) next.delete(driverId);
          else next.set(driverId, row);
        });
        return Array.from(next.values());
      });
    };

    const schedule = () => {
      if (flushTimer === null) flushTimer = setTimeout(flush, 1000);
    };

    const channel = supabase
      .channel("driver-positions-all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_positions" },
        (payload) => {
          if (!mounted) return;
          const newRow = payload.new as DriverPosition | null;
          const oldRow = payload.old as DriverPosition | null;
          if (payload.eventType === "DELETE" && oldRow) {
            pending.set(oldRow.driver_id, null);
          } else if (newRow) {
            pending.set(newRow.driver_id, newRow.archived_at ? null : newRow);
          } else {
            return;
          }
          schedule();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      if (flushTimer) clearTimeout(flushTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  return positions;
}
