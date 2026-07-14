import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LayoutGrid, Plus, Pencil, Trash2, Upload, X, ImagePlus, Car } from "lucide-react";
import { toast } from "sonner";
import { uploadCatalogImage, type CatalogCategory, type CatalogVehicle } from "@/lib/catalog";

export const Route = createFileRoute("/admin/catalogue")({
  head: () => ({ meta: [{ title: "Catalogue véhicules — Admin" }] }),
  component: AdminCataloguePage,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function AdminCataloguePage() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [vehicles, setVehicles] = useState<CatalogVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [catDialog, setCatDialog] = useState<CatalogCategory | "new" | null>(null);
  const [vehDialog, setVehDialog] = useState<CatalogVehicle | { new: true; category_id: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [cats, vehs] = await Promise.all([
      supabase.from("catalog_vehicle_categories" as any).select("*").order("sort_order").order("name"),
      supabase.from("catalog_vehicles" as any).select("*").order("sort_order").order("name"),
    ]);
    if (cats.error) toast.error(cats.error.message);
    if (vehs.error) toast.error(vehs.error.message);
    setCategories((cats.data as any) ?? []);
    setVehicles(
      ((vehs.data as any) ?? []).map((v: any) => ({
        ...v,
        gallery: Array.isArray(v.gallery) ? v.gallery : [],
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleCat = async (c: CatalogCategory) => {
    const { error } = await supabase
      .from("catalog_vehicle_categories" as any)
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else load();
  };

  const deleteCat = async (c: CatalogCategory) => {
    if (!confirm(`Supprimer la catégorie "${c.name}" et tous ses véhicules ?`)) return;
    const { error } = await supabase.from("catalog_vehicle_categories" as any).delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Catégorie supprimée");
      load();
    }
  };

  const toggleVeh = async (v: CatalogVehicle) => {
    const { error } = await supabase
      .from("catalog_vehicles" as any)
      .update({ is_active: !v.is_active })
      .eq("id", v.id);
    if (error) toast.error(error.message);
    else load();
  };

  const deleteVeh = async (v: CatalogVehicle) => {
    if (!confirm(`Supprimer le véhicule "${v.name}" ?`)) return;
    const { error } = await supabase.from("catalog_vehicles" as any).delete().eq("id", v.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Véhicule supprimé");
      load();
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-primary" />
            Catalogue véhicules
          </h1>
          <p className="text-sm text-muted-foreground">
            Créez les catégories et véhicules visibles par les clients. Ajoutez des photos HD et une icône 3D par catégorie.
          </p>
        </div>
        <Button onClick={() => setCatDialog("new")}>
          <Plus className="h-4 w-4 mr-1" /> Nouvelle catégorie
        </Button>
      </header>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Chargement…</p>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <Car className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Aucune catégorie. Créez-en une pour commencer.</p>
            <Button onClick={() => setCatDialog("new")}>
              <Plus className="h-4 w-4 mr-1" /> Créer une catégorie
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const catVehicles = vehicles.filter((v) => v.category_id === cat.id);
            return (
              <Card key={cat.id}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-4">
                    {cat.icon_url ? (
                      <img
                        src={cat.icon_url}
                        alt={cat.name}
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded-xl bg-muted object-contain p-1"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center">
                        <Car className="h-7 w-7 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-semibold">{cat.name}</h2>
                        <Badge variant={cat.is_active ? "default" : "secondary"}>
                          {cat.is_active ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                      {cat.description && (
                        <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={cat.is_active} onCheckedChange={() => toggleCat(cat)} />
                      <Button size="icon" variant="ghost" onClick={() => setCatDialog(cat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteCat(cat)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="pl-0 sm:pl-20">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        Véhicules ({catVehicles.length})
                      </h3>
                      <Button size="sm" variant="outline" onClick={() => setVehDialog({ new: true, category_id: cat.id })}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un véhicule
                      </Button>
                    </div>

                    {catVehicles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun véhicule dans cette catégorie.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {catVehicles.map((v) => (
                          <div key={v.id} className="rounded-lg border bg-card overflow-hidden">
                            {v.gallery[0] ? (
                              <img
                                src={v.gallery[0]}
                                alt={v.name}
                                loading="lazy"
                                className="h-40 w-full object-cover"
                              />
                            ) : (
                              <div className="h-40 w-full bg-muted flex items-center justify-center">
                                <ImagePlus className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            <div className="p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{v.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {[v.brand, v.model, v.year].filter(Boolean).join(" · ") || "—"}
                                  </p>
                                </div>
                                <Badge variant={v.is_active ? "default" : "secondary"} className="shrink-0">
                                  {v.is_active ? "Actif" : "Inactif"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 justify-end">
                                <Switch checked={v.is_active} onCheckedChange={() => toggleVeh(v)} />
                                <Button size="icon" variant="ghost" onClick={() => setVehDialog(v)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => deleteVeh(v)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CategoryDialog
        state={catDialog}
        onClose={() => setCatDialog(null)}
        onSaved={() => {
          setCatDialog(null);
          load();
        }}
      />
      <VehicleDialog
        state={vehDialog}
        onClose={() => setVehDialog(null)}
        onSaved={() => {
          setVehDialog(null);
          load();
        }}
      />
    </div>
  );
}

/* ---------- Category dialog ---------- */

function CategoryDialog({
  state,
  onClose,
  onSaved,
}: {
  state: CatalogCategory | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = state === "new";
  const editing = state && state !== "new" ? state : null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setIconUrl(editing.icon_url);
      setSortOrder(editing.sort_order);
    } else {
      setName("");
      setDescription("");
      setIconUrl(null);
      setSortOrder(0);
    }
  }, [state]);

  const onFile = async (f: File | null) => {
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadCatalogImage(f, "icons");
      setIconUrl(url);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Nom requis");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      slug: slugify(name.trim()),
      description: description.trim() || null,
      icon_url: iconUrl,
      sort_order: sortOrder,
    };
    const q = editing
      ? supabase.from("catalog_vehicle_categories" as any).update(payload).eq("id", editing.id)
      : supabase.from("catalog_vehicle_categories" as any).insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Catégorie mise à jour" : "Catégorie créée");
    onSaved();
  };

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Nouvelle catégorie" : "Modifier la catégorie"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Berline, SUV, Bus…" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description courte de la catégorie…"
              rows={3}
            />
          </div>
          <div>
            <Label>Icône 3D</Label>
            <div className="flex items-center gap-3 mt-1">
              {iconUrl ? (
                <img src={iconUrl} alt="icône" className="h-20 w-20 rounded-xl bg-muted object-contain p-1" />
              ) : (
                <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center">
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                />
                {iconUrl && (
                  <Button size="sm" variant="ghost" onClick={() => setIconUrl(null)}>
                    <X className="h-3.5 w-3.5 mr-1" /> Retirer
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div>
            <Label>Ordre d'affichage</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving || uploading}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Vehicle dialog ---------- */

function VehicleDialog({
  state,
  onClose,
  onSaved,
}: {
  state: CatalogVehicle | { new: true; category_id: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = state && !("new" in (state as any)) ? (state as CatalogVehicle) : null;
  const newCat = state && "new" in (state as any) ? (state as { new: true; category_id: string }).category_id : null;

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<string>("");
  const [seats, setSeats] = useState<string>("");
  const [dailyRate, setDailyRate] = useState<string>("");
  const [description, setDescription] = useState("");
  const [gallery, setGallery] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setBrand(editing.brand ?? "");
      setModel(editing.model ?? "");
      setYear(editing.year?.toString() ?? "");
      setSeats(editing.seats?.toString() ?? "");
      setDailyRate(editing.daily_rate?.toString() ?? "");
      setDescription(editing.description ?? "");
      setGallery(editing.gallery ?? []);
      setSortOrder(editing.sort_order);
    } else {
      setName("");
      setBrand("");
      setModel("");
      setYear("");
      setSeats("");
      setDailyRate("");
      setDescription("");
      setGallery([]);
      setSortOrder(0);
    }
  }, [state]);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls = await Promise.all(
        Array.from(files).map((f) => uploadCatalogImage(f, "vehicles")),
      );
      setGallery((g) => [...g, ...urls]);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (i: number) => setGallery((g) => g.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!name.trim()) {
      toast.error("Nom requis");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      brand: brand.trim() || null,
      model: model.trim() || null,
      year: year ? parseInt(year) : null,
      seats: seats ? parseInt(seats) : null,
      description: description.trim() || null,
      gallery,
      sort_order: sortOrder,
      ...(editing ? {} : { category_id: newCat }),
    };
    const q = editing
      ? supabase.from("catalog_vehicles" as any).update(payload).eq("id", editing.id)
      : supabase.from("catalog_vehicles" as any).insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Véhicule mis à jour" : "Véhicule ajouté");
    onSaved();
  };

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier le véhicule" : "Nouveau véhicule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kia K7 Édition Prestige" />
            </div>
            <div>
              <Label>Marque</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Kia" />
            </div>
            <div>
              <Label>Modèle</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="K7" />
            </div>
            <div>
              <Label>Année</Label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" />
            </div>
            <div>
              <Label>Places</Label>
              <Input type="number" value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="4" />
            </div>
            <div>
              <Label>Ordre</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Galerie photos HD</Label>
            <div className="mt-1 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {gallery.map((url, i) => (
                  <div key={i} className="relative group aspect-video rounded-lg overflow-hidden bg-muted">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 rounded-full bg-black/70 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Retirer"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-dashed p-3 cursor-pointer hover:bg-muted/50 text-sm">
                <Upload className="h-4 w-4" />
                <span>{uploading ? "Envoi en cours…" : "Ajouter des photos (multi-sélection)"}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onFiles(e.target.files)}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving || uploading}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
