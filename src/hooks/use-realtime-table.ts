import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Abonnement Realtime unique et sûr pour une table Supabase.
 *
 * - Une seule souscription par montage (pas de re-souscription quand les
 *   filtres/état changent : le callback est stocké dans une ref).
 * - Rechargement debouncé pour éviter les rafales de requêtes.
 * - Nettoyage systématique au démontage.
 */
export function useRealtimeTable(
  table: string,
  onChange: () => void,
  options: { enabled?: boolean; debounceMs?: number; schema?: string } = {},
) {
  const { enabled = true, debounceMs = 600, schema = "public" } = options;
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let timer: number | undefined;
    const channel = supabase
      .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema, table },
        () => {
          if (timer) window.clearTimeout(timer);
          timer = window.setTimeout(() => callbackRef.current(), debounceMs);
        },
      )
      .subscribe();

    return () => {
      if (timer) window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [table, schema, enabled, debounceMs]);
}
