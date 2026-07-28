import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { TrainFront, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchTrainReference, STATION_KIND_LABEL,
  type TrainType, type TrainStation, type TrainClass, type TrainDiscountRule,
} from "@/lib/train";
import { TrainRoutesBaggage } from "@/components/admin/TrainRoutesBaggage";
import { TrainTickets } from "@/components/admin/TrainTickets";

export const Route = createFileRoute("/admin/trains")({
  head: () => ({ meta: [{ title: "Configuration Train — Admin" }] }),
  component: AdminTrainsPage,
});

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function AdminTrainsPage() {
  const [types, setTypes] = useState<TrainType[]>([]);
  const [stations, setStations] = useState<TrainStation[]>([]);
  const [classes, setClasses] = useState<TrainClass[]>([]);
  const [discounts, setDiscounts] = useState<TrainDiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [newType, setNewType] = useState({ name: "", station_kind: "principale" as TrainStation["station_kind"] });
  const [newStation, setNewStation] = useState({ name: "", city: "", station_kind: "principale" as TrainStation["station_kind"] });
  const [newClass, setNewClass] = useState({ name: "" });

  const load = async () => {
    setLoading(true);
    const r = await fetchTrainReference();
    setTypes(r.types); setStations(r.stations); setClasses(r.classes); setDiscounts(r.discounts);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<{ error: any }>, okMsg: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(okMsg); load(); }
  };

  const addType = () => {
    if (!newType.name.trim()) return toast.error("Nom requis");
    run(() => supabase.from("train_types" as any).insert({
      name: newType.name.trim(), code: slugify(newType.name), station_kind: newType.station_kind,
      sort_order: types.length + 1,
    }) as any, "Type de train ajouté").then(() => setNewType({ name: "", station_kind: "principale" }));
  };

  const addStation = () => {
    if (!newStation.name.trim()) return toast.error("Nom requis");
    run(() => supabase.from("train_stations" as any).insert({
      name: newStation.name.trim(), city: newStation.city.trim(), station_kind: newStation.station_kind,
      sort_order: stations.length + 1,
    }) as any, "Gare ajoutée").then(() => setNewStation({ name: "", city: "", station_kind: "principale" }));
  };

  const addClass = () => {
    if (!newClass.name.trim()) return toast.error("Nom requis");
    run(() => supabase.from("train_travel_classes" as any).insert({
      name: newClass.name.trim(), code: slugify(newClass.name), sort_order: classes.length + 1,
    }) as any, "Classe ajoutée").then(() => setNewClass({ name: "" }));
  };

  const del = (table: string, id: string) =>
    run(() => supabase.from(table as any).delete().eq("id", id) as any, "Supprimé");

  const patch = (table: string, id: string, values: Record<string, unknown>) =>
    run(() => supabase.from(table as any).update(values).eq("id", id) as any, "Enregistré");

  if (loading) return <p className="p-10 text-center text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <TrainFront className="h-6 w-6 text-primary" /> Configuration Train
        </h1>
        <p className="text-sm text-muted-foreground">
          Types de train, gares desservies, classes de voyage et réductions automatiques.
        </p>
      </header>

      {/* Types de train */}
      <Card><CardContent className="space-y-3 p-4">
        <h2 className="font-semibold">Types de train</h2>
        {types.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
            <Input className="w-52" value={t.name} onChange={(e) => setTypes(types.map((x) => x.id === t.id ? { ...x, name: e.target.value } : x))}
              onBlur={(e) => patch("train_types", t.id, { name: e.target.value })} />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={t.station_kind}
              onChange={(e) => patch("train_types", t.id, { station_kind: e.target.value })}
            >
              <option value="principale">Gares principales</option>
              <option value="secondaire">Gares secondaires</option>
            </select>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={t.is_active} onCheckedChange={(v) => patch("train_types", t.id, { is_active: v })} />
              {t.is_active ? "Actif" : "Inactif"}
            </label>
            <Button size="icon" variant="ghost" className="ml-auto text-destructive" onClick={() => del("train_types", t.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-52" placeholder="Nouveau type" value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={newType.station_kind} onChange={(e) => setNewType({ ...newType, station_kind: e.target.value as any })}>
            <option value="principale">Gares principales</option>
            <option value="secondaire">Gares secondaires</option>
          </select>
          <Button onClick={addType} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter</Button>
        </div>
      </CardContent></Card>

      {/* Gares */}
      <Card><CardContent className="space-y-3 p-4">
        <h2 className="font-semibold">Gares desservies</h2>
        {(["principale", "secondaire"] as const).map((kind) => (
          <div key={kind} className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{STATION_KIND_LABEL[kind]}s</p>
            {stations.filter((s) => s.station_kind === kind).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                <Input className="w-52" defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && patch("train_stations", s.id, { name: e.target.value })} />
                <Input className="w-40" placeholder="Ville" defaultValue={s.city} onBlur={(e) => e.target.value !== s.city && patch("train_stations", s.id, { city: e.target.value })} />
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={s.station_kind} onChange={(e) => patch("train_stations", s.id, { station_kind: e.target.value })}>
                  <option value="principale">Principale</option>
                  <option value="secondaire">Secondaire</option>
                </select>
                <label className="flex items-center gap-2 text-xs">
                  <Switch checked={s.is_active} onCheckedChange={(v) => patch("train_stations", s.id, { is_active: v })} />
                  {s.is_active ? "Active" : "Inactive"}
                </label>
                <Button size="icon" variant="ghost" className="ml-auto text-destructive" onClick={() => del("train_stations", s.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-52" placeholder="Nouvelle gare" value={newStation.name} onChange={(e) => setNewStation({ ...newStation, name: e.target.value })} />
          <Input className="w-40" placeholder="Ville" value={newStation.city} onChange={(e) => setNewStation({ ...newStation, city: e.target.value })} />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={newStation.station_kind} onChange={(e) => setNewStation({ ...newStation, station_kind: e.target.value as any })}>
            <option value="principale">Principale</option>
            <option value="secondaire">Secondaire</option>
          </select>
          <Button onClick={addStation} disabled={busy}><Plus className="h-4 w-4" /> Ajouter</Button>
        </div>
      </CardContent></Card>

      {/* Classes */}
      <Card><CardContent className="space-y-3 p-4">
        <h2 className="font-semibold">Classes de voyage</h2>
        <p className="text-xs text-muted-foreground">
          Le fret et les trains de marchandises ne sont pas des classes de voyage et n'apparaissent pas ici.
        </p>
        {classes.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
            <Input className="w-52" defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && patch("train_travel_classes", c.id, { name: e.target.value })} />
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={c.is_active} onCheckedChange={(v) => patch("train_travel_classes", c.id, { is_active: v })} />
              {c.is_active ? "Active" : "Inactive"}
            </label>
            <Button size="icon" variant="ghost" className="ml-auto text-destructive" onClick={() => del("train_travel_classes", c.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Input className="w-52" placeholder="Nouvelle classe" value={newClass.name} onChange={(e) => setNewClass({ name: e.target.value })} />
          <Button onClick={addClass} disabled={busy}><Plus className="h-4 w-4" /> Ajouter</Button>
        </div>
      </CardContent></Card>

      {/* Dessertes + bagages */}
      <TrainRoutesBaggage types={types} stations={stations} />

      {/* Réductions */}
      <Card><CardContent className="space-y-3 p-4">
        <h2 className="font-semibold">Réductions automatiques</h2>
        {discounts.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
            <Input className="w-64" defaultValue={d.label} onBlur={(e) => e.target.value !== d.label && patch("train_discount_rules", d.id, { label: e.target.value })} />
            <span className="text-xs text-muted-foreground">{d.applies_to === "main" ? "Voyageur principal" : "Enfant"}</span>
            <Input className="w-20" type="number" placeholder="Âge min" defaultValue={d.min_age ?? ""}
              onBlur={(e) => patch("train_discount_rules", d.id, { min_age: e.target.value === "" ? null : Number(e.target.value) })} />
            <Input className="w-20" type="number" placeholder="Âge max" defaultValue={d.max_age ?? ""}
              onBlur={(e) => patch("train_discount_rules", d.id, { max_age: e.target.value === "" ? null : Number(e.target.value) })} />
            <div className="flex items-center gap-1">
              <Input className="w-20" type="number" defaultValue={d.percent}
                onBlur={(e) => patch("train_discount_rules", d.id, { percent: Number(e.target.value) })} />
              <span className="text-xs">%</span>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={d.is_active} onCheckedChange={(v) => patch("train_discount_rules", d.id, { is_active: v })} />
              {d.is_active ? "Active" : "Inactive"}
            </label>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}
