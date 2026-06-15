import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Ticket, Plus, BadgeCheck, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/agence/")({
  component: AgenceDashboard,
});

function AgenceDashboard() {
  const { user } = useAuth();
  const [agency, setAgency] = useState<any>(null);
  const [ticketCount, setTicketCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("partner_agencies" as any)
        .select("id, owner_user_id, name, phone, logo_url, is_verified, is_active, description")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      setAgency(data);
      if (data) {
        const { count } = await supabase
          .from("partner_tickets" as any)
          .select("id", { count: "exact", head: true })
          .eq("agency_id", (data as any).id);
        setTicketCount(count ?? 0);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <p className="text-center text-sm text-muted-foreground">Chargement…</p>;

  if (!agency) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
        <h2 className="mt-3 text-lg font-bold">Profil agence non configuré</h2>
        <p className="mt-1 text-sm text-muted-foreground">Créez votre fiche agence pour commencer à publier des billets.</p>
        <Link to="/agence/profil" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Configurer mon agence
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-3">
          {agency.logo_url ? (
            <img loading="lazy" decoding="async" src={agency.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-primary/10" />
          )}
          <div>
            <h2 className="flex items-center gap-1.5 text-lg font-bold">
              {agency.name}
              {agency.is_verified && <BadgeCheck className="h-4 w-4 text-primary" />}
            </h2>
            <p className="text-xs text-muted-foreground">{agency.is_verified ? "Agence vérifiée" : "En attente de vérification"}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <Ticket className="h-6 w-6 text-primary" />
          <p className="mt-2 text-3xl font-bold">{ticketCount}</p>
          <p className="text-sm text-muted-foreground">billet{ticketCount > 1 ? "s" : ""} publié{ticketCount > 1 ? "s" : ""}</p>
          <Link to="/agence/billets" className="mt-3 inline-block text-sm font-semibold text-primary">Gérer →</Link>
        </div>
        <Link to="/agence/billets" className="flex flex-col justify-center rounded-2xl border bg-primary p-5 text-primary-foreground">
          <Plus className="h-6 w-6" />
          <p className="mt-2 text-base font-bold">Nouveau billet</p>
          <p className="text-xs opacity-80">Publier un billet à vendre</p>
        </Link>
      </div>
    </div>
  );
}
