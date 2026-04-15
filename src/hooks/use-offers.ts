import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Offer = Tables<"offers">;

export const offersQueryOptions = (serviceType?: string) =>
  queryOptions({
    queryKey: ["offers", serviceType ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("offers")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (serviceType) {
        query = query.eq("service_type", serviceType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Offer[];
    },
  });

export function useOffers(serviceType?: string) {
  return useQuery(offersQueryOptions(serviceType));
}
