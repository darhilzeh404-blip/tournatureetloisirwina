import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plane, Loader2, Wallet, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FCFA, fmtDate, fmtDateTime, isInfantAge, REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL } from "@/lib/flight-quotes";

export const Route = createFileRoute("/mes-demandes-vols/$requestId")({
  head: () => ({
    meta: [
      { title: "Détail de ma demande de vol — Agence Wina" },
      { name: "description", content: "Consultez l'offre tarifaire de votre demande de vol, acceptez ou refusez, puis payez avec votre portefeuille Wina." },
      { property: "og:title", content: "Détail de ma demande de vol — Agence Wina" },
      { property: "og:description", content: "Offre tarifaire, paiement portefeuille et informations passagers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestDetail,
});

type Req = any;
type Offer = any;

type PaxForm = {
  passenger_type: "adult" | "child" | "infant";
  last_name: string; first_name: string; gender: string; birth_date: string;
  nationality: string; doc_type: string; doc_number: string; doc_expiry: string;
  doc_country: string; phone: string; email: string;
  guardian_name: string; guardian_relation: string;
};

const blankPax = (t: PaxForm["passenger_type"]): PaxForm => ({
  passenger_type: t, last_name: "", first_name: "", gender: "M", birth_date: "",
  nationality: "Gabonaise", doc_type: "Passeport", doc_number: "", doc_expiry: "",
  doc_country: "Gabon", phone: "", email: "", guardian_name: "", guardian_relation: "",
});

function RequestDetail() {
  const { requestId } = useParams({ from: "/mes-demandes-vols/$requestId" });
  const [req, setReq] = useState<Req | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pax, setPax] = useState<PaxForm[]>([]);
  const [savedPax, setSavedPax] = useState<any[]>([]);

  const load = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const [{ data: r }, { data: o }, { data: w }, { data: p }] = await Promise.all([
      (supabase.from("flight_quote_requests") as any).select("*").eq("id", requestId).maybeSingle(),
      (supabase.from("flight_quote_offers") as any).select("*").eq("request_id", requestId).maybeSingle(),
      auth.user
        ? (supabase.from("vtc_wallets") as any).select("balance_points").eq("user_id", auth.user.id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      (supabase.from("flight_quote_passengers") as any).select("*").eq("request_id", requestId).order("created_at"),
    ]);
    setReq(r);
    setOffer(o);
    setBalance(Number((w as any)?.balance_points ?? 0));
    setSavedPax(((p as any) ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [requestId]);

  // Statut en temps réel (offre reçue, paiement, billet émis, annulation…)
  useEffect(() => {
    const channel = supabase
      .channel(`flight-request-${requestId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_quote_requests", filter: `id=eq.${requestId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_quote_offers", filter: `request_id=eq.${requestId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [requestId]);

  useEffect(() => {
    if (!req || savedPax.length > 0 || pax.length > 0) return;
    if (req.status !== "paid" && req.status !== "ticket_issued") return;
    const list: PaxForm[] = [
      ...Array.from({ length: req.adults }, () => blankPax("adult")),
      ...Array.from({ length: req.children }, () => blankPax("child")),
      ...Array.from({ length: req.infants }, () => blankPax("infant")),
    ];
    setPax(list);
  }, [req, savedPax]);

  const respond = async (accept: boolean) => {
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)("respond_flight_offer", { _request_id: requestId, _accept: accept });
    setBusy(false);
    if (error) { playNotificationSound("error"); toast.error(mapError(error.message)); await load(); return; }
    if (data === "expired") { playNotificationSound("error"); toast.error("Cette offre a expiré."); }
    else if (accept) { playNotificationSound("success"); toast.success("Offre acceptée — procédez au paiement."); }
    else { playNotificationSound("info"); toast.success("Offre refusée, la réservation est annulée."); }
    load();
  };

  const pay = async () => {
    setBusy(true);
    const { error } = await (supabase.rpc as any)("pay_flight_quote_with_wallet", { _request_id: requestId });
    setBusy(false);
    if (error) {
      playNotificationSound("error");
      toast.error(mapError(error.message));
      await (supabase.rpc as any)("notify_self", {
        _type: "flight_payment_failed",
        _title: "Paiement échoué",
        _message: mapError(error.message),
        _link: `/mes-demandes-vols/${requestId}`,
      });
      await load();
      return;
    }
    playNotificationSound("success");
    toast.success("Paiement confirmé");
    load();
  };


  const copyContact = (i: number) => {
    setPax((list) => list.map((p, idx) => idx === i || idx === 0 ? p : {
      ...p, phone: list[0].phone, email: list[0].email,
      nationality: list[0].nationality, doc_country: list[0].doc_country,
    }));
    toast.success("Coordonnées copiées sur les autres passagers");
  };

  const savePassengers = async () => {
    for (const [i, p] of pax.entries()) {
      if (!p.last_name.trim() || !p.first_name.trim()) { toast.error(`Passager ${i + 1} : nom et prénom requis`); return; }
      if (!p.birth_date) { toast.error(`Passager ${i + 1} : date de naissance requise`); return; }
      if (p.passenger_type === "infant") {
        if (!p.guardian_name.trim()) { toast.error(`Bébé ${i + 1} : indiquez l'adulte accompagnateur`); return; }
        if (!isInfantAge(p.birth_date)) { toast.error(`Bébé ${i + 1} : un bébé a au maximum 2 ans et 6 mois`); return; }
      }
    }
    setBusy(true);
    const { error } = await (supabase.from("flight_quote_passengers") as any).insert(
      pax.map((p) => ({
        request_id: requestId,
        passenger_type: p.passenger_type,
        last_name: p.last_name.trim(), first_name: p.first_name.trim(),
        gender: p.gender || null, birth_date: p.birth_date || null,
        nationality: p.nationality || null,
        doc_type: p.passenger_type === "infant" ? null : p.doc_type || null,
        doc_number: p.passenger_type === "infant" ? null : p.doc_number || null,
        doc_expiry: p.passenger_type === "infant" ? null : p.doc_expiry || null,
        doc_country: p.doc_country || null,
        phone: p.phone || null, email: p.email || null,
        guardian_name: p.guardian_name || null,
        guardian_relation: p.guardian_relation || null,
      }))
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Informations passagers enregistrées");
    setPax([]);
    load();
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></main>;
  }
  if (!req) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-sm text-muted-foreground">Demande introuvable.</p>
        <Link to="/mes-demandes-vols" className="text-sm font-semibold text-primary">Retour</Link>
      </main>
    );
  }

  const offerExpired = offer && new Date(offer.valid_until) < new Date();
  const canRespond = req.status === "offer_sent" && offer && !offerExpired;
  const canPay = req.status === "accepted_pending_payment" && offer && !offerExpired;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link to="/mes-demandes-vols" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Mes demandes
        </Link>

        <header className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Plane className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{req.request_number}</h1>
              <p className="text-sm text-muted-foreground">{req.origin} → {req.destination}</p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${REQUEST_STATUS_CLASS[req.status] ?? "bg-muted"}`}>
            {REQUEST_STATUS_LABEL[req.status] ?? req.status}
          </span>
        </header>

        <section className="mt-6 rounded-2xl border bg-card p-4 text-sm">
          <p>{req.trip_type === "round_trip" ? "Aller-retour" : "Aller simple"} · Départ {fmtDate(req.departure_date)}
            {req.trip_type === "round_trip" ? ` · Retour ${fmtDate(req.return_date)}` : ""}</p>
          <p className="text-muted-foreground">{req.adults} adulte(s), {req.children} enfant(s), {req.infants} bébé(s)</p>
          <p className="text-muted-foreground">Créée le {fmtDateTime(req.created_at)}</p>
        </section>

        {offer ? (
          <section className="mt-4 rounded-3xl border-2 border-primary/30 bg-card p-5">
            <h2 className="text-lg font-bold">Proposition de l'agence</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <Row label="Compagnie" value={offer.airline_name} />
              <Row label="Numéro de vol" value={offer.flight_number} />
              <Row label="Date" value={fmtDate(offer.flight_date)} />
              <Row label="Classe" value={offer.travel_class} />
              <Row label="Départ" value={offer.departure_time} />
              <Row label="Arrivée" value={offer.arrival_time} />
              <Row label="Durée" value={offer.duration} />
              <Row label="Escales" value={offer.stopovers} />
              <Row label="Bagages cabine" value={offer.cabin_baggage} />
              <Row label="Bagages soute" value={offer.checked_baggage} />
            </dl>
            {offer.conditions && <p className="mt-3 text-xs text-muted-foreground">Conditions : {offer.conditions}</p>}
            {offer.comments && <p className="mt-1 text-xs text-muted-foreground">Commentaire : {offer.comments}</p>}

            <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t pt-4">
              <div>
                <p className="text-xs text-muted-foreground">Montant total</p>
                <p className="text-2xl font-extrabold text-primary">{FCFA(offer.total_amount)}</p>
                <p className={`text-xs ${offerExpired ? "text-destructive" : "text-muted-foreground"}`}>
                  {offerExpired ? "Offre expirée" : `Valable jusqu'au ${fmtDateTime(offer.valid_until)}`}
                </p>
              </div>
              {canRespond && (
                <div className="flex gap-2">
                  <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => respond(false)}>
                    <XCircle className="mr-1.5 h-4 w-4" /> Refuser
                  </Button>
                  <Button disabled={busy} onClick={() => respond(true)}>
                    {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />} Accepter
                  </Button>
                </div>
              )}
            </div>

            {canPay && (
              <div className="mt-4 rounded-2xl bg-muted/50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Wallet className="h-4 w-4" /> Portefeuille Wina : {FCFA(balance)}
                </div>
                {balance < offer.total_amount ? (
                  <>
                    <p className="mt-1 text-xs text-destructive">
                      Solde insuffisant. Il manque {FCFA(offer.total_amount - balance)}.
                    </p>
                    <Link to="/wallet/recharger">
                      <Button className="mt-3 w-full" variant="outline">Recharger mon portefeuille</Button>
                    </Link>
                  </>
                ) : (
                  <Button className="mt-3 w-full" disabled={busy} onClick={pay}>
                    {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Payer {FCFA(offer.total_amount)}
                  </Button>
                )}
              </div>
            )}
          </section>
        ) : (
          <section className="mt-4 rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Votre demande est en cours de traitement. Vous serez notifié dès qu'une offre sera disponible.
          </section>
        )}

        {savedPax.length > 0 && (
          <section className="mt-4 rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-bold">Passagers enregistrés</h2>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {savedPax.map((p) => (
                <li key={p.id}>
                  {p.passenger_type === "adult" ? "Adulte" : p.passenger_type === "child" ? "Enfant" : "Bébé"} — {p.last_name} {p.first_name}
                  {p.guardian_name ? ` (accompagné de ${p.guardian_name})` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}

        {pax.length > 0 && savedPax.length === 0 && (
          <section className="mt-4 rounded-3xl border bg-card p-5">
            <h2 className="text-lg font-bold">Informations des passagers</h2>
            <p className="text-xs text-muted-foreground">Renseignez chaque passager tel qu'inscrit sur sa pièce d'identité.</p>
            <div className="mt-4 space-y-5">
              {pax.map((p, i) => (
                <div key={i} className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">
                      {p.passenger_type === "adult" ? "Adulte" : p.passenger_type === "child" ? "Enfant" : "Bébé (max 2 ans et 6 mois)"} {i + 1}
                    </h3>
                    {i === 0 && pax.length > 1 && (
                      <Button size="sm" variant="ghost" onClick={() => copyContact(0)}>Copier sur les autres</Button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <F label="Nom" v={p.last_name} on={(v) => upd(setPax, i, { last_name: v })} />
                    <F label="Prénom" v={p.first_name} on={(v) => upd(setPax, i, { first_name: v })} />
                    <div>
                      <Label>Sexe</Label>
                      <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={p.gender} onChange={(e) => upd(setPax, i, { gender: e.target.value })}>
                        <option value="M">Masculin</option>
                        <option value="F">Féminin</option>
                      </select>
                    </div>
                    <F label="Date de naissance" type="date" v={p.birth_date} on={(v) => upd(setPax, i, { birth_date: v })} />
                    <F label="Nationalité" v={p.nationality} on={(v) => upd(setPax, i, { nationality: v })} />
                    {p.passenger_type === "infant" ? (
                      <>
                        <F label="Adulte accompagnateur" v={p.guardian_name} on={(v) => upd(setPax, i, { guardian_name: v })} />
                        <F label="Lien avec l'adulte" v={p.guardian_relation} on={(v) => upd(setPax, i, { guardian_relation: v })} />
                      </>
                    ) : (
                      <>
                        <F label="Type de pièce" v={p.doc_type} on={(v) => upd(setPax, i, { doc_type: v })} />
                        <F label="Numéro de pièce" v={p.doc_number} on={(v) => upd(setPax, i, { doc_number: v })} />
                        <F label="Date d'expiration" type="date" v={p.doc_expiry} on={(v) => upd(setPax, i, { doc_expiry: v })} />
                        <F label="Pays de délivrance" v={p.doc_country} on={(v) => upd(setPax, i, { doc_country: v })} />
                        <F label="Téléphone" v={p.phone} on={(v) => upd(setPax, i, { phone: v })} />
                        <F label="Email" v={p.email} on={(v) => upd(setPax, i, { email: v })} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button className="mt-4 w-full" onClick={savePassengers} disabled={busy}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Enregistrer les passagers
            </Button>
          </section>
        )}
      </div>
    </main>
  );
}

function upd(setPax: React.Dispatch<React.SetStateAction<PaxForm[]>>, i: number, patch: Partial<PaxForm>) {
  setPax((list) => list.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
}

function F({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-3 border-b pb-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value || "—"}</dd>
    </div>
  );
}

function mapError(msg: string) {
  if (msg.includes("INSUFFICIENT_POINTS")) return "Solde insuffisant : rechargez votre portefeuille.";
  if (msg.includes("OFFER_EXPIRED")) return "Cette offre a expiré.";
  if (msg.includes("ALREADY_PAID")) return "Cette demande est déjà payée.";
  if (msg.includes("INVALID_STATUS")) return "Action impossible pour le statut actuel.";
  if (msg.includes("NO_OFFER")) return "Aucune offre disponible.";
  if (msg.includes("FORBIDDEN")) return "Accès refusé.";
  return msg;
}
