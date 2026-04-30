import { createFileRoute } from "@tanstack/react-router";
import { Tag, Plus, Pencil, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/offres")({
  component: AdminOffres,
});

type OfferRow = {
  id: string;
  title: string;
  description: string;
  service_type: string;
  price: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const SERVICE_LABELS: Record<string, string> = {
  TRANSPORT_SCOLAIRE: "Transport scolaire",
  LOCATION_BUS: "Location de bus",
  CIRCUIT_TOURISTIQUE: "Circuit touristique",
  VTC: "VTC / Transfert",
};

function OfferFormDialog({
  offer,
  trigger,
  onSuccess,
}: {
  offer?: OfferRow;
  trigger: React.ReactNode;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: offer?.title ?? "",
    description: offer?.description ?? "",
    service_type: offer?.service_type ?? "LOCATION_BUS",
    price: offer?.price ?? 0,
    image_url: offer?.image_url ?? "",
    is_active: offer?.is_active ?? true,
  });

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    setLoading(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      service_type: form.service_type,
      price: form.price,
      image_url: form.image_url.trim() || null,
      is_active: form.is_active,
    };

    const { error } = offer
      ? await supabase.from("offers").update(payload).eq("id", offer.id)
      : await supabase.from("offers").insert(payload);

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(offer ? "Offre modifiée" : "Offre créée");
      setOpen(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v && offer) setForm({ title: offer.title, description: offer.description, service_type: offer.service_type, price: offer.price, image_url: offer.image_url ?? "", is_active: offer.is_active }); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{offer ? "Modifier l'offre" : "Créer une offre"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Titre</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Excursion Lopé" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Détails de l'offre…" rows={3} />
          </div>
          <div className="space-y-1">
            <Label>Type de service</Label>
            <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SERVICE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Prix (FCFA)</Label>
            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} min={0} />
          </div>
          <div className="space-y-1">
            <Label>URL de l'image</Label>
            <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label>Offre active</Label>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {offer ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminOffres() {
  const queryClient = useQueryClient();

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["admin-offers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("offers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as OfferRow[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("offers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-offers"] }); toast.success("Offre supprimée"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("offers").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-offers"] }); toast.success("Statut mis à jour"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-offers"] });

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Offres & Services</h1>
          <p className="text-sm text-muted-foreground">{offers.length} offres — {offers.filter((o) => o.is_active).length} actives</p>
        </div>
        <OfferFormDialog trigger={<Button><Plus className="mr-2 h-4 w-4" />Nouvelle offre</Button>} onSuccess={refresh} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : offers.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">Aucune offre créée</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {offers.map((offer) => (
            <Card key={offer.id} className={!offer.is_active ? "opacity-60" : ""}>
              <CardContent className="p-5">
                {offer.image_url && (
                  <img src={offer.image_url} alt={offer.title} className="mb-3 h-32 w-full rounded-lg object-cover" />
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Tag className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{offer.title}</h3>
                      <p className="text-xs text-muted-foreground">{SERVICE_LABELS[offer.service_type] || offer.service_type}</p>
                    </div>
                  </div>
                  <Badge variant={offer.is_active ? "default" : "secondary"}>{offer.is_active ? "Active" : "Inactive"}</Badge>
                </div>
                {offer.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{offer.description}</p>
                )}
                <p className="mt-2 text-lg font-bold text-primary">{offer.price.toLocaleString("fr-FR")} FCFA</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <OfferFormDialog offer={offer} trigger={<Button size="sm" variant="outline"><Pencil className="mr-1 h-3 w-3" />Modifier</Button>} onSuccess={refresh} />
                  <Button size="sm" variant="outline" onClick={() => toggleMut.mutate({ id: offer.id, is_active: !offer.is_active })}>
                    {offer.is_active ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
                    {offer.is_active ? "Désactiver" : "Activer"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Supprimer cette offre ?")) deleteMut.mutate(offer.id); }}>
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
