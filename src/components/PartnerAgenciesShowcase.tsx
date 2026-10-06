import { useEffect, useState } from "react";
import { BadgeCheck, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AgencyLogo } from "@/components/AgencyLogo";

type Agency = { id: string; name: string; logo_url: string | null; is_verified: boolean };

/** Display-only strip of partner agencies for a transport category (no links, no booking logic). */
export function PartnerAgenciesShowcase({ category, title = "Nos agences partenaires" }: { category: "bus" | "train" | "bateau" | "avion"; title?: string }) {
  const [agencies, setAgencies] = useState<Agency[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("partner_agencies_public" as any)
        .select("id, name, logo_url, is_verified")
        .eq("category", category)
        .order("is_verified", { ascending: false });
      if (alive) setAgencies(((data as any[]) ?? []) as Agency[]);
    })();
    return () => { alive = false; };
  }, [category]);

  if (agencies.length === 0) return null;

  return (
    <section aria-label={title} className="mt-6 rounded-3xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Handshake className="h-4 w-4 text-primary" /> {title}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none]">
        {agencies.map((a) => (
          <div key={a.id} className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
            {a.logo_url ? (
              <AgencyLogo src={a.logo_url} alt={a.name} size={56} />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                {a.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="line-clamp-2 text-[11px] font-medium leading-tight">
              {a.name}
              {a.is_verified && <BadgeCheck className="ml-0.5 inline h-3 w-3 text-primary" />}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
