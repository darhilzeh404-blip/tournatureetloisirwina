import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Tables } from "@/integrations/supabase/types";

export type Offer = Tables<"offers">;

export const fetchOffersByType = createServerFn({ method: "GET" })
  .inputValidator((input: unknown): string => {
    if (typeof input !== "string") throw new Error("serviceType must be a string");
    return input;
  })
  .handler(async ({ data: serviceType }): Promise<Offer[]> => {
    const { data, error } = await supabaseAdmin
      .from("offers")
      .select("*")
      .eq("is_active", true)
      .eq("service_type", serviceType)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as Offer[];
  });
