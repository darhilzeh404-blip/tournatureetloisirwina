import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plane, Loader2, Send, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AgencyLogo } from "@/components/AgencyLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { TRAVEL_CLASSES } from "@/lib/flight-quotes";
import { NumericField } from "@/components/ui/numeric-field";

export const Route = createFileRoute("/vols/")({
  head: () => ({
    meta: [
      { title: "Demande de billet d'avion — Agence Wina" },
      { name: "description", content: "Envoyez votre demande de billet d'avion : nos conseillers préparent une proposition tarifaire personnalisée sous 24h." },
      { property: "og:title", content: "Demande de billet d'avion — Agence Wina" },
      { property: "og:description", content: "Un conseiller prépare votre proposition de billet d'avion au meilleur tarif." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FlightRequestPage,
});

type Agency = { id: string; name: string; logo_url: string | null };

function FlightRequestPage() {
  const navigate = useNavigate();
  const [partners, setPartners] = useState<Agency[]>([]);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    trip_type: "one_way" as "one_way" | "round_trip",
    departure_date: "",
    return_date: "",
    adults: 1,
    children: 0,
    infants: 0,
    travel_class: "economy",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    client_note: "",
  });

  useEffect(() => {
    (async () => {
      const { data: partnerRows } = await (supabase.from("partner_agencies_public") as any)
        .select("id,name,logo_url").eq("category", "avion").order("name");
      setPartners(((partnerRows as any) ?? []) as Agency[]);

      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      const { data: p } = await (supabase.from("profiles") as any)
        .select("full_name,phone").eq("id", u.id).maybeSingle();
      setForm((f) => ({
        ...f,
        contact_name: f.contact_name || (p as any)?.full_name || "",
        contact_phone: f.contact_phone || (p as any)?.phone || "",
        contact_email: f.contact_email || u.email || "",
      }));
    })();
  }, []);

  const submit = async () => {
    if (!form.origin.trim() || !form.destination.trim() || !form.departure_date) {
      toast.error("Ville de départ, ville d'arrivée et date de départ sont requises");
      return;
    }
    if (form.trip_type === "round_trip" && !form.return_date) {
      toast.error("Indiquez la date de retour");
      return;
    }
    if (!form.contact_name.trim() || !form.contact_phone.trim()) {
      toast.error("Nom et téléphone requis");
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      toast.error("Connectez-vous pour envoyer votre demande");
      navigate({ to: "/auth" });
      return;
    }
    setSending(true);
    const { data, error } = await (supabase.from("flight_quote_requests") as any).insert({
      user_id: auth.user.id,
      contact_name: form.contact_name.trim(),
      contact_phone: form.contact_phone.trim(),
      contact_email: form.contact_email.trim() || null,
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      trip_type: form.trip_type,
      departure_date: form.departure_date,
      return_date: form.trip_type === "round_trip" ? form.return_date : null,
      adults: form.adults,
      children: form.children,
      infants: form.infants,
      passengers_count: form.adults + form.children + form.infants,
      travel_class: form.travel_class,
      client_note: form.client_note.trim() || null,
      status: "pending",
    }).select("id").single();
    setSending(false);
    if (error) {
      console.error("[flight request] insert failed", error);
      const schemaMissing = /flight_quote_requests|flight_quotes|schema|relation .* does not exist|Could not find .* in schema/i.test(error.message || "");
      if (schemaMissing) {
        toast.error("La base de données des demandes de vol n’est pas encore prête. La table flight_quote_requests manque ou n’a pas été migrée dans Supabase.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Demande envoyée — un conseiller prépare votre proposition.");
    navigate({ to: "/mes-demandes-vols/$requestId", params: { requestId: (data as any).id } });
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex items-center justify-between">
          <Link to="/billets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Billetterie
          </Link>
          <Link to="/mes-demandes-vols" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            <History className="h-4 w-4" /> Mes demandes
          </Link>
        </div>

        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Plane className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Demande de billet d'avion</h1>
            <p className="text-sm text-muted-foreground">
              Décrivez votre voyage : un conseiller vous envoie une proposition de billet avec le tarif définitif.
            </p>
          </div>
        </header>

        {partners.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-bold">Nos compagnies partenaires</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {partners.map((p) => (
                <div key={p.id} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 text-center shadow-sm">
                  <AgencyLogo src={p.logo_url} alt={`Logo ${p.name}`} size={52} rounded="xl" />
                  <p className="text-xs font-semibold">{p.name.trim()}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 rounded-3xl border bg-card p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Ville de départ</Label>
              <Input placeholder="Libreville" value={form.origin}
                onChange={(e) => setForm({ ...form, origin: e.target.value })} />
            </div>
            <div>
              <Label>Ville d'arrivée</Label>
              <Input placeholder="Paris" value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })} />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["one_way", "round_trip"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setForm({ ...form, trip_type: t })}
                className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                  form.trip_type === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                {t === "one_way" ? "Aller simple" : "Aller-retour"}
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Date de départ</Label>
              <Input type="date" value={form.departure_date}
                onChange={(e) => setForm({ ...form, departure_date: e.target.value })} />
            </div>
            {form.trip_type === "round_trip" && (
              <div>
                <Label>Date de retour</Label>
                <Input type="date" value={form.return_date}
                  onChange={(e) => setForm({ ...form, return_date: e.target.value })} />
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <div><Label>Adultes</Label>
              <NumericField min={1} value={form.adults} onChange={(v) => setForm({ ...form, adults: v })} /></div>
            <div><Label>Enfants</Label>
              <NumericField min={0} value={form.children} onChange={(v) => setForm({ ...form, children: v })} /></div>
            <div><Label>Bébés</Label>
              <NumericField min={0} value={form.infants} onChange={(v) => setForm({ ...form, infants: v })} /></div>
          </div>

          <div className="mt-3">
            <Label htmlFor="travel-class">Classe souhaitée</Label>
            <select id="travel-class" value={form.travel_class}
              onChange={(e) => setForm({ ...form, travel_class: e.target.value })}
              className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm">
              {TRAVEL_CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div><Label>Nom complet</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
            <div><Label>Téléphone</Label>
              <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
          </div>
          <div className="mt-3">
            <Label>Email (optionnel)</Label>
            <Input type="email" value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          </div>
          <div className="mt-3">
            <Label>Précisions (optionnel)</Label>
            <Textarea rows={3} placeholder="Horaires souhaités, compagnie préférée, bagages…"
              value={form.client_note} onChange={(e) => setForm({ ...form, client_note: e.target.value })} />
          </div>

          <Button className="mt-5 w-full" onClick={submit} disabled={sending}>
            {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Envoyer ma demande
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Aucun paiement à cette étape. Vous recevrez une proposition détaillée à accepter ou refuser.
          </p>
        </section>
      </div>
    </main>
  );
}
