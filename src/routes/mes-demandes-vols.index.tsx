import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plane, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtDateTime, REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL } from "@/lib/flight-quotes";

export const Route = createFileRoute("/mes-demandes-vols/")({
  head: () => ({
    meta: [
      { title: "Mes demandes de vols — Agence Wina" },
      { name: "description", content: "Suivez l'état de vos demandes de vols, vos offres tarifaires et vos paiements." },
      { property: "og:title", content: "Mes demandes de vols — Agence Wina" },
      { property: "og:description", content: "Suivez vos demandes de vols et vos offres tarifaires." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyFlightRequests,
});

type Req = {
  id: string; request_number: string; origin: string; destination: string;
  departure_date: string; return_date: string | null; trip_type: string;
  adults: number; children: number; infants: number; status: string; created_at: string;
};

function MyFlightRequests() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setLoading(false); return; }
      const { data } = await (supabase.from("flight_quote_requests") as any)
        .select("*").eq("user_id", auth.user.id).order("created_at", { ascending: false });
      setRows(((data as any) ?? []) as Req[]);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link to="/vols" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Demande de vol
        </Link>
        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Plane className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mes demandes de vols</h1>
            <p className="text-sm text-muted-foreground">Suivi de vos offres et paiements</p>
          </div>
        </header>

        {loading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="mt-10 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Aucune demande pour le moment.
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {rows.map((r) => (
              <Link key={r.id} to="/mes-demandes-vols/$requestId" params={{ requestId: r.id }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{r.request_number}</p>
                  <p className="text-xs text-muted-foreground">{r.origin} → {r.destination} · {fmtDate(r.departure_date)}</p>
                  <p className="text-xs text-muted-foreground">Créée le {fmtDateTime(r.created_at)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${REQUEST_STATUS_CLASS[r.status] ?? "bg-muted"}`}>
                  {REQUEST_STATUS_LABEL[r.status] ?? r.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
