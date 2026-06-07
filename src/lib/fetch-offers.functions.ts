import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";

export type Offer = Tables<"offers">;

export const fetchOffersByType = createServerFn({ method: "GET" })
  .inputValidator((input: unknown): string => {
    if (typeof input !== "string") throw new Error("serviceType must be a string");
    return input;
  })
  .handler(async ({ data: serviceType }): Promise<Offer[]> => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      console.error("Missing server Supabase env vars (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY)");
      return [];
    }

    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("offers")
      .select("*")
      .eq("is_active", true)
      .eq("service_type", serviceType)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching offers:", error.message);
      return [];
    }
    return (data ?? []) as Offer[];
  });
