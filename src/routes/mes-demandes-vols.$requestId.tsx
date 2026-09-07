import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Plane, Loader2, Wallet, CheckCircle2, XCircle, Upload, FileText, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  DOC_STATUS_CLASS, DOC_STATUS_LABEL, FCFA, FLIGHT_TIMELINE, fmtDate, fmtDateTime,
  REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL, TRAVEL_CLASS_LABEL, timelineIndex,
} from "@/lib/flight-quotes";
import { playNotificationSound } from "@/lib/notification-sound";

export const Route = createFileRoute("/mes-demandes-vols/$requestId")({
  head: () => ({
    meta: [
      { title: "Suivi de ma demande de billet — Agence Wina" },
      { name: "description", content: "Suivez votre demande de billet d'avion : proposition, paiement portefeuille, informations et documents." },
      { property: "og:title", content: "Suivi de ma demande de billet — Agence Wina" },
      { property: "og:description", content: "Proposition, paiement portefeuille, informations et documents de voyage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestDetail,
});

type AnyRow = any;
type Field = { key: string; label: string; type?: string; required?: boolean };

function mapError(msg: string): string {
  if (msg.includes("INSUFFICIENT_POINTS")) return "Solde du portefeuille insuffisant.";
  if (msg.includes("OFFER_EXPIRED")) return "La proposition a expiré.";
  if (msg.includes("ALREADY_PAID")) return "Cette demande est déjà payée.";
  if (msg.includes("INVALID_STATUS")) return "Action indisponible à cette étape.";
  if (msg.includes("NO_OFFER")) return "Aucune proposition disponible.";
  return msg;
}

function RequestDetail() {
  const { requestId } = useParams({ from: "/mes-demandes-vols/$requestId" });
  const [req, setReq] = useState<AnyRow | null>(null);
  const [offer, setOffer] = useState<AnyRow | null>(null);
  const [segments, setSegments] = useState<AnyRow[]>([]);
  const [infos, setInfos] = useState<AnyRow[]>([]);
  const [docs, setDocs] = useState<AnyRow[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});

  const load = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const [{ data: r }, { data: o }, { data: w }, { data: inf }, { data: dc }] = await Promise.all([
      (supabase.from("flight_quote_requests") as any).select("*").eq("id", requestId).maybeSingle(),
      (supabase.from("flight_quote_offers") as any).select("*").eq("request_id", requestId).eq("is_sent", true).maybeSingle(),
      auth.user
        ? (supabase.from("vtc_wallets") as any).select("balance_points").eq("user_id", auth.user.id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      (supabase.from("flight_info_requests") as any).select("*").eq("request_id", requestId).order("created_at"),
      (supabase.from("flight_document_requests") as any).select("*").eq("request_id", requestId).order("created_at"),
    ]);
    setReq(r);
    setOffer(o);
    setBalance(Number((w as any)?.balance_points ?? 0));
    setInfos(((inf as any) ?? []) as AnyRow[]);
    setDocs(((dc as any) ?? []) as AnyRow[]);
    if (o) {
      const { data: seg } = await (supabase.from("flight_offer_segments") as any)
        .select("*").eq("offer_id", (o as any).id).order("position");
      setSegments(((seg as any) ?? []) as AnyRow[]);
    } else {
      setSegments([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [requestId]);

  useEffect(() => {
    const channel = supabase
      .channel(`flight-request-${requestId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_quote_requests", filter: `id=eq.${requestId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_quote_offers", filter: `request_id=eq.${requestId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_info_requests", filter: `request_id=eq.${requestId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_document_requests", filter: `request_id=eq.${requestId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [requestId]);

  const respond = async (accept: boolean, reason?: string) => {
    setBusy(true);
    const { error } = await (supabase.rpc as any)("respond_flight_offer", {
      _request_id: requestId, _accept: accept, _reason: reason ?? null,
    });
    setBusy(false);
    if (error) { playNotificationSound("error"); toast.error(mapError(error.message)); await load(); return; }
    playNotificationSound(accept ? "success" : "info");
    toast.success(accept ? "Proposition acceptée — procédez au paiement." : "Proposition refusée.");
    setRefuseOpen(false);
    setRefuseReason("");
    load();
  };

  const pay = async () => {
    setBusy(true);
    const { error } = await (supabase.rpc as any)("pay_flight_quote_with_wallet", { _request_id: requestId });
    setBusy(false);
    if (error) { playNotificationSound("error"); toast.error(mapError(error.message)); await load(); return; }
    playNotificationSound("success");
    toast.success("Paiement confirmé");
    load();
  };

  const submitInfo = async (row: AnyRow) => {
    const fields = (row.fields ?? []) as Field[];
    const values = answers[row.id] ?? {};
    for (const f of fields) {
      if (f.required !== false && !(values[f.key] ?? "").trim()) {
        toast.error(`Le champ « ${f.label} » est requis`);
        return;
      }
    }
    setBusy(true);
    const { error } = await (supabase.from("flight_info_requests") as any)
      .update({ answers: values }).eq("id", row.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Informations transmises");
    load();
  };

  const uploadDoc = async (row: AnyRow, file: File) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { toast.error("Session expirée"); return; }
    setBusy(true);
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${auth.user.id}/${requestId}/${row.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("flight-documents").upload(path, file, { upsert: true });
    if (upErr) { setBusy(false); toast.error(upErr.message); return; }
    const { error } = await (supabase.from("flight_document_requests") as any)
      .update({ file_path: path, file_name: file.name }).eq("id", row.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Document envoyé");
    load();
  };

  const openDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("flight-documents").createSignedUrl(path, 600);
    if (error || !data?.signedUrl) { toast.error("Fichier indisponible"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
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

  const expired = offer && new Date(offer.valid_until) < new Date();
  const canRespond = req.status === "offer_sent" && offer && !expired;
  const canPay = req.status === "accepted_pending_payment" && offer && !expired;
  const stepIdx = timelineIndex(req.status);

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

        {/* Timeline */}
        <section className="mt-6 rounded-2xl border bg-card p-4">
          <ol className="space-y-3">
            {FLIGHT_TIMELINE.map((s, i) => {
              const done = stepIdx >= 0 && i < stepIdx;
              const active = i === stepIdx;
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={`text-sm ${active ? "font-semibold" : done ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="mt-4 rounded-2xl border bg-card p-4 text-sm">
          <p>{req.trip_type === "round_trip" ? "Aller-retour" : "Aller simple"} · Départ {fmtDate(req.departure_date)}
            {req.trip_type === "round_trip" ? ` · Retour ${fmtDate(req.return_date)}` : ""}</p>
          <p className="text-muted-foreground">
            {req.adults} adulte(s), {req.children} enfant(s), {req.infants} bébé(s) · Classe {TRAVEL_CLASS_LABEL[req.travel_class] ?? req.travel_class}
          </p>
          {req.client_note && <p className="mt-1 text-muted-foreground">Votre note : {req.client_note}</p>}
          <p className="text-muted-foreground">Créée le {fmtDateTime(req.created_at)}</p>
          {req.refusal_reason && (
            <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-destructive">Motif du refus : {req.refusal_reason}</p>
          )}
        </section>

        {/* Proposition */}
        {offer ? (
          <section className="mt-4 rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">Proposition de billet</h2>
              <span className="text-xs text-muted-foreground">Valable jusqu'au {fmtDateTime(offer.valid_until)}</span>
            </div>
            <p className="mt-1 text-sm font-semibold">{offer.airline_name}{offer.flight_number ? ` · ${offer.flight_number}` : ""}</p>
            <p className="text-xs text-muted-foreground">
              {offer.is_direct ? "Vol direct" : "Avec correspondance"}
              {offer.travel_class ? ` · ${TRAVEL_CLASS_LABEL[offer.travel_class] ?? offer.travel_class}` : ""}
              {offer.duration ? ` · ${offer.duration}` : ""}
            </p>

            {segments.length > 0 && (
              <ul className="mt-3 space-y-2">
                {segments.map((s) => (
                  <li key={s.id} className="rounded-xl bg-muted/50 p-3 text-xs">
                    <p className="text-sm font-semibold">
                      {s.departure_city ?? s.departure_airport} → {s.arrival_city ?? s.arrival_airport}
                    </p>
                    <p className="text-muted-foreground">
                      {s.airline_name ?? ""} {s.flight_number ?? ""} · {fmtDate(s.departure_date)} {s.departure_time ?? ""}
                      {s.arrival_time ? ` → ${s.arrival_time}` : ""}{s.duration ? ` · ${s.duration}` : ""}
                    </p>
                    {s.stopover_info && <p className="text-muted-foreground">Escale : {s.stopover_info}</p>}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 space-y-1 rounded-xl border p-3 text-sm">
              <Line label={`Prix par personne × ${offer.passengers_count ?? 1}`} value={FCFA(Number(offer.price_per_person) * Number(offer.passengers_count ?? 1))} />
              {Number(offer.taxes) > 0 && <Line label="Taxes" value={FCFA(offer.taxes)} />}
              {Number(offer.fees) > 0 && <Line label="Frais" value={FCFA(offer.fees)} />}
              {Number(offer.service_fee) > 0 && <Line label="Frais de service" value={FCFA(offer.service_fee)} />}
              {Number(offer.discount) > 0 && <Line label="Remise" value={`- ${FCFA(offer.discount)}`} />}
              <div className="flex items-center justify-between border-t pt-2 text-base font-extrabold text-primary">
                <span>Total</span><span>{FCFA(offer.total_amount)}</span>
              </div>
            </div>

            {(offer.cabin_baggage || offer.checked_baggage) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Bagages : {offer.cabin_baggage ?? "—"} en cabine, {offer.checked_baggage ?? "—"} en soute
              </p>
            )}
            {offer.conditions && <p className="mt-2 text-xs text-muted-foreground">Conditions : {offer.conditions}</p>}
            {offer.comments && <p className="mt-1 text-xs text-muted-foreground">{offer.comments}</p>}

            {expired && <p className="mt-3 text-sm font-semibold text-destructive">Cette proposition a expiré.</p>}

            {canRespond && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button onClick={() => respond(true)} disabled={busy}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Accepter
                </Button>
                <Button variant="outline" onClick={() => setRefuseOpen(true)} disabled={busy}>
                  <XCircle className="mr-1.5 h-4 w-4" /> Refuser
                </Button>
              </div>
            )}

            {canPay && (
              <div className="mt-4 rounded-xl border p-3">
                <p className="text-sm">Solde portefeuille : <strong>{FCFA(balance)}</strong></p>
                {balance < Number(offer.total_amount) ? (
                  <>
                    <p className="mt-1 text-xs text-destructive">Solde insuffisant pour régler {FCFA(offer.total_amount)}.</p>
                    <Link to="/wallet/recharger" className="mt-2 inline-block text-sm font-semibold text-primary">
                      Recharger mon portefeuille
                    </Link>
                  </>
                ) : (
                  <Button className="mt-2 w-full" onClick={pay} disabled={busy}>
                    {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wallet className="mr-1.5 h-4 w-4" />}
                    Payer {FCFA(offer.total_amount)}
                  </Button>
                )}
              </div>
            )}
          </section>
        ) : (
          <section className="mt-4 rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Votre demande est en cours d'étude. Vous recevrez une notification dès qu'une proposition sera prête.
          </section>
        )}

        {/* Informations complémentaires */}
        {infos.map((row) => {
          const fields = (row.fields ?? []) as Field[];
          const answered = row.status === "answered" && row.answers;
          return (
            <section key={row.id} className="mt-4 rounded-2xl border bg-card p-4">
              <h2 className="text-base font-bold">{row.title}</h2>
              {row.message && <p className="mt-1 text-sm text-muted-foreground">{row.message}</p>}
              {answered ? (
                <div className="mt-3 space-y-1 text-sm">
                  {fields.map((f) => (
                    <p key={f.key}><span className="text-muted-foreground">{f.label} :</span> {String((row.answers as any)[f.key] ?? "—")}</p>
                  ))}
                  <p className="text-xs text-emerald-600">Transmis le {fmtDateTime(row.answered_at)}</p>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {fields.map((f) => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <Input type={f.type === "date" ? "date" : "text"}
                        value={answers[row.id]?.[f.key] ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [row.id]: { ...(a[row.id] ?? {}), [f.key]: e.target.value } }))} />
                    </div>
                  ))}
                  <Button onClick={() => submitInfo(row)} disabled={busy}>Envoyer les informations</Button>
                </div>
              )}
            </section>
          );
        })}

        {/* Documents */}
        {docs.length > 0 && (
          <section className="mt-4 rounded-2xl border bg-card p-4">
            <h2 className="text-base font-bold">Documents demandés</h2>
            <div className="mt-3 space-y-3">
              {docs.map((d) => (
                <div key={d.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{d.name}{d.is_required ? " *" : ""}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${DOC_STATUS_CLASS[d.status] ?? "bg-muted"}`}>
                      {DOC_STATUS_LABEL[d.status] ?? d.status}
                    </span>
                  </div>
                  {d.instructions && <p className="mt-1 text-xs text-muted-foreground">{d.instructions}</p>}
                  {d.due_date && <p className="text-xs text-muted-foreground">À fournir avant le {fmtDate(d.due_date)}</p>}
                  {d.review_reason && <p className="mt-1 text-xs text-destructive">{d.review_reason}</p>}
                  {d.file_path && (
                    <button type="button" onClick={() => openDoc(d.file_path)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <FileText className="h-3.5 w-3.5" /> {d.file_name ?? "Voir le fichier"}
                    </button>
                  )}
                  {d.status !== "approved" && (
                    <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary">
                      <Upload className="h-3.5 w-3.5" />
                      {d.file_path ? "Remplacer le fichier" : "Téléverser le fichier"}
                      <input type="file" className="hidden" accept="image/*,application/pdf"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(d, f); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {req.ticket_pdf_url && (
          <section className="mt-4 rounded-2xl border bg-card p-4">
            <h2 className="text-base font-bold">Votre billet</h2>
            <a href={req.ticket_pdf_url} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              <FileText className="h-4 w-4" /> Télécharger le billet
            </a>
          </section>
        )}
      </div>

      <Dialog open={refuseOpen} onOpenChange={setRefuseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Refuser la proposition</DialogTitle></DialogHeader>
          <div>
            <Label>Motif (optionnel)</Label>
            <Textarea rows={3} value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)}
              placeholder="Tarif trop élevé, horaires inadaptés…" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRefuseOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={() => respond(false, refuseReason.trim() || undefined)} disabled={busy}>
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span><span className="text-foreground">{value}</span>
    </div>
  );
}
