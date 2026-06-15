import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BadgeCheck, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/agences")({
  component: AdminAgences,
});

type Agency = {
  id: string; owner_user_id: string; name: string; phone: string | null;
  email: string | null; logo_url: string | null; is_verified: boolean;
  is_active: boolean; created_at: string;
};

function AdminAgences() {
  const [list, setList] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).rpc("get_all_partner_agencies_admin");
    setList(((data as any) ?? []) as Agency[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleVerified = async (a: Agency) => {
    const { error } = await supabase
      .from("partner_agencies" as any)
      .update({ is_verified: !a.is_verified })
      .eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(a.is_verified ? "Vérification retirée" : "Agence vérifiée");
    load();
  };

  const toggleActive = async (a: Agency) => {
    const { error } = await supabase
      .from("partner_agencies" as any)
      .update({ is_active: !a.is_active })
      .eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const grantAgenceRole = async (userId: string) => {
    const { error } = await supabase
      .from("user_roles" as any)
      .insert({ user_id: userId, role: "agence" });
    if (error && !error.message.includes("duplicate")) { toast.error(error.message); return; }
    toast.success("Rôle 'agence' attribué");
  };

  return (
    <div className="mx-auto max-w-6xl p-5">
      <h1 className="text-2xl font-bold">Agences partenaires</h1>
      <p className="text-sm text-muted-foreground">Validez les agences et gérez leur statut.</p>

      {loading ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">Chargement…</p>
      ) : list.length === 0 ? (
        <div className="mt-6 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          Aucune agence partenaire pour le moment.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {list.map((a) => (
            <article key={a.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
              {a.logo_url ? (
                <img loading="lazy" decoding="async" src={a.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary/10" />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="flex items-center gap-1.5 text-base font-bold">
                  {a.name}
                  {a.is_verified && <BadgeCheck className="h-4 w-4 text-primary" />}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {a.email ?? "—"} · {a.phone ?? "—"}
                </p>
                <p className="text-[10px] text-muted-foreground/70">ID propriétaire : {a.owner_user_id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => grantAgenceRole(a.owner_user_id)}>
                  Donner rôle agence
                </Button>
                <Button size="sm" variant={a.is_verified ? "outline" : "default"} onClick={() => toggleVerified(a)}>
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  {a.is_verified ? "Dévérifier" : "Vérifier"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(a)}>
                  <ShieldOff className="mr-1 h-3.5 w-3.5" />
                  {a.is_active ? "Désactiver" : "Activer"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
