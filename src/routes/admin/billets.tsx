import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Ticket as TicketIcon, Plus, Pencil, Trash2, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { randomId } from "@/lib/random-id";

export const Route = createFileRoute("/admin/billets")({
  head: () => ({ meta: [{ title: "Billets — Admin" }] }),
  component: AdminBilletsPage,
});

type Agency = { id: string; name: string; logo_url: string | null; category: string | null };
type Category = { id: string; slug: string; name: string; sort_order: number };

type PartnerTicket = {
  id: string;
  agency_id: string;
  category_id: string | null;
  title: string;
  origin: string | null;
  destination: string | null;
  departure_at: string | null;
  price: number;
  seats_available: number;
  seats_total: number | null;
  description: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
};

const FCFA = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

type FormState = {
  id: string | null;
  agency_id: string;
  category_id: string;
  title: string;
  origin: string;
  destination: string;
  departure_at: string; // datetime-local
  price: number;
  seats_available: number;
  description: string;
  image_url: string;
  is_active: boolean;
};

const emptyForm = (): FormState => ({
  id: null,
  agency_id: "",
  category_id: "",
  title: "",
  origin: "",
  destination: "",
  departure_at: "",
  price: 0,
  seats_available: 0,
  description: "",
  image_url: "",
  is_active: true,
});

function AdminBilletsPage() {
  const [list, setList] = useState<PartnerTicket[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [toDelete, setToDelete] = useState<PartnerTicket | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [ticketsRes, agenciesRes, catsRes] = await Promise.all([
      supabase.from("partner_tickets" as any).select("*").order("created_at", { ascending: false }),
      supabase.rpc("get_all_partner_agencies_admin"),
      supabase.from("ticket_categories" as any).select("id, slug, name, sort_order").order("sort_order"),
    ]);
    if (ticketsRes.error) toast.error(ticketsRes.error.message);
    setList(((ticketsRes.data as any) ?? []) as PartnerTicket[]);
    setAgencies(((agenciesRes.data as any) ?? []) as Agency[]);
    setCategories(((catsRes.data as any) ?? []) as Category[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyForm()); setDialogOpen(true); };

  const openEdit = (t: PartnerTicket) => {
    setForm({
      id: t.id,
      agency_id: t.agency_id,
      category_id: t.category_id ?? "",
      title: t.title,
      origin: t.origin ?? "",
      destination: t.destination ?? "",
      departure_at: t.departure_at ? t.departure_at.slice(0, 16) : "",
      price: t.price,
      seats_available: t.seats_available,
      description: t.description ?? "",
      image_url: t.image_url ?? "",
      is_active: t.is_active,
    });
    setDialogOpen(true);
  };

  const toggleActive = async (t: PartnerTicket) => {
    const { error } = await supabase.from("partner_tickets" as any).update({ is_active: !t.is_active }).eq("id", t.id);
    if (error) toast.error(error.message);
    else { toast.success(!t.is_active ? "Billet activé" : "Billet désactivé"); load(); }
  };

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("partner_tickets" as any).delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else { toast.success("Billet supprimé"); load(); }
    setToDelete(null);
  };

  const onImageFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `partner-tickets/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error } = await supabase.storage.from("ticket-images").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("ticket-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Image téléversée");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const save = async () => {
    if (!form.agency_id) return toast.error("Agence requise");
    if (!form.category_id) return toast.error("Catégorie requise");
    if (!form.title.trim()) return toast.error("Titre requis");
    if (form.price < 0) return toast.error("Prix invalide");
    if (form.seats_available < 0) return toast.error("Nombre de places invalide");
    setSaving(true);
    try {
      const payload: any = {
        agency_id: form.agency_id,
        category_id: form.category_id,
        title: form.title.trim(),
        origin: form.origin || null,
        destination: form.destination || null,
        departure_at: form.departure_at ? new Date(form.departure_at).toISOString() : null,
        price: form.price,
        seats_available: form.seats_available,
        seats_total: form.seats_available,
        description: form.description,
        image_url: form.image_url || null,
        is_active: form.is_active,
      };
      if (form.id) {
        const { error } = await supabase.from("partner_tickets" as any).update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Billet mis à jour");
      } else {
        const { error } = await supabase.from("partner_tickets" as any).insert(payload);
        if (error) throw error;
        toast.success("Billet créé");
      }
      setDialogOpen(false);
      setForm(emptyForm());
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const agencyName = (id: string) => agencies.find((a) => a.id === id)?.name ?? "—";
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TicketIcon className="h-6 w-6 text-primary" /> Billets
          </h1>
          <p className="text-sm text-muted-foreground">
            {list.length} billet{list.length > 1 ? "s" : ""} — gestion centralisée par l'administrateur.
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nouveau billet</Button>
      </header>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Chargement…</p>
      ) : list.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          Aucun billet pour le moment. Créez-en un avec le bouton ci-dessus.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              {t.image_url && (
                <div className="h-40 w-full overflow-hidden bg-muted">
                  <img src={t.image_url} alt={t.title} className="h-full w-full object-cover" loading="lazy" />
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{t.title}</h3>
                  <Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Actif" : "Inactif"}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {agencyName(t.agency_id)} · {categoryName(t.category_id)}
                </p>
                {(t.origin || t.destination) && (
                  <p className="text-xs">{t.origin ?? "—"} → {t.destination ?? "—"}</p>
                )}
                {t.departure_at && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.departure_at).toLocaleString("fr-FR")}
                  </p>
                )}
                <p className="text-sm font-bold text-primary">
                  {FCFA(t.price)} · {t.seats_available} place{t.seats_available > 1 ? "s" : ""}
                </p>
                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                    {t.is_active ? "Visible" : "Masqué"}
                  </label>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)} aria-label="Éditer">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setToDelete(t)} aria-label="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setForm(emptyForm()); } }}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifier le billet" : "Nouveau billet"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Agence *</label>
                <select
                  value={form.agency_id}
                  onChange={(e) => setForm({ ...form, agency_id: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— Choisir —</option>
                  {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Catégorie *</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— Choisir —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Titre *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex: Libreville → Port-Gentil" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Origine</label>
                <Input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Destination</label>
                <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Date / Heure</label>
                <Input type="datetime-local" value={form.departure_at} onChange={(e) => setForm({ ...form, departure_at: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Prix (FCFA) *</label>
                <Input
                  type="text" inputMode="numeric"
                  value={form.price === 0 ? "" : String(form.price)}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setForm({ ...form, price: v === "" ? 0 : parseInt(v, 10) });
                  }}
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Nombre de places *</label>
              <Input
                type="text" inputMode="numeric"
                value={String(form.seats_available)}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, seats_available: v === "" ? 0 : parseInt(v, 10) });
                }}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Description</label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Image</label>
              <div className="mt-1 flex items-center gap-3">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="h-16 w-24 rounded-lg object-cover border" />
                ) : (
                  <div className="h-16 w-24 rounded-lg bg-muted" />
                )}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Téléversement…" : "Choisir"}
                  <input type="file" accept="image/*" className="hidden" onChange={onImageFile} disabled={uploading} />
                </label>
                {form.image_url && (
                  <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, image_url: "" })}>Retirer</Button>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm pt-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              Actif (visible par les clients)
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setDialogOpen(false); setForm(emptyForm()); }}>Annuler</Button>
              <Button onClick={save} disabled={saving || uploading}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {form.id ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce billet ?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" sera définitivement supprimé. Action irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
