import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plane, MapPin, Loader2, Search, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AgencyLogo } from "@/components/AgencyLogo";
import { BusQuoteForms } from "@/components/BusQuoteForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FCFA, PROGRAM_STATUS_LABEL } from "@/lib/flight-quotes";

export const Route = createFileRoute("/vols/")({
  head: () => ({
    meta: [
      { title: "Demande de vol — Agence Wina" },
      { name: "description", content: "Envoyez votre demande de vol et recevez une offre tarifaire personnalisée de nos compagnies partenaires au Gabon." },
      { property: "og:title", content: "Demande de vol — Agence Wina" },
      { property: "og:description", content: "Recevez une offre tarifaire personnalisée pour votre vol au départ du Gabon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VolsSearch,
});

type Program = {
  id: string; agency_id: string; origin: string; destination: string;
  price_from: number; month_start: string; month_end: string;
  status: string; description: string | null; conditions: string | null;
};
type Agency = { id: string; name: string; logo_url: string | null };

type Criteria = {
  origin: string; destination: string; departure_date: string; return_date: string;
  trip_type: "one_way" | "round_trip"; adults: number; children: number; infants: number;
};

function VolsSearch() {
  const navigate = useNavigate();
  const [criteria, setCriteria] = useState<Criteria>({
    origin: "", destination: "", departure_date: "", return_date: "",
    trip_type: "one_way", adults: 1, children: 0, infants: 0,
  });
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [agencies, setAgencies] = useState<Record<string, Agency>>({});
  const [airlinePartners, setAirlinePartners] = useState<Agency[]>([]);
  const [serviceAgencyId, setServiceAgencyId] = useState("");

  const [selected, setSelected] = useState<Program | null>(null);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", note: "" });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: partnerRows } = await (supabase.from("partner_agencies_public") as any)
        .select("id,name,logo_url")
        .eq("category", "avion")
        .order("name");
      setAirlinePartners(((partnerRows as any) ?? []) as Agency[]);
      const firstPartner = ((partnerRows as any) ?? [])[0] as Agency | undefined;
      setServiceAgencyId((current) => current || firstPartner?.id || "");

      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      const { data: p } = await (supabase.from("profiles") as any)
        .select("full_name,phone").eq("id", u.id).maybeSingle();
      setContact((c) => ({
        ...c,
        name: c.name || (p as any)?.full_name || "",
        phone: c.phone || (p as any)?.phone || "",
        email: c.email || u.email || "",
      }));
    })();
  }, []);

  const runSearch = async () => {
    if (!criteria.origin.trim() || !criteria.destination.trim() || !criteria.departure_date) {
      toast.error("Départ, arrivée et date de départ sont requis");
      return;
    }
    if (criteria.trip_type === "round_trip" && !criteria.return_date) {
      toast.error("Indiquez la date de retour");
      return;
    }
    setLoading(true);
    setSearched(true);
    const { data } = await (supabase.from("flight_programs") as any)
      .select("*")
      .eq("is_active", true)
      .ilike("origin", `%${criteria.origin.trim()}%`)
      .ilike("destination", `%${criteria.destination.trim()}%`)
      .lte("month_start", criteria.departure_date)
      .gte("month_end", criteria.departure_date)
      .order("price_from", { ascending: true });
    const list = ((data as any) ?? []) as Program[];
    setPrograms(list);

    const ids = Array.from(new Set(list.map((p) => p.agency_id)));
    if (ids.length) {
      const { data: ags } = await (supabase.from("partner_agencies_public") as any)
        .select("id,name,logo_url").in("id", ids);
      const map: Record<string, Agency> = {};
      ((ags as any) ?? []).forEach((a: Agency) => { map[a.id] = a; });
      setAgencies(map);
    }
    setLoading(false);
  };

  const submitRequest = async () => {
    if (!selected) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { toast.error("Connectez-vous pour envoyer une demande"); navigate({ to: "/auth" }); return; }
    if (!contact.name.trim() || !contact.phone.trim()) { toast.error("Nom et téléphone requis"); return; }
    setSending(true);
    const { data, error } = await (supabase.from("flight_quote_requests") as any).insert({
      user_id: auth.user.id,
      program_id: selected.id,
      contact_name: contact.name.trim(),
      contact_phone: contact.phone.trim(),
      contact_email: contact.email.trim() || null,
      origin: criteria.origin.trim(),
      destination: criteria.destination.trim(),
      trip_type: criteria.trip_type,
      departure_date: criteria.departure_date,
      return_date: criteria.trip_type === "round_trip" ? criteria.return_date : null,
      adults: criteria.adults,
      children: criteria.children,
      infants: criteria.infants,
      client_note: contact.note.trim() || null,
      status: "pending",
    }).select("id").single();
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Demande envoyée — vous recevrez une offre tarifaire.");
    setSelected(null);
    navigate({ to: "/mes-demandes-vols/$requestId", params: { requestId: (data as any).id } });
  };

  const num = (v: string, min: number) => Math.max(min, Number(v) || 0);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-8">
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
            <h1 className="text-2xl font-bold">Demande de vol</h1>
            <p className="text-sm text-muted-foreground">
              Indiquez votre trajet, nous vous envoyons une offre tarifaire personnalisée.
            </p>
          </div>
        </header>

        <section className="mt-6">
          <h2 className="text-sm font-bold">Nos compagnies aériennes partenaires</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {airlinePartners.map((partner) => (
              <div key={partner.id} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 text-center shadow-sm">
                <AgencyLogo src={partner.logo_url} alt={`Logo ${partner.name}`} size={52} rounded="xl" />
                <p className="text-xs font-semibold">{partner.name.trim()}</p>
              </div>
            ))}
          </div>
        </section>

        {airlinePartners.length > 0 && (
          <section className="mt-6 rounded-2xl border bg-card p-4 sm:p-5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="flight-service-agency">
              Agence pour le service additionnel
            </label>
            <select
              id="flight-service-agency"
              value={serviceAgencyId}
              onChange={(event) => setServiceAgencyId(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm"
            >
              {airlinePartners.map((partner) => (
                <option key={partner.id} value={partner.id}>{partner.name.trim()}</option>
              ))}
            </select>
            {serviceAgencyId && (
              <BusQuoteForms
                agencyId={serviceAgencyId}
                agencyName={airlinePartners.find((partner) => partner.id === serviceAgencyId)?.name.trim()}
              />
            )}
          </section>
        )}

        <section className="mt-6 rounded-3xl border bg-card p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Ville de départ</Label>
              <Input placeholder="Libreville" value={criteria.origin} onChange={(e) => setCriteria({ ...criteria, origin: e.target.value })} /></div>
            <div><Label>Ville d'arrivée</Label>
              <Input placeholder="Paris" value={criteria.destination} onChange={(e) => setCriteria({ ...criteria, destination: e.target.value })} /></div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["one_way", "round_trip"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setCriteria({ ...criteria, trip_type: t })}
                className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                  criteria.trip_type === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                {t === "one_way" ? "Aller simple" : "Aller-Retour"}
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><Label>Date de départ</Label>
              <Input type="date" value={criteria.departure_date} onChange={(e) => setCriteria({ ...criteria, departure_date: e.target.value })} /></div>
            {criteria.trip_type === "round_trip" && (
              <div><Label>Date de retour</Label>
                <Input type="date" value={criteria.return_date} onChange={(e) => setCriteria({ ...criteria, return_date: e.target.value })} /></div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <div><Label>Adultes</Label>
              <Input type="number" min={1} value={criteria.adults} onChange={(e) => setCriteria({ ...criteria, adults: num(e.target.value, 1) })} /></div>
            <div><Label>Enfants</Label>
              <Input type="number" min={0} value={criteria.children} onChange={(e) => setCriteria({ ...criteria, children: num(e.target.value, 0) })} /></div>
            <div><Label>Bébés</Label>
              <Input type="number" min={0} value={criteria.infants} onChange={(e) => setCriteria({ ...criteria, infants: num(e.target.value, 0) })} /></div>
          </div>

          <Button className="mt-4 w-full" onClick={runSearch} disabled={loading}>
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
            Rechercher les vols
          </Button>
        </section>

        {searched && !loading && (
          <section className="mt-6">
            {programs.length === 0 ? (
              <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
                Aucun programme ne correspond à votre recherche pour cette date.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {programs.map((p) => {
                  const a = agencies[p.agency_id];
                  const disabled = p.status !== "available";
                  return (
                    <div key={p.id} className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        {a?.logo_url ? <AgencyLogo src={a.logo_url} alt={a.name} size={44} /> : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Plane className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{a?.name ?? "Compagnie"}</p>
                          <p className="truncate text-xs text-muted-foreground">{PROGRAM_STATUS_LABEL[p.status] ?? p.status}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{p.origin} → {p.destination}</span>
                      </div>
                      {p.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                      <div className="mt-3 flex items-end justify-between">
                        <div>
                          <p className="text-[11px] text-muted-foreground">À partir de (indicatif)</p>
                          <p className="text-lg font-extrabold text-primary">{FCFA(p.price_from)}</p>
                        </div>
                        <Button size="sm" disabled={disabled} onClick={() => setSelected(p)}>
                          Demander ce vol
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Les prix affichés sont indicatifs. Le tarif définitif vous sera communiqué après étude de votre demande.
            </p>
          </section>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>Envoyer ma demande</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <p className="font-semibold">{criteria.origin} → {criteria.destination}</p>
              <p className="text-muted-foreground">
                {criteria.trip_type === "round_trip" ? "Aller-retour" : "Aller simple"} · {criteria.departure_date}
                {criteria.trip_type === "round_trip" ? ` → ${criteria.return_date}` : ""}
              </p>
              <p className="text-muted-foreground">
                {criteria.adults} adulte(s), {criteria.children} enfant(s), {criteria.infants} bébé(s)
              </p>
            </div>
            <div><Label>Nom complet</Label>
              <Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></div>
            <div><Label>Téléphone</Label>
              <Input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></div>
            <div><Label>Email</Label>
              <Input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
            <div><Label>Précisions (optionnel)</Label>
              <Textarea rows={3} value={contact.note} onChange={(e) => setContact({ ...contact, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>Annuler</Button>
            <Button onClick={submitRequest} disabled={sending}>
              {sending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
