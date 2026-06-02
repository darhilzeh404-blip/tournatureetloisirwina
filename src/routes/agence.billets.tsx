import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TicketCategoryIcon } from "@/components/TicketCategoryIcon";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/agence/billets")({
  component: AgenceBillets,
});

type Category = { id: string; slug: string; name: string };
type PartnerTicket = {
  id: string; category_id: string; title: string; origin: string | null;
  destination: string | null; departure_at: string | null; price: number;
  seats_available: number; description: string; image_url: string | null; is_active: boolean;
};

const empty = {
  category_id: "", title: "", origin: "", destination: "",
  departure_at: "", price: 0, seats_available: 1, description: "", image_url: "", is_active: true,
};

function AgenceBillets() {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [list, setList] = useState<PartnerTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    if (!user) return;
    const { data: agency } = await supabase
      .from("partner_agencies" as any)
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (!agency) { setLoading(false); return; }
    const aId = (agency as any).id;
    setAgencyId(aId);
    const [cats, tickets] = await Promise.all([
      supabase.from("ticket_categories" as any).select("id, slug, name").order("sort_order"),
      supabase.from("partner_tickets" as any).select("*").eq("agency_id", aId).order("created_at", { ascending: false }),
    ]);
    setCategories((cats.data as any) ?? []);
    setList(((tickets.data as any) ?? []) as PartnerTicket[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const uploadImage = async (file: File) => {
    if (!user) return null;
    const path = `${user.id}/ticket-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("partner-tickets").upload(path, file);
    if (error) { toast.error(error.message); return null; }
    return supabase.storage.from("partner-tickets").getPublicUrl(path).data.publicUrl;
  };

  const save = async () => {
    if (!agencyId || !editing) return;
    if (!editing.title?.trim() || !editing.category_id) {
      toast.error("Titre et catégorie requis"); return;
    }
    const payload: any = {
      agency_id: agencyId,
      category_id: editing.category_id,
      title: editing.title,
      origin: editing.origin || null,
      destination: editing.destination || null,
      departure_at: editing.departure_at ? new Date(editing.departure_at).toISOString() : null,
      price: Number(editing.price) || 0,
      seats_available: Number(editing.seats_available) || 0,
      description: editing.description || "",
      image_url: editing.image_url || null,
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("partner_tickets" as any).update(payload).eq("id", editing.id)
      : await supabase.from("partner_tickets" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Billet enregistré");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce billet ?")) return;
    const { error } = await supabase.from("partner_tickets" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supprimé");
    load();
  };

  if (loading) return <p className="text-center text-sm text-muted-foreground">Chargement…</p>;
  if (!agencyId) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Configurez d'abord votre profil agence.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes billets</h1>
        <Button onClick={() => setEditing({ ...empty, category_id: categories[0]?.id ?? "" })}>
          <Plus className="mr-1 h-4 w-4" /> Nouveau
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          Aucun billet publié.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((t) => {
            const cat = categories.find((c) => c.id === t.category_id);
            return (
              <article key={t.id} className="overflow-hidden rounded-2xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <TicketCategoryIcon slug={cat?.slug ?? ""} className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="truncate text-sm font-bold">{t.title}</h3>
                    <p className="text-xs text-muted-foreground">{cat?.name}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {t.is_active ? "Actif" : "Inactif"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.origin ?? "—"} → {t.destination ?? "—"}
                  {t.departure_at && ` · ${new Date(t.departure_at).toLocaleDateString("fr-FR")}`}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-primary">{new Intl.NumberFormat("fr-FR").format(t.price)} FCFA</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...t, departure_at: t.departure_at ? t.departure_at.slice(0, 16) : "" })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing.id ? "Modifier" : "Nouveau billet"}</h2>
              <button onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold">Catégorie *</label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold">Titre *</label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold">Origine</label>
                  <Input value={editing.origin ?? ""} onChange={(e) => setEditing({ ...editing, origin: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold">Destination</label>
                  <Input value={editing.destination ?? ""} onChange={(e) => setEditing({ ...editing, destination: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold">Date / heure</label>
                  <Input type="datetime-local" value={editing.departure_at ?? ""} onChange={(e) => setEditing({ ...editing, departure_at: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold">Prix (FCFA)</label>
                  <Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold">Places</label>
                  <Input type="number" value={editing.seats_available} onChange={(e) => setEditing({ ...editing, seats_available: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold">Description</label>
                <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold">Image</label>
                <div className="mt-1 flex items-center gap-3">
                  {editing.image_url && <img loading="lazy" decoding="async" src={editing.image_url} alt="" className="h-14 w-14 rounded-md object-cover" />}
                  <Input type="file" accept="image/*" onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const url = await uploadImage(f);
                    if (url) setEditing({ ...editing, image_url: url });
                  }} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                Billet actif (visible publiquement)
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
                <Button onClick={save}>Enregistrer</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
