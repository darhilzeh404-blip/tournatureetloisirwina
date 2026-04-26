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
      .then(({ data }) => {
        if (mounted && data) setPosition(data as DriverPosition);
      });

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
      .then(({ data }) => {
        if (mounted && data) setPositions(data as DriverPosition[]);
      });

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
            setPositions((prev) => prev.filter((p) => p.driver_id !== oldRow.driver_id));
            return;
          }
          if (!newRow) return;
          if (newRow.archived_at) {
            setPositions((prev) => prev.filter((p) => p.driver_id !== newRow.driver_id));
            return;
          }
          setPositions((prev) => {
            const exists = prev.some((p) => p.driver_id === newRow.driver_id);
            return exists
              ? prev.map((p) => (p.driver_id === newRow.driver_id ? newRow : p))
              : [...prev, newRow];
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return positions;
}
