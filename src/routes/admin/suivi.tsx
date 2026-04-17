import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAllDriverPositions } from "@/hooks/use-driver-position";
import { LiveMap, type MapMarker } from "@/components/LiveMap";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Navigation, Search, Users } from "lucide-react";

export const Route = createFileRoute("/admin/suivi")({
  head: () => ({ meta: [{ title: "Suivi temps réel — Admin" }] }),
  component: AdminTrackingPage,
});

interface Trip {
  id: string;
  driver_id: string | null;
  client_id: string;
  origin_address: string;
  destination_address: string;
  status: string;
}

function AdminTrackingPage() {
  const positions = useAllDriverPositions();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: tripsData } = await supabase
        .from("trips")
        .select("*")
        .in("status", ["pending", "active"]);
      if (!mounted) return;
      setTrips((tripsData as Trip[]) || []);

      const ids = new Set<string>();
      (tripsData || []).forEach((t: Trip) => {
        if (t.driver_id) ids.add(t.driver_id);
        ids.add(t.client_id);
      });
      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", Array.from(ids));
        if (mounted && profs) {
          const map: Record<string, string> = {};
          profs.forEach((p) => (map[p.user_id] = p.full_name));
          setProfiles(map);
        }
      }
    };
    load();

    const channel = supabase
      .channel("admin-trips")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        () => load()
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredPositions = positions.filter((p) => {
    if (!filter) return true;
    const name = profiles[p.driver_id]?.toLowerCase() ?? "";
    return name.includes(filter.toLowerCase());
  });

  const markers: MapMarker[] = filteredPositions.map((p) => ({
    id: p.driver_id,
    lat: Number(p.latitude),
    lng: Number(p.longitude),
    type: "driver",
    label: profiles[p.driver_id] ?? "Chauffeur",
  }));

  const activeTrips = trips.filter((t) => t.status === "active");
  const pendingTrips = trips.filter((t) => t.status === "pending");

  return (
    <div className="p-4 lg:p-6 h-screen flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Suivi en temps réel</h1>
        <p className="text-sm text-muted-foreground">
          {positions.length} chauffeur(s) actif(s) · {activeTrips.length} course(s) en cours
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card><CardContent className="flex items-center gap-3 p-3">
          <Navigation className="h-5 w-5 text-green-500" />
          <div><p className="text-xl font-bold">{activeTrips.length}</p>
          <p className="text-xs text-muted-foreground">En cours</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-3">
          <Users className="h-5 w-5 text-yellow-500" />
          <div><p className="text-xl font-bold">{pendingTrips.length}</p>
          <p className="text-xs text-muted-foreground">En attente</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-3">
          <Navigation className="h-5 w-5 text-primary" />
          <div><p className="text-xl font-bold">{positions.length}</p>
          <p className="text-xs text-muted-foreground">Chauffeurs en ligne</p></div>
        </CardContent></Card>
      </div>

      <div className="flex-1 grid lg:grid-cols-[1fr_320px] gap-4 min-h-0">
        <div className="min-h-[400px]">
          <LiveMap markers={markers} followMarkerId={selectedDriver ?? undefined} height="100%" />
        </div>

        <div className="flex flex-col gap-3 min-h-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrer par chauffeur..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredPositions.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground p-6 rounded-xl border border-dashed">
                Aucun chauffeur en ligne.
              </div>
            ) : (
              filteredPositions.map((p) => {
                const trip = trips.find((t) => t.driver_id === p.driver_id);
                const isSelected = selectedDriver === p.driver_id;
                return (
                  <button
                    key={p.driver_id}
                    onClick={() => setSelectedDriver(isSelected ? null : p.driver_id)}
                    className={`w-full text-left rounded-xl border bg-card p-3 transition-colors ${
                      isSelected ? "border-primary ring-1 ring-primary" : "hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">
                          {profiles[p.driver_id] ?? "Chauffeur"}
                        </p>
                        {trip ? (
                          <p className="text-xs text-muted-foreground truncate">
                            {trip.origin_address} → {trip.destination_address}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Sans course active</p>
                        )}
                      </div>
                      {trip && (
                        <Badge
                          className={
                            trip.status === "active"
                              ? "bg-green-500/10 text-green-700 border-green-500/30"
                              : "bg-yellow-500/10 text-yellow-700 border-yellow-500/30"
                          }
                        >
                          {trip.status === "active" ? "En route" : "En attente"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Mis à jour {new Date(p.updated_at).toLocaleTimeString("fr-FR")}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
