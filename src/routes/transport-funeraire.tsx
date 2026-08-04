import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { fmtXAF, QUOTE_STATUS_LABEL, respondBusQuote } from "@/lib/bus";

export const Route = createFileRoute("/transport-funeraire")({
  head: () => ({
    meta: [
      { title: "Transport funéraire — Wina Tour" },
      { name: "description", content: "Demandez un devis pour un transport funéraire entre les villes du Gabon avec nos agences partenaires." },
      { property: "og:title", content: "Transport funéraire — Wina Tour" },
      { property: "og:description", content: "Accompagnement et devis personnalisé pour le transport funéraire au Gabon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FuneralPage,
});

type Agency = { id: string; name: string };
type Request = {
  id: string; reference_code: string; origin: string; destination: string; status: string;
  quote_price: number | null; quote_conditions: string | null; quote_available_date: string | null;
  reservation_id: string | null; created_at: string;
};

const EMPTY = {
  agency_id: "", origin: "", destination: "", contact_name: "", contact_phone: "",
  deceased_name: "", transport_type: "", documents: "", comments: "",
};

function FuneralPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [requests, setRequests] = useState<Request[]>([]);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("bus_funeral_requests" as any)
      .select("id, reference_code, origin, destination, status, quote_price, quote_conditions, quote_available_date, reservation_id, created_at")
      .order("created_at", { ascending: false });
    setRequests(((data as any) ?? []) as Request[]);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("partner_agencies_public" as any)
        .select("id, name, accepts_funeral").eq("accepts_funeral", true).order("name");
      setAgencies(((data as any) ?? []) as Agency[]);
      if (isAuthenticated) await load();
    })();
  }, [isAuthenticated]);

  const submit = async () => {
    if (!isAuthenticated || !user) { toast.error("Connectez-vous pour envoyer une demande"); navigate({ to: "/connexion" }); return; }
    for (const [k, label] of [["agency_id", "Agence"], ["origin", "Ville de départ"], ["destination", "Destination"],
      ["contact_name", "Nom du contact"], ["contact_phone", "Téléphone"], ["deceased_name", "Nom du défunt"],
      ["transport_type", "Type de transport"]] as const) {
      if (!String((form as any)[k]).trim()) return toast.error(`${label} requis`);
    }
    setSaving(true);
    const { error } = await supabase.from("bus_funeral_requests" as any).insert({ ...form, user_id: user.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Demande de devis envoyée");
    setForm({ ...EMPTY });
    void load();
  };

  const respond = async (id: string, accept: boolean) => {
    setBusy(id);
    try {
      const reservationId = await respondBusQuote("funeral", id, accept);
      toast.success(accept ? "Devis accepté — procédez au paiement" : "Devis refusé");
      await load();
      if (accept && reservationId) navigate({ to: "/paiement/$reservationId", params: { reservationId } });
    } catch (e: any) { toast.error(e.message || "Erreur"); } finally { setBusy(null); }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-5">
        <Link to="/billets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour à la billetterie
        </Link>
        <h1 className="mt-5 inline-flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="h-6 w-6 text-primary" /> Transport funéraire</h1>
        <p className="mt-1 text-sm text-muted-foreground">Toutes les demandes passent par un devis personnalisé de l'agence.</p>

        <section className="mt-6 space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">Agence partenaire *</span>
            <select value={form.agency_id} onChange={(e) => setForm({ ...form, agency_id: e.target.value })}
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm">
              <option value="">Sélectionner une agence</option>
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Ville de départ *" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
            <Input placeholder="Destination *" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
            <Input placeholder="Nom du contact *" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            <Input placeholder="Téléphone du contact *" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            <Input placeholder="Nom du défunt *" value={form.deceased_name} onChange={(e) => setForm({ ...form, deceased_name: e.target.value })} />
            <Input placeholder="Type de transport *" value={form.transport_type} onChange={(e) => setForm({ ...form, transport_type: e.target.value })} />
          </div>
          <Textarea placeholder="Documents disponibles (certificat de décès, autorisation…)" value={form.documents} onChange={(e) => setForm({ ...form, documents: e.target.value })} />
          <Textarea placeholder="Commentaires" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Demander un devis"}
          </Button>
        </section>

        {requests.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-bold">Mes demandes</h2>
            <div className="mt-3 space-y-3">
              {requests.map((r) => (
                <article key={r.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{r.reference_code}</span>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{QUOTE_STATUS_LABEL[r.status] ?? r.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.origin} → {r.destination}</p>
                  {r.quote_price != null && (
                    <div className="mt-3 space-y-1 rounded-xl bg-primary/5 p-3 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Prix proposé</span><b className="text-primary">{fmtXAF(r.quote_price)}</b></div>
                      {r.quote_available_date && <div className="flex justify-between"><span className="text-muted-foreground">Date disponible</span><b>{new Date(`${r.quote_available_date}T00:00:00`).toLocaleDateString("fr-FR")}</b></div>}
                      {r.quote_conditions && <p className="text-xs text-muted-foreground whitespace-pre-line">{r.quote_conditions}</p>}
                    </div>
                  )}
                  {r.status === "quoted" && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <Button variant="outline" disabled={busy === r.id} onClick={() => respond(r.id, false)}>Refuser</Button>
                      <Button disabled={busy === r.id} onClick={() => respond(r.id, true)}>Accepter</Button>
                    </div>
                  )}
                  {r.status === "accepted" && r.reservation_id && (
                    <Button asChild className="mt-3 w-full">
                      <Link to="/paiement/$reservationId" params={{ reservationId: r.reservation_id }}>Payer maintenant</Link>
                    </Button>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
