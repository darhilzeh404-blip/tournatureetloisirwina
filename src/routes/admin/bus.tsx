import { createFileRoute } from "@tanstack/react-router";
import { Bus, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/bus")({
  component: AdminBus,
});

type BusRow = {
  id: string;
  immatriculation: string;
  type: string;
  statut: string;
  chauffeur: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Disponible: "default",
  "En mission": "outline",
  Maintenance: "destructive",
};

const TYPES = ["14 places", "16 places", "32 places", "50 places"];
const STATUTS = ["Disponible", "En mission", "Maintenance"];

function BusFormDialog({
  bus,
  trigger,
  onSuccess,
}: {
  bus?: BusRow;
  trigger: React.ReactNode;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    immatriculation: bus?.immatriculation ?? "",
    type: bus?.type ?? "16 places",
    statut: bus?.statut ?? "Disponible",
    chauffeur: bus?.chauffeur ?? "",
  });

  const handleSubmit = async () => {
    if (!form.immatriculation.trim()) {
      toast.error("L'immatriculation est requise");
      return;
    }
    setLoading(true);
    const payload = {
      immatriculation: form.immatriculation.trim(),
      type: form.type,
      statut: form.statut,
      chauffeur: form.chauffeur.trim() || null,
    };

    const { error } = bus
      ? await supabase.from("buses").update(payload).eq("id", bus.id)
      : await supabase.from("buses").insert(payload);

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(bus ? "Bus modifié" : "Bus ajouté");
      setOpen(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v && bus) setForm({ immatriculation: bus.immatriculation, type: bus.type, statut: bus.statut, chauffeur: bus.chauffeur ?? "" }); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bus ? "Modifier le bus" : "Ajouter un bus"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Immatriculation</Label>
            <Input value={form.immatriculation} onChange={(e) => setForm({ ...form, immatriculation: e.target.value })} placeholder="LBV-1234-A" />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Statut</Label>
            <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Chauffeur</Label>
            <Input value={form.chauffeur} onChange={(e) => setForm({ ...form, chauffeur: e.target.value })} placeholder="Nom du chauffeur" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {bus ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminBus() {
  const queryClient = useQueryClient();

  const { data: buses = [], isLoading } = useQuery({
    queryKey: ["admin-buses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("buses").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as BusRow[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("buses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-buses"] }); toast.success("Bus supprimé"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-buses"] });
  const available = buses.filter((b) => b.statut === "Disponible").length;

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flotte Bus</h1>
          <p className="text-sm text-muted-foreground">{buses.length} véhicules — {available} disponibles</p>
        </div>
        <BusFormDialog trigger={<Button><Plus className="mr-2 h-4 w-4" />Ajouter</Button>} onSuccess={refresh} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : buses.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">Aucun bus enregistré</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {buses.map((bus) => (
            <Card key={bus.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Bus className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold">{bus.type}</h3>
                      <p className="text-xs text-muted-foreground">{bus.immatriculation}</p>
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[bus.statut] || "secondary"}>{bus.statut}</Badge>
                </div>
                <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                  <p>Chauffeur : <span className="text-foreground">{bus.chauffeur || "—"}</span></p>
                </div>
                <div className="mt-4 flex gap-2">
                  <BusFormDialog bus={bus} trigger={<Button size="sm" variant="outline"><Pencil className="mr-1 h-3 w-3" />Modifier</Button>} onSuccess={refresh} />
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Supprimer ce bus ?")) deleteMut.mutate(bus.id); }}>
                    <Trash2 className="mr-1 h-3 w-3" />Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
