import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bus, Clock, MapPin } from "lucide-react";

type School = { id: string; name: string; address: string | null };
type SchoolRoute = {
  id: string;
  school_id: string;
  name: string;
  departure_point: string;
  arrival_point: string;
  departure_time: string;
  return_time: string;
  monthly_price: number;
};

export function SchoolRoutesList() {
  const [schools, setSchools] = useState<School[]>([]);
  const [routes, setRoutes] = useState<SchoolRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: r }] = await Promise.all([
        supabase.from("schools").select("id,name,address").eq("is_active", true).order("name"),
        supabase.from("school_routes").select("*").eq("is_active", true).order("name"),
      ]);
      setSchools((s ?? []) as School[]);
      setRoutes((r ?? []) as SchoolRoute[]);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement des itinéraires…</p>;
  }

  const withRoutes = schools.filter((s) => routes.some((r) => r.school_id === s.id));
  if (withRoutes.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Établissements & itinéraires desservis</h2>
      <div className="space-y-4">
        {withRoutes.map((school) => (
          <div key={school.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <Bus className="h-4 w-4 text-primary" />
              <p className="font-semibold">{school.name}</p>
            </div>
            {school.address && (
              <p className="mt-0.5 text-xs text-muted-foreground">{school.address}</p>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {routes
                .filter((r) => r.school_id === school.id)
                .map((r) => (
                  <div key={r.id} className="rounded-xl border bg-background p-3">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {r.departure_point} → {r.arrival_point}
                    </p>
                    {(r.departure_time || r.return_time) && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {r.departure_time && `Départ ${r.departure_time}`}
                        {r.departure_time && r.return_time && " • "}
                        {r.return_time && `Retour ${r.return_time}`}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-bold text-primary">
                      {Number(r.monthly_price).toLocaleString()} FCFA / mois
                    </p>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
