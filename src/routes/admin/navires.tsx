import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Ship, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchBoatRoutes, fetchVessels, fetchVesselServices, fetchSailings,
  type BoatRoute, type Vessel, type VesselService, type BoatSailing,
} from "@/lib/boat";

export const Route = createFileRoute("/admin/navires")({
  head: () => ({ meta: [{ title: "Navires & Billetterie — Admin" }] }),
  component: AdminBoatsPage,
});

type Agency = { id: string; name: string; category: string | null };

const money = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

function AdminBoatsPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [routes, setRoutes] = useState<BoatRoute[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [services, setServices] = useState<VesselService[]>([]);
  const [sailings, setSailings] = useState<BoatSailing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [newRoute, setNewRoute] = useState({ agency_id: "", origin: "", destination: "", distance_km: "", duration_minutes: "" });
  const [newVessel, setNewVessel] = useState({ agency_id: "", name: "", capacity: "", price_adult: "", price_child: "", price_infant: "" });
  const [newService, setNewService] = useState({ vessel_id: "", name: "", price: "" });
  const [uploading, setUploading] = useState<string | null>(null);
  const [newSailing, setNewSailing] = useState({
    vessel_id: "", route_id: "", period_start: "", period_end: "", departure_time: "08:00", seats_total: "0",
  });

  const load = async () => {
    setLoading(true);
    const { data: ag } = await supabase
      .from("partner_agencies" as any)
      .select("id, name, category")
      .eq("category", "bateau")
      .order("name");
    setAgencies(((ag as any) ?? []) as Agency[]);
    const [r, v] = await Promise.all([fetchBoatRoutes(), fetchVessels()]);
    setRoutes(r); setVessels(v);
    setServices(await fetchVesselServices());
    setSailings(await fetchSailings({}));
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

  const del = (table: string, id: string) => run(() => supabase.from(table as any).delete().eq("id", id) as any, "Supprimé");
  const patch = (table: string, id: string, values: Record<string, unknown>) =>
    run(() => supabase.from(table as any).update(values).eq("id", id) as any, "Enregistré");

  const agencyName = (id: string) => agencies.find((a) => a.id === id)?.name ?? "—";
  const vesselName = (id: string) => vessels.find((v) => v.id === id)?.name ?? "—";
  const routeLabel = (id: string) => {
    const r = routes.find((x) => x.id === id);
    return r ? `${r.origin} → ${r.destination}` : "—";
  };

  const sailingsSorted = useMemo(
    () => [...sailings].sort((a, b) => (a.departure_date + a.departure_time).localeCompare(b.departure_date + b.departure_time)),
    [sailings],
  );

  const addRoute = () => {
    if (!newRoute.agency_id || !newRoute.origin.trim() || !newRoute.destination.trim())
      return toast.error("Agence, origine et destination requises");
    run(() => supabase.from("boat_routes" as any).insert({
      agency_id: newRoute.agency_id,
      origin: newRoute.origin.trim(),
      destination: newRoute.destination.trim(),
      distance_km: Number(newRoute.distance_km) || 0,
      duration_minutes: Number(newRoute.duration_minutes) || 0,
      sort_order: routes.length + 1,
    }) as any, "Route maritime ajoutée").then(() =>
      setNewRoute({ agency_id: "", origin: "", destination: "", distance_km: "", duration_minutes: "" }));
  };

  const addVessel = () => {
    if (!newVessel.agency_id || !newVessel.name.trim()) return toast.error("Agence et nom requis");
    run(() => supabase.from("vessels" as any).insert({
      agency_id: newVessel.agency_id,
      name: newVessel.name.trim(),
      capacity: Number(newVessel.capacity) || 0,
      price_adult: Number(newVessel.price_adult) || 0,
      price_child: Number(newVessel.price_child) || 0,
      price_infant: Number(newVessel.price_infant) || 0,
      sort_order: vessels.length + 1,
    }) as any, "Navire ajouté").then(() =>
      setNewVessel({ agency_id: "", name: "", capacity: "", price_adult: "", price_child: "", price_infant: "" }));
  };

  /** Upload d'une photo HD du navire dans le stockage (bucket public ticket-images). */
  const uploadPhoto = async (vesselId: string, file: File) => {
    setUploading(vesselId);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `vessels/${vesselId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("ticket-images").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("ticket-images").getPublicUrl(path);
      await supabase.from("vessels" as any).update({ photo_url: data.publicUrl }).eq("id", vesselId);
      toast.success("Photo mise à jour");
      load();
    } catch (err: any) {
      toast.error(err.message || "Échec du téléversement");
    } finally {
      setUploading(null);
    }
  };

  const addService = () => {
    if (!newService.vessel_id || !newService.name.trim()) return toast.error("Navire et service requis");
    run(() => supabase.from("vessel_services" as any).insert({
      vessel_id: newService.vessel_id,
      name: newService.name.trim(),
      price: Number(newService.price) || 0,
      sort_order: services.length + 1,
    }) as any, "Service ajouté").then(() => setNewService({ vessel_id: "", name: "", price: "" }));
  };

  const addSailing = () => {
    if (!newSailing.vessel_id || !newSailing.route_id || !newSailing.period_start || !newSailing.period_end)
      return toast.error("Navire, route et période requis");
    const seats = Number(newSailing.seats_total) || 0;
    run(() => supabase.from("boat_sailings" as any).insert({
      vessel_id: newSailing.vessel_id,
      route_id: newSailing.route_id,
      period_start: newSailing.period_start,
      period_end: newSailing.period_end,
      departure_date: newSailing.period_start,
      departure_time: newSailing.departure_time || "08:00",
      seats_total: seats,
      seats_available: seats,
    }) as any, "Période de départs programmée").then(() => setNewSailing({
      vessel_id: "", route_id: "", period_start: "", period_end: "", departure_time: "08:00", seats_total: "0",
    }));
  };


  if (loading) return <p className="p-10 text-center text-sm text-muted-foreground">Chargement…</p>;

  const selectCls = "h-10 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Ship className="h-6 w-6 text-primary" /> Navires & Billetterie
        </h1>
        <p className="text-sm text-muted-foreground">
          Routes maritimes, navires, services, règles de bagages et départs — rattachés aux agences partenaires de catégorie « bateau ».
        </p>
      </header>

      {agencies.length === 0 && (
        <p className="rounded-xl border bg-amber-500/10 p-3 text-sm text-amber-700">
          Créez d'abord une agence partenaire de catégorie « bateau » dans Agences.
        </p>
      )}

      {/* Routes maritimes */}
      <Card><CardContent className="space-y-3 p-4">
        <h2 className="font-semibold">Routes maritimes</h2>
        {routes.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
            <span className="w-40 truncate text-xs text-muted-foreground">{agencyName(r.agency_id)}</span>
            <Input className="w-40" defaultValue={r.origin} onBlur={(e) => e.target.value !== r.origin && patch("boat_routes", r.id, { origin: e.target.value })} />
            <Input className="w-40" defaultValue={r.destination} onBlur={(e) => e.target.value !== r.destination && patch("boat_routes", r.id, { destination: e.target.value })} />
            <Input className="w-28" type="number" defaultValue={r.distance_km} onBlur={(e) => patch("boat_routes", r.id, { distance_km: Number(e.target.value) || 0 })} placeholder="km" />
            <Input className="w-28" type="number" defaultValue={r.duration_minutes} onBlur={(e) => patch("boat_routes", r.id, { duration_minutes: Number(e.target.value) || 0 })} placeholder="minutes" />
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={r.is_active} onCheckedChange={(v) => patch("boat_routes", r.id, { is_active: v })} />
              {r.is_active ? "Active" : "Inactive"}
            </label>
            <Button size="icon" variant="ghost" className="ml-auto text-destructive" onClick={() => del("boat_routes", r.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <select className={selectCls} value={newRoute.agency_id} onChange={(e) => setNewRoute({ ...newRoute, agency_id: e.target.value })}>
            <option value="">Agence…</option>
            {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <Input className="w-40" placeholder="Origine" value={newRoute.origin} onChange={(e) => setNewRoute({ ...newRoute, origin: e.target.value })} />
          <Input className="w-40" placeholder="Destination" value={newRoute.destination} onChange={(e) => setNewRoute({ ...newRoute, destination: e.target.value })} />
          <Input className="w-28" type="number" placeholder="km" value={newRoute.distance_km} onChange={(e) => setNewRoute({ ...newRoute, distance_km: e.target.value })} />
          <Input className="w-28" type="number" placeholder="minutes" value={newRoute.duration_minutes} onChange={(e) => setNewRoute({ ...newRoute, duration_minutes: e.target.value })} />
          <Button onClick={addRoute} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter</Button>
        </div>
      </CardContent></Card>

      {/* Navires */}
      <Card><CardContent className="space-y-3 p-4">
        <h2 className="font-semibold">Navires</h2>
        {vessels.map((v) => (
          <div key={v.id} className="space-y-2 rounded-xl border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-40 truncate text-xs text-muted-foreground">{agencyName(v.agency_id)}</span>
              <Input className="w-44" defaultValue={v.name} onBlur={(e) => e.target.value !== v.name && patch("vessels", v.id, { name: e.target.value })} />
              <Input className="w-28" type="number" defaultValue={v.capacity} onBlur={(e) => patch("vessels", v.id, { capacity: Number(e.target.value) || 0 })} placeholder="Capacité" />
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={v.is_active} onCheckedChange={(x) => patch("vessels", v.id, { is_active: x })} />
                {v.is_active ? "Actif" : "Inactif"}
              </label>
              <Button size="icon" variant="ghost" className="ml-auto text-destructive" onClick={() => del("vessels", v.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {v.photo_url && <img src={v.photo_url} alt={v.name} loading="lazy" className="h-16 w-24 rounded-lg object-cover" />}
              <label className="cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium">
                {uploading === v.id ? "Téléversement…" : v.photo_url ? "Remplacer la photo HD" : "Téléverser une photo HD"}
                <input type="file" accept="image/*" className="hidden" disabled={uploading === v.id}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(v.id, f); e.target.value = ""; }} />
              </label>
              {v.photo_url && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => patch("vessels", v.id, { photo_url: null })}>
                  Retirer
                </Button>
              )}
            </div>
            <Input defaultValue={v.description} placeholder="Description" onBlur={(e) => e.target.value !== v.description && patch("vessels", v.id, { description: e.target.value })} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Tarifs (FCFA)</span>
              <Input className="w-28" type="number" defaultValue={v.price_adult} placeholder="Adulte" onBlur={(e) => patch("vessels", v.id, { price_adult: Number(e.target.value) || 0 })} />
              <Input className="w-28" type="number" defaultValue={v.price_child} placeholder="Enfant" onBlur={(e) => patch("vessels", v.id, { price_child: Number(e.target.value) || 0 })} />
              <Input className="w-28" type="number" defaultValue={v.price_infant} placeholder="Bébé" onBlur={(e) => patch("vessels", v.id, { price_infant: Number(e.target.value) || 0 })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Bagages</span>
              <Input className="w-28" type="number" defaultValue={v.baggage_free_count} placeholder="Inclus" onBlur={(e) => patch("vessels", v.id, { baggage_free_count: Number(e.target.value) || 0 })} />
              <Input className="w-36" type="number" defaultValue={v.baggage_fee_per_extra} placeholder="FCFA / suppl." onBlur={(e) => patch("vessels", v.id, { baggage_fee_per_extra: Number(e.target.value) || 0 })} />
              <Input className="w-28" type="number" defaultValue={v.baggage_max_count} placeholder="Max" onBlur={(e) => patch("vessels", v.id, { baggage_max_count: Number(e.target.value) || 0 })} />
              <Input className="flex-1 min-w-[200px]" defaultValue={v.baggage_conditions} placeholder="Conditions de bagages" onBlur={(e) => e.target.value !== v.baggage_conditions && patch("vessels", v.id, { baggage_conditions: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-2">
              {services.filter((s) => s.vessel_id === v.id).map((s) => (
                <span key={s.id} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
                  {s.name} · {s.price > 0 ? money(s.price) : "inclus"}
                  <button type="button" className="text-destructive" onClick={() => del("vessel_services", s.id)}>×</button>
                </span>
              ))}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <select className={selectCls} value={newVessel.agency_id} onChange={(e) => setNewVessel({ ...newVessel, agency_id: e.target.value })}>
            <option value="">Agence…</option>
            {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <Input className="w-44" placeholder="Nom du navire" value={newVessel.name} onChange={(e) => setNewVessel({ ...newVessel, name: e.target.value })} />
          <Input className="w-28" type="number" placeholder="Capacité" value={newVessel.capacity} onChange={(e) => setNewVessel({ ...newVessel, capacity: e.target.value })} />
          <Input className="w-28" type="number" placeholder="Prix adulte" value={newVessel.price_adult} onChange={(e) => setNewVessel({ ...newVessel, price_adult: e.target.value })} />
          <Input className="w-28" type="number" placeholder="Prix enfant" value={newVessel.price_child} onChange={(e) => setNewVessel({ ...newVessel, price_child: e.target.value })} />
          <Input className="w-28" type="number" placeholder="Prix bébé" value={newVessel.price_infant} onChange={(e) => setNewVessel({ ...newVessel, price_infant: e.target.value })} />
          <Button onClick={addVessel} disabled={busy}><Plus className="h-4 w-4" /> Ajouter</Button>
        </div>

        </div>
      </CardContent></Card>

      {/* Services */}
      <Card><CardContent className="space-y-3 p-4">
        <h2 className="font-semibold">Services proposés</h2>
        <p className="text-xs text-muted-foreground">Prix à 0 = service inclus. Prix supérieur à 0 = option payante proposée au client.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select className={selectCls} value={newService.vessel_id} onChange={(e) => setNewService({ ...newService, vessel_id: e.target.value })}>
            <option value="">Navire…</option>
            {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <Input className="w-52" placeholder="Service (WiFi, repas, salon VIP…)" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
          <Input className="w-32" type="number" placeholder="Prix" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} />
          <Button onClick={addService} disabled={busy}><Plus className="h-4 w-4" /> Ajouter</Button>
        </div>
      </CardContent></Card>

      {/* Départs */}
      <Card><CardContent className="space-y-3 p-4">
        <h2 className="font-semibold">Départs programmés (période mensuelle)</h2>
        <p className="text-xs text-muted-foreground">
          Définissez une période de disponibilité : le client choisit librement sa date dans cette période, ainsi que le
          nombre d'adultes, d'enfants et de bébés. Les tarifs proviennent du navire. Places = 0 signifie illimité.
        </p>
        {sailingsSorted.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
            <span className="w-40 truncate text-xs font-semibold">{vesselName(s.vessel_id)}</span>
            <span className="w-48 truncate text-xs text-muted-foreground">{routeLabel(s.route_id)}</span>
            <label className="flex items-center gap-1 text-xs">Du
              <Input className="w-36" type="date" defaultValue={s.period_start ?? s.departure_date ?? ""}
                onBlur={(e) => e.target.value && patch("boat_sailings", s.id, { period_start: e.target.value })} />
            </label>
            <label className="flex items-center gap-1 text-xs">Au
              <Input className="w-36" type="date" defaultValue={s.period_end ?? s.departure_date ?? ""}
                onBlur={(e) => e.target.value && patch("boat_sailings", s.id, { period_end: e.target.value })} />
            </label>
            <Input className="w-28" type="time" defaultValue={s.departure_time?.slice(0, 5)} onBlur={(e) => patch("boat_sailings", s.id, { departure_time: e.target.value })} />
            <label className="flex items-center gap-1 text-xs">Places
              <Input className="w-24" type="number" defaultValue={s.seats_total} onBlur={(e) => patch("boat_sailings", s.id, { seats_total: Number(e.target.value) || 0, seats_available: Number(e.target.value) || 0 })} />
            </label>
            <span className="text-xs text-muted-foreground">
              {(s.seats_total ?? 0) > 0 ? `${s.seats_available}/${s.seats_total} places` : "Illimité"}
            </span>
            <select className={selectCls} value={s.status} onChange={(e) => patch("boat_sailings", s.id, { status: e.target.value })}>
              <option value="active">Actif</option>
              <option value="full">Complet</option>
              <option value="cancelled">Annulé</option>
            </select>
            <Button size="icon" variant="ghost" className="ml-auto text-destructive" onClick={() => del("boat_sailings", s.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <select className={selectCls} value={newSailing.vessel_id} onChange={(e) => setNewSailing({ ...newSailing, vessel_id: e.target.value })}>
            <option value="">Navire…</option>
            {vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select className={selectCls} value={newSailing.route_id} onChange={(e) => setNewSailing({ ...newSailing, route_id: e.target.value })}>
            <option value="">Route…</option>
            {routes.map((r) => <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs">Du
            <Input className="w-36" type="date" value={newSailing.period_start} onChange={(e) => setNewSailing({ ...newSailing, period_start: e.target.value })} />
          </label>
          <label className="flex items-center gap-1 text-xs">Au
            <Input className="w-36" type="date" value={newSailing.period_end} onChange={(e) => setNewSailing({ ...newSailing, period_end: e.target.value })} />
          </label>
          <Input className="w-28" type="time" value={newSailing.departure_time} onChange={(e) => setNewSailing({ ...newSailing, departure_time: e.target.value })} />
          <Input className="w-32" type="number" placeholder="Places (0 = illimité)" value={newSailing.seats_total} onChange={(e) => setNewSailing({ ...newSailing, seats_total: e.target.value })} />
          <Button onClick={addSailing} disabled={busy}><Plus className="h-4 w-4" /> Programmer</Button>
        </div>
      </CardContent></Card>

    </div>
  );
}
