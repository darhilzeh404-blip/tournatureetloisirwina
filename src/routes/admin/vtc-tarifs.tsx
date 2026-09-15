/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/vtc-tarifs")({
  head: () => ({ meta: [{ title: "Tarifs VTC - Admin" }] }),
  component: AdminVtcTarifs,
});

type PricingRule = {
  id: string;
  name: string;
  pickup_zone: string;
  destination_zone: string;
  category: string;
  mode: string;
  base_price: number;
  minimum_price: number;
  priority: number;
  is_active: boolean;
  updated_at: string;
};

type QueryClient = { from: (table: string) => any };
const db = supabase as unknown as QueryClient;
const fmt = (value: number) => `${value.toLocaleString("fr-FR")} FCFA`;

function AdminVtcTarifs() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db.from("vtc_pricing_rules").select("*").order("priority").order("name");
    if (error) toast.error(error.message);
    else setRules((data ?? []) as PricingRule[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const savePrice = async (rule: PricingRule) => {
    const { error } = await db.from("vtc_pricing_rules").update({ base_price: draftPrice, minimum_price: draftPrice, updated_at: new Date().toISOString() }).eq("id", rule.id);
    if (error) toast.error(error.message);
    else { toast.success("Tarif mis à jour"); setEditing(null); void load(); }
  };

  const toggle = async (rule: PricingRule) => {
    const { error } = await db.from("vtc_pricing_rules").update({ is_active: !rule.is_active, updated_at: new Date().toISOString() }).eq("id", rule.id);
    if (error) toast.error(error.message);
    else { setRules((current) => current.map((item) => item.id === rule.id ? { ...item, is_active: !item.is_active } : item)); toast.success(rule.is_active ? "Tarif désactivé" : "Tarif activé"); }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Tarifs VTC</h1><p className="text-sm text-muted-foreground">Règles centralisées, commission WINA 10 %.</p></div>
        <Button variant="outline" onClick={() => toast.info("Les nouvelles zones et règles sont ajoutées via la migration sécurisée Supabase.")}><Plus className="mr-2 h-4 w-4" /> Nouvelle règle</Button>
      </header>
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-4">Départ</th><th className="p-4">Arrivée</th><th className="p-4">Catégorie</th><th className="p-4">Prix</th><th className="p-4">Statut</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : rules.map((rule) => <tr key={rule.id} className="border-b last:border-0"><td className="p-4 font-medium">{rule.pickup_zone}</td><td className="p-4">{rule.destination_zone}</td><td className="p-4">{rule.category} · {rule.mode}</td><td className="p-4">{editing === rule.id ? <div className="flex items-center gap-2"><Input className="w-32" type="number" min={0} value={draftPrice} onChange={(event) => setDraftPrice(Number(event.target.value))} /><Button size="icon" aria-label="Enregistrer" onClick={() => void savePrice(rule)}><Save className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Annuler" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button></div> : fmt(rule.base_price)}</td><td className="p-4"><button type="button" onClick={() => void toggle(rule)} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${rule.is_active ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{rule.is_active && <Check className="h-3 w-3" />}{rule.is_active ? "Actif" : "Inactif"}</button></td><td className="p-4 text-right"><Button variant="ghost" size="icon" aria-label={`Modifier ${rule.name}`} onClick={() => { setEditing(rule.id); setDraftPrice(rule.base_price); }}><Pencil className="h-4 w-4" /></Button></td></tr>)}
        {!loading && rules.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucune règle tarifaire. Appliquez la migration Supabase.</td></tr>}
      </tbody></table></div></CardContent></Card>
    </div>
  );
}
