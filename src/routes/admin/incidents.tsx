import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/incidents")({
  head: () => ({
    meta: [
      { title: "Triage des incidents — WINA TOUR" },
      { name: "description", content: "Évaluation de l'urgence des incidents signalés et actions recommandées." },
      { property: "og:title", content: "Triage des incidents — WINA TOUR" },
      { property: "og:description", content: "Évaluation de l'urgence des incidents signalés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IncidentsPage,
});

type Triage = {
  urgency: "faible" | "moyenne" | "elevee" | "critique";
  score: number;
  category: string;
  summary: string;
  recommended_actions: string[];
  notify: string[];
};

const LABEL: Record<Triage["urgency"], string> = { faible: "Faible", moyenne: "Moyenne", elevee: "Élevée", critique: "Critique" };
const TONE: Record<Triage["urgency"], string> = {
  faible: "bg-success/15 text-success",
  moyenne: "bg-warning/15 text-warning-foreground",
  elevee: "bg-destructive/15 text-destructive",
  critique: "bg-destructive text-destructive-foreground",
};

function IncidentsPage() {
  const [reporter, setReporter] = useState<"client" | "chauffeur">("client");
  const [service, setService] = useState("VTC");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Triage | null>(null);

  const analyze = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expirée, reconnectez-vous.");
      const res = await fetch("/api/admin/incident-triage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reporter, service, description }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Analyse impossible");
      setResult(body.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyse impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Triage des incidents</h1>
        <p className="text-sm text-muted-foreground">Décrivez l'incident signalé : l'IA évalue l'urgence et propose les actions à mener.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            {(["client", "chauffeur"] as const).map((r) => (
              <Button key={r} type="button" size="sm" variant={reporter === r ? "default" : "outline"} onClick={() => setReporter(r)}>
                Signalé par un {r}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {["VTC", "Bus", "Scolaire", "Circuit", "Location", "Billetterie", "Déménagement", "Autre"].map((s) => (
              <Button key={s} type="button" size="sm" variant={service === s ? "secondary" : "ghost"} onClick={() => setService(s)}>{s}</Button>
            ))}
          </div>
          <Textarea
            rows={6}
            maxLength={4000}
            placeholder="Ex. : Le client signale que le chauffeur roulait très vite et a refusé de s'arrêter à la destination…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button onClick={analyze} disabled={loading || description.trim().length < 10} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analyse en cours…" : "Évaluer l'urgence"}
          </Button>
          {error && <p className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">{result.category}</CardTitle>
            <Badge className={TONE[result.urgency]}>Urgence {LABEL[result.urgency]} · {result.score}/10</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{result.summary}</p>
            <div>
              <p className="mb-2 text-sm font-semibold">Actions recommandées</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {result.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
              </ol>
            </div>
            {result.notify.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-semibold">À prévenir :</span>
                {result.notify.map((n) => <Badge key={n} variant="outline">{n}</Badge>)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Recommandation indicative : la décision finale revient à l'administrateur.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
