import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const fetchOffersByType = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(async ({ data: serviceType }) => {
    const { data, error } = await supabaseAdmin
      .from("offers")
      .select("*")
      .eq("is_active", true)
      .eq("service_type", serviceType)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });
