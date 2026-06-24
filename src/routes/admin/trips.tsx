import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserCheck, MapPin, Loader2, Truck } from "lucide-react";
import { ADMIN_DISPATCH_SERVICE_LIST, isAutoDispatch } from "@/lib/service-routing";

export const Route = createFileRoute("/admin/trips")({
  head: () => ({ meta: [{ title: "Courses GPS — Admin" }] }),
  component: AdminTripsPage,
});

interface Reservation {
  id: string;
  user_id: string;
  service_type: string;
  reservation_date: string;
  status: string;
  details: Record<string, unknown> | null;
}

interface Trip {
  id: string;
  reservation_id: string;
  driver_id: string | null;
  origin_address: string;
  destination_address: string;
  status: string;
}

interface Driver {
  user_id: string;
  full_name: string;
}

interface Profile {
  user_id: string;
  full_name: string;
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address + ", Gabon")}`
    );
    const data = await res.json();
    if (Array.isArray(data) && data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    /* noop */
  }
  return null;
}

function AdminTripsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Reservation | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [driverId, setDriverId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: resData }, { data: tripData }, { data: driverRoles }] = await Promise.all([
      supabase
        .from("reservations")
        .select("*")
        .eq("status", "CONFIRMED")
        .in("service_type", ADMIN_DISPATCH_SERVICE_LIST)
        .is("archived_at", null)
        .order("reservation_date"),
      supabase
        .from("trips")
        .select("*, reservations!inner(service_type)")
        .in("reservations.service_type", ADMIN_DISPATCH_SERVICE_LIST)
        .is("archived_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id").eq("role", "chauffeur"),
    ]);

    const reservationsList = ((resData as Reservation[]) || []).filter((r) => !isAutoDispatch(r.service_type));
    setReservations(reservationsList);
    setTrips((tripData as Trip[]) || []);

    // Fetch driver profiles
    const driverIds = (driverRoles ?? []).map((r) => r.user_id);
    if (driverIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", driverIds);
      setDrivers((profs as Profile[]) || []);
    }

    // Fetch client names
    const clientIds = Array.from(new Set(reservationsList.map((r) => r.user_id)));
    if (clientIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", clientIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p) => (map[p.user_id] = p.full_name));
      setClients(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-trips-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openAssign = (res: Reservation) => {
    const d = res.details as Record<string, string> | null;
    setOrigin(String(d?.trajet ?? d?.origin ?? d?.depart ?? "Libreville"));
    setDestination(String(d?.destination ?? d?.circuit ?? "Libreville"));
    setDriverId("");
    setTarget(res);
  };

  const submit = async () => {
    if (!target || !driverId || !origin || !destination) return;
    setSubmitting(true);
    const [originGeo, destGeo] = await Promise.all([geocode(origin), geocode(destination)]);
    const { error } = await supabase.fro
    ("trips").insert({
      reservation_id: target.id,
      client_id: target.user_id,
      driver_id: driverId,
      origin_address: origin,
      origin_lat: originGeo?.lat ?? null,
      origin_lng: originGeo?.lng ?? null,
      destination_address: destination,
      destination_lat: destGeo?.lat ?? null,
      destination_lng: destGeo?.lng ?? null,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      toast.success("Course assignée. Le chauffeur peut la démarrer.");
      setTarget(null);
      load();
    }
  };

  // Reservations without an assigned trip
  const tripsByReservation = new Set(trips.map((t) => t.reservation_id));
  const unassigned = reservations.filter((r) => !tripsByReservation.has(r.id));

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6" /> Assignation des courses GPS</h1>
        <p className="text-sm text-muted-foreground">
          Créez des courses traçables à partir des réservations confirmées.
        </p>
      </div>

      <section>
        <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
          Réservations confirmées sans course ({unassigned.length})
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : unassigned.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            Toutes les réservations confirmées ont une course assignée.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {unassigned.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded-lg bg-primary/10 p-2.5"><MapPin className="h-5 w-5 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{clients[r.user_id] ?? "Client"}</p>
                    <p className="text-xs text-muted-foreground">{r.service_type} · {new Date(r.reservation_date).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <Button size="sm" onClick={() => openAssign(r)} className="gap-2">
                    <UserCheck className="h-4 w-4" /> Assigner
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
          Courses existantes ({trips.length})
        </h2>
        <div className="grid gap-2">
          {trips.map((t) => {
            const driver = drivers.find((d) => d.user_id === t.driver_id);
            return (
              <Card key={t.id}>
                <CardContent className="flex items-center gap-3 p-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{t.origin_address} → {t.destination_address}</p>
                    <p className="text-xs text-muted-foreground">Chauffeur : {driver?.full_name ?? "—"}</p>
                  </div>
                  <Badge
                    className={
                      t.status === "active" ? "bg-green-500/10 text-green-700 border-green-500/30"
                      : t.status === "completed" ? "bg-muted text-muted-foreground"
                      : "bg-yellow-500/10 text-yellow-700 border-yellow-500/30"
                    }
                  >
                    {t.status}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner un chauffeur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Adresse de départ</Label>
              <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Akanda" />
            </div>
            <div>
              <Label>Destination</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Libreville centre" />
            </div>
            <div>
              <Label>Chauffeur</Label>
              <Select value={driverId} onValueChange={setDriverId}>
                <SelectTrigger><SelectValue placeholder="Choisir un chauffeur" /></SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.user_id} value={d.user_id}>{d.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Les coordonnées GPS sont déterminées automatiquement (OpenStreetMap).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Annuler</Button>
            <Button onClick={submit} disabled={!driverId || !origin || !destination || submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer la course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
