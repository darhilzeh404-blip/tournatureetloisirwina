import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Ticket as TicketIcon, Plus, Pencil, Trash2, ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/billets")({
  head: () => ({ meta: [{ title: "Billets — Admin" }] }),
  component: AdminBilletsPage,
});

type Ticket = {
  id: string;
  title: string;
  price: number;
  description: string;
  conditions: string;
  images: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

const FCFA = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

function AdminBilletsPage() {
  const [list, setList] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Ticket | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets" as any)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setList((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (t: Ticket) => {
    const { error } = await supabase.from("tickets" as any).update({ is_active: !t.is_active }).eq("id", t.id);
    if (error) toast.error(error.message);
    else { toast.success(!t.is_active ? "Billet activé" : "Billet désactivé"); load(); }
  };

  const remove = async () => {
    if (!toDelete) return;
    // Best-effort delete of associated images
    const paths = toDelete.images
      .map((u) => {
        const i = u.indexOf("/ticket-images/");
        return i >= 0 ? u.slice(i + "/ticket-images/".length) : null;
      })
      .filter(Boolean) as string[];
    if (paths.length) {
      await supabase.storage.from("ticket-images").remove(paths);
    }
    const { error } = await supabase.from("tickets" as any).delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else { toast.success("Billet supprimé"); load(); }
    setToDelete(null);
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TicketIcon className="h-6 w-6 text-primary" /> Billets</h1>
          <p className="text-sm text-muted-foreground">{list.length} billet{list.length > 1 ? "s" : ""} — gestion libre et flexible</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Nouveau billet</Button>
      </header>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Chargement…</p>
      ) : list.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Aucun billet pour le moment. Créez-en un avec le bouton ci-dessus.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              {t.images[0] && (
                <div className="h-40 w-full overflow-hidden bg-muted">
                  <img src={t.images[0]} alt={t.title} className="h-full w-full object-cover" loading="lazy" />
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{t.title}</h3>
                  <Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Actif" : "Inactif"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                <p className="text-sm font-bold text-primary">{FCFA(t.price)}</p>
                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                    {t.is_active ? "Visible" : "Masqué"}
                  </label>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(t)} aria-label="Éditer"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setToDelete(t)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TicketFormDialog
        open={creating || !!editing}
        ticket={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce billet ?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" et toutes ses images seront définitivement supprimés. Action irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TicketFormDialog({ open, ticket, onClose, onSaved }: {
  open: boolean; ticket: Ticket | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: "", price: 0, description: "", conditions: "", is_active: true, sort_order: 0,
  });
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        title: ticket?.title ?? "",
        price: ticket?.price ?? 0,
        description: ticket?.description ?? "",
        conditions: ticket?.conditions ?? "",
        is_active: ticket?.is_active ?? true,
        sort_order: ticket?.sort_order ?? 0,
      });
      setImages(ticket?.images ?? []);
    }
  }, [open, ticket]);

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const f of Array.from(files)) {
      const path = `${crypto.randomUUID()}-${f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error } = await supabase.storage.from("ticket-images").upload(path, f, { upsert: false });
      if (error) { toast.error(error.message); continue; }
      const { data } = supabase.storage.from("ticket-images").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }
    setImages((prev) => [...prev, ...uploaded]);
    setUploading(false);
  };

  const removeImage = async (url: string) => {
    setImages((prev) => prev.filter((u) => u !== url));
    const i = url.indexOf("/ticket-images/");
    if (i >= 0) {
      const path = url.slice(i + "/ticket-images/".length);
      await supabase.storage.from("ticket-images").remove([path]);
    }
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Titre requis"); return; }
    if (form.price < 0) { toast.error("Prix invalide"); return; }
    setSaving(true);
    const payload = { ...form, title: form.title.trim(), images };
    const { error } = ticket
      ? await supabase.from("tickets" as any).update(payload).eq("id", ticket.id)
      : await supabase.from("tickets" as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(ticket ? "Billet mis à jour" : "Billet créé");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ticket ? "Modifier le billet" : "Nouveau billet"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Titre *</label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex: Festival Gabao 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Prix (FCFA) *</label>
              <Input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={form.price === 0 ? "" : String(form.price)}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, price: v === "" ? 0 : parseInt(v, 10) });
                }}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Ordre</label>
              <Input
                type="text" inputMode="numeric"
                value={String(form.sort_order)}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, sort_order: v === "" ? 0 : parseInt(v, 10) });
                }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Description / informations</label>
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Détails du billet, contenu, horaires, etc." />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Conditions (optionnel)</label>
            <Textarea rows={3} value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} placeholder="Conditions d'utilisation, annulation, etc." />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Images</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {images.map((url) => (
                <div key={url} className="relative h-20 w-20 overflow-hidden rounded-lg border">
                  <img loading="lazy" decoding="async" src={url} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeImage(url)} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-accent">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <span className="text-[10px] mt-1">Ajouter</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} disabled={uploading} />
              </label>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm pt-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            Billet actif (visible par les clients)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={save} disabled={saving || uploading}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {ticket ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
