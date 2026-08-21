import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
import { NumericBlurField } from "@/components/ui/numeric-text-field";
  fetchTrainRoutes,
  type TrainRoute, type TrainRouteStation, type TrainBaggageRule,
  type TrainType, type TrainStation,
} from "@/lib/train";

type Props = { types: TrainType[]; stations: TrainStation[] };

/** Administration des dessertes (gares par type de train) et des règles de bagages. */
export function TrainRoutesBaggage({ types, stations }: Props) {
  const [routes, setRoutes] = useState<TrainRoute[]>([]);
  const [links, setLinks] = useState<TrainRouteStation[]>([]);
  const [rules, setRules] = useState<TrainBaggageRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoute, setNewRoute] = useState({ label: "", train_type_id: "" });

  const load = async () => {
    setLoading(true);
    const r = await fetchTrainRoutes();
    setRoutes(r.routes); setLinks(r.routeStations); setRules(r.baggageRules);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<{ error: any }>, ok: string) => {
    const { error } = await fn();
    if (error) toast.error(error.message);
    else { toast.success(ok); load(); }
  };

  const addRoute = () => {
    if (!newRoute.train_type_id) return toast.error("Choisissez un type de train");
    run(() => supabase.from("train_routes" as any).insert({
      train_type_id: newRoute.train_type_id,
      label: newRoute.label.trim() || "Desserte",
      sort_order: routes.length + 1,
    }) as any, "Desserte ajoutée").then(() => setNewRoute({ label: "", train_type_id: "" }));
  };

  const toggleStation = (routeId: string, stationId: string, on: boolean) => {
    if (on) {
      run(() => supabase.from("train_route_stations" as any).insert({ route_id: routeId, station_id: stationId }) as any, "Gare ajoutée");
    } else {
      run(() => supabase.from("train_route_stations" as any).delete().eq("route_id", routeId).eq("station_id", stationId) as any, "Gare retirée");
    }
  };

  const addRule = () =>
    run(() => supabase.from("train_baggage_rules" as any).insert({
      label: "Bagages", conditions: "", free_count: 1, fee_per_extra: 0, max_count: 10, sort_order: rules.length + 1,
    }) as any, "Règle ajoutée");

  const patchRule = (id: string, values: Record<string, unknown>) =>
    run(() => supabase.from("train_baggage_rules" as any).update(values).eq("id", id) as any, "Enregistré");

  if (loading) return null;

  return (
    <>
      {/* Dessertes */}
      <Card><CardContent className="space-y-3 p-4">
        <h2 className="font-semibold">Dessertes par type de train</h2>
        <p className="text-xs text-muted-foreground">
          Cochez les gares desservies. Sans desserte configurée, un train « gares principales » ne dessert que les gares
          principales et un train « gares secondaires » dessert toutes les gares.
        </p>
        {routes.map((r) => {
          const type = types.find((t) => t.id === r.train_type_id);
          return (
            <div key={r.id} className="space-y-2 rounded-xl border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input className="w-56" defaultValue={r.label}
                  onBlur={(e) => e.target.value !== r.label && run(() => supabase.from("train_routes" as any).update({ label: e.target.value }).eq("id", r.id) as any, "Enregistré")} />
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{type?.name ?? "—"}</span>
                <label className="flex items-center gap-2 text-xs">
                  <Switch checked={r.is_active} onCheckedChange={(v) => run(() => supabase.from("train_routes" as any).update({ is_active: v }).eq("id", r.id) as any, "Enregistré")} />
                  {r.is_active ? "Active" : "Inactive"}
                </label>
                <Button size="icon" variant="ghost" className="ml-auto text-destructive"
                  onClick={() => run(() => supabase.from("train_routes" as any).delete().eq("id", r.id) as any, "Supprimée")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {stations.map((s) => {
                  const on = links.some((l) => l.route_id === r.id && l.station_id === s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleStation(r.id, s.id, !on)}
                      className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground"}`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-56" placeholder="Libellé de la desserte" value={newRoute.label}
            onChange={(e) => setNewRoute({ ...newRoute, label: e.target.value })} />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={newRoute.train_type_id} onChange={(e) => setNewRoute({ ...newRoute, train_type_id: e.target.value })}>
            <option value="">Type de train…</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Button onClick={addRoute}><Plus className="h-4 w-4" /> Ajouter</Button>
        </div>
      </CardContent></Card>

      {/* Bagages */}
      <Card><CardContent className="space-y-3 p-4">
        <h2 className="font-semibold">Règles de bagages</h2>
        {rules.map((r) => (
          <div key={r.id} className="space-y-2 rounded-xl border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input className="w-48" defaultValue={r.label} onBlur={(e) => e.target.value !== r.label && patchRule(r.id, { label: e.target.value })} />
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={r.train_type_id ?? ""} onChange={(e) => patchRule(r.id, { train_type_id: e.target.value || null })}>
                <option value="">Tous les trains</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs">
                Inclus
                <NumericBlurField className="w-16" defaultValue={r.free_count} onCommit={(n) => patchRule(r.id, { free_count: n ?? 0 })} />
              </label>
              <label className="flex items-center gap-1 text-xs">
                Frais/suppl.
                <NumericBlurField className="w-24" defaultValue={r.fee_per_extra} onCommit={(n) => patchRule(r.id, { fee_per_extra: n ?? 0 })} />
              </label>
              <label className="flex items-center gap-1 text-xs">
                Max
                <NumericBlurField className="w-16" defaultValue={r.max_count} onCommit={(n) => patchRule(r.id, { max_count: n ?? 0 })} />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={r.is_active} onCheckedChange={(v) => patchRule(r.id, { is_active: v })} />
                {r.is_active ? "Active" : "Inactive"}
              </label>
              <Button size="icon" variant="ghost" className="ml-auto text-destructive"
                onClick={() => run(() => supabase.from("train_baggage_rules" as any).delete().eq("id", r.id) as any, "Supprimée")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <textarea
              className="min-h-16 w-full rounded-md border border-input bg-background p-2 text-sm"
              placeholder="Conditions de transport affichées au client"
              defaultValue={r.conditions}
              onBlur={(e) => e.target.value !== r.conditions && patchRule(r.id, { conditions: e.target.value })}
            />
          </div>
        ))}
        <Button onClick={addRule}><Plus className="h-4 w-4" /> Ajouter une règle</Button>
      </CardContent></Card>
    </>
  );
}
