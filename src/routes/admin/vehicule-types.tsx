import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Car, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/vehicule-types")({
  head: () => ({ meta: [{ title: "Types de véhicules — Admin" }] }),
  component: AdminVehicleTypesPage,
});

type VehicleType = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

function AdminVehicleTypesPage() {
  const [list, setList] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [toDelete, setToDelete] = useState<VehicleType | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vehicle_types" as any)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) toast.error(error.message);
    setList((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    const name = newName.trim();
    if (!name) { toast.error("Nom requis"); return; }
    setAdding(true);
    const { error } = await supabase.from("vehicle_types" as any).insert({ name, sort_order: list.length + 1 });
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`"${name}" ajouté`);
    setNewName("");
    load();
  };

  const toggle = async (v: VehicleType) => {
    const { error } = await supabase.from("vehicle_types" as any).update({ is_active: !v.is_active }).eq("id", v.id);
    if (error) toast.error(error.message);
    else load();
  };

  const saveEdit = async (v: VehicleType) => {
    const name = editingName.trim();
    if (!name) { toast.error("Nom requis"); return; }
    const { error } = await supabase.from("vehicle_types" as any).update({ name }).eq("id", v.id);
    if (error) { toast.error(error.message); return; }
    setEditingId(null);
    load();
  };

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("vehicle_types" as any).delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else { toast.success("Supprimé"); load(); }
    setToDelete(null);
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Car className="h-6 w-6 text-primary" /> Types de véhicules</h1>
        <p className="text-sm text-muted-foreground">Catalogue dynamique utilisé à la création des chauffeurs VTC.</p>
      </header>

      <Card>
        <CardContent className="p-4 flex gap-2">
          <Input
            placeholder="Ajouter un type (ex: Luxe, Minibus...)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} disabled={adding}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-muted-foreground text-center py-12">Chargement…</p>
          ) : list.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">Aucun type configuré.</p>
          ) : (
            <ul className="divide-y">
              {list.map((v) => (
                <li key={v.id} className="flex items-center gap-3 p-3">
                  {editingId === v.id ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(v); if (e.key === "Escape") setEditingId(null); }}
                      />
                      <Button size="icon" variant="ghost" onClick={() => saveEdit(v)}><Check className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-medium">{v.name}</span>
                      <Badge variant={v.is_active ? "default" : "secondary"}>{v.is_active ? "Actif" : "Inactif"}</Badge>
                      <Switch checked={v.is_active} onCheckedChange={() => toggle(v)} />
                      <Button size="icon" variant="ghost" onClick={() => { setEditingId(v.id); setEditingName(v.name); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setToDelete(v)}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce type ?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.name}" sera retiré de la liste. Les chauffeurs déjà associés conservent leur valeur.
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
