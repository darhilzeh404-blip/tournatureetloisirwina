import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, Plus, Percent, Coins as CoinsIcon } from "lucide-react";

export const Route = createFileRoute("/admin/frais")({
  component: FraisAdminPage,
});

type Fee = {
  id: string;
  name: string;
  description: string | null;
  service_type: string | null;
  fee_type: "percentage" | "fixed";
  amount: number;
  is_active: boolean;
  created_at: string;
};

const SERVICE_OPTIONS = [
  { value: "ALL", label: "Tous services" },
  { value: "VTC", label: "VTC" },
  { value: "BUS", label: "Bus" },
  { value: "SCOLAIRE", label: "Scolaire" },
  { value: "LOCATION", label: "Location" },
  { value: "CIRCUIT", label: "Circuit" },
  { value: "BILLET", label: "Billet" },
];

function FraisAdminPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    description: "",
    service_type: "ALL",
    fee_type: "percentage" as "percentage" | "fixed",
    amount: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("application_fees" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setFees(((data as any) ?? []) as Fee[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) return toast.error("Nom requis");
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return toast.error("Montant invalide");
    const { error } = await supabase.from("application_fees" as any).insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      service_type: form.service_type === "ALL" ? null : form.service_type,
      fee_type: form.fee_type,
      amount: amt,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Frais créé");
    setForm({ name: "", description: "", service_type: "ALL", fee_type: "percentage", amount: "" });
    load();
  };

  const toggle = async (fee: Fee) => {
    const { error } = await supabase
      .from("application_fees" as any)
      .update({ is_active: !fee.is_active } as any)
      .eq("id", fee.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce frais ?")) return;
    const { error } = await supabase.from("application_fees" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimé");
    load();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Frais application</h1>
        <p className="text-sm text-muted-foreground">Gérez les frais appliqués sur les réservations et billets.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4" /> Nouveau frais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nom</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Frais plateforme" />
          </div>
          <div className="space-y-1.5">
            <Label>Service concerné</Label>
            <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.fee_type} onValueChange={(v: any) => setForm({ ...form, fee_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                <SelectItem value="fixed">Montant fixe (FCFA)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{form.fee_type === "percentage" ? "Pourcentage" : "Montant (FCFA)"}</Label>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Description (optionnel)</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={create} className="w-full md:w-auto">Créer le frais</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Frais existants ({fees.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : fees.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucun frais configuré.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Valeur</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fees.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <div className="font-medium">{f.name}</div>
                      {f.description && <div className="text-xs text-muted-foreground">{f.description}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{f.service_type ?? "Tous"}</TableCell>
                    <TableCell className="text-sm">
                      {f.fee_type === "percentage" ? <Percent className="inline h-3 w-3" /> : <CoinsIcon className="inline h-3 w-3" />}
                      {" "}{f.fee_type === "percentage" ? "%" : "FCFA"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {f.amount}{f.fee_type === "percentage" ? " %" : " FCFA"}
                    </TableCell>
                    <TableCell><Switch checked={f.is_active} onCheckedChange={() => toggle(f)} /></TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => remove(f.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
