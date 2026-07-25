import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plane, Calendar, MapPin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AgencyLogo } from "@/components/AgencyLogo";

export const Route = createFileRoute("/vols/")({
  head: () => ({
    meta: [
      { title: "Vols — Agence Wina" },
      { name: "description", content: "Réservez votre billet d'avion via nos agences partenaires au Gabon." },
    ],
  }),
  component: VolsList,
});

const FCFA = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "";

type Program = {
  id: string;
  agency_id: string;
  title: string;
  airline_name: string | null;
  flight_number: string | null;
  origin: string;
  destination: string;
  departure_at: string | null;
  arrival_at: string | null;
  price: number;
  service_fee: number | null;
  seats_available: number;
  class: string | null;
  description: string | null;
  image_url: string | null;
};

type Agency = { id: string; name: string; logo_url: string | null };

function VolsList() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [agencies, setAgencies] = useState<Record<string, Agency>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: progs } = await supabase
        .from("flight_programs" as any)
        .select("id,agency_id,title,airline_name,flight_number,origin,destination,departure_at,arrival_at,price,service_fee,seats_available,class,description,image_url")
        .eq("is_active", true)
        .gt("seats_available", 0)
        .order("departure_at", { ascending: true });
      const list = ((progs as any) ?? []) as Program[];
      setPrograms(list);

      const ids = Array.from(new Set(list.map((p) => p.agency_id)));
      if (ids.length) {
        const { data: ags } = await supabase
          .from("partner_agencies_public" as any)
          .select("id,name,logo_url")
          .in("id", ids);
        const map: Record<string, Agency> = {};
        ((ags as any) ?? []).forEach((a: Agency) => { map[a.id] = a; });
        setAgencies(map);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <Link to="/billets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Billetterie
        </Link>
        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Plane className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Vols disponibles</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? "Chargement…" : `${programs.length} vol${programs.length > 1 ? "s" : ""} disponible${programs.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </header>

        {loading ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : programs.length === 0 ? (
          <div className="mt-10 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Aucun programme de vol actif pour le moment.
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {programs.map((p) => {
              const a = agencies[p.agency_id];
              const total = (p.price ?? 0) + (p.service_fee ?? 0);
              return (
                <Link
                  key={p.id}
                  to="/vols/$programId"
                  params={{ programId: p.id }}
                  className="group flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    {a?.logo_url ? (
                      <AgencyLogo src={a.logo_url} alt={a.name} size={44} />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Plane className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{a?.name ?? "Agence"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.airline_name ?? ""}{p.flight_number ? ` · ${p.flight_number}` : ""}
                      </p>
                    </div>
                  </div>
                  <h3 className="mt-3 text-base font-bold">{p.title}</h3>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{p.origin} → {p.destination}</span>
                  </div>
                  {p.departure_at && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{fmtDate(p.departure_at)}</span>
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>{p.seats_available} place{p.seats_available > 1 ? "s" : ""}</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <span className="text-lg font-extrabold text-primary">{FCFA(total)}</span>
                    <span className="text-xs font-semibold text-primary">Réserver →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
