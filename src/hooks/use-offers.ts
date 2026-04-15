import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Offer = Tables<"offers">;

export function useOffers(serviceType?: string) {
  const [data, setData] = useState<Offer[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOffers() {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from("offers")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (serviceType) {
        query = query.eq("service_type", serviceType);
      }

      const { data: result, error: err } = await query;

      if (cancelled) return;

      if (err) {
        setError(new Error(err.message));
        setData(null);
      } else {
        setData(result as Offer[]);
      }
      setIsLoading(false);
    }

    fetchOffers();
    return () => { cancelled = true; };
  }, [serviceType]);

  return { data, isLoading, error };
}
