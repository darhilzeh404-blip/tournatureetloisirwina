import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Truck, Loader2, MapPin, CheckCircle2, XCircle, MessageSquare,
  FileDown, Wallet, ArrowLeft, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { playNotificationSound } from "@/lib/notification-sound";
import { fetchVtcWallet, formatXAF } from "@/lib/vtc-wallet";
import type { MovingDocData } from "@/lib/moving-receipt";
import {
  HOUSING_TYPES, MOVING_STATUS_LABELS, SERVICE_TYPES, VOLUMES,
  fetchMovingPhotos, fetchMovingQuotes, fetchMovingRequest, formatFcfa,
  googleMapsLink, movingStatusClass, respondMovingQuote, signedPhotoUrl,
  type MovingQuote, type MovingRequest,
} from "@/lib/moving";

export const Route = createFileRoute("/demenagement/$id")({
  head: () => ({
    meta: [
      { title: "Suivi de mon déménagement — Wina Tour" },
      { name: "description", content: "Suivez votre demande de déménagement, consultez votre devis et payez avec votre portefeuille Wina." },
      { property: "og:title", content: "Suivi de mon déménagement — Wina Tour" },
      { property: "og:description", content: "Devis personnalisé, validation et paiement par portefeuille." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MovingDetail,
});

const label = (list: { value: string; label: string }[], v: string) =>
  list.find((i) => i.value === v)?.label ?? v;

function MovingDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, isLoading, isAuthenticated } = useAuth();

  const [request, setRequest] = useState<MovingRequest | null>(null);
  const [quotes, setQuotes] = useState<MovingQuote[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [modifyMsg, setModifyMsg] = useState("");
  const [showModify, setShowModify] = useState(false);

  const load = useCallback(async () => {
    const [r, q, p] = await Promise.all([
      fetchMovingRequest(id), fetchMovingQuotes(id), fetchMovingPhotos(id),
    ]);
    setRequest(r);
    setQuotes(q);
    const urls = await Promise.all(p.map((ph) => signedPhotoUrl(ph.storage_path)));
    setPhotoUrls(urls.filter((u): u is string => Boolean(u)));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/connexion" });
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (user) fetchVtcWallet(user.id).then((w) => setBalance(w.balance_points)).catch(() => setBalance(0));
  }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel(`moving-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "moving_requests", filter: `id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "moving_quotes", filter: `request_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, load]);

  const activeQuote = quotes[0] ?? null;

  const respond = async (action: "accept" | "refuse" | "modify") => {
    if (!activeQuote) return;
    setBusy(true);
    try {
      await respondMovingQuote(activeQuote.id, action, action === "modify" ? modifyMsg : undefined);
      playNotificationSound(action === "refuse" ? "error" : "success");
      toast.success(
        action === "accept" ? "Devis accepté. Vous pouvez maintenant payer."
          : action === "refuse" ? "Devis refusé." : "Demande de modification envoyée.",
      );
      setShowModify(false);
      setModifyMsg("");
      await load();
    } catch {
      playNotificationSound("error");
      toast.error("Action impossible. Réessayez.");
    } finally { setBusy(false); }
  };

  const pay = async () => {
    if (!activeQuote) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as never as (n: string, p: unknown) => Promise<{ data: unknown; error: unknown }>)(
        "pay_moving_quote_with_wallet", { _quote_id: activeQuote.id },
      );
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as { new_balance?: number } | null;
      setBalance(Number(row?.new_balance ?? 0));
      playNotificationSound("success");
      toast.success("Paiement effectué depuis votre portefeuille.");
      await load();
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? "");
      playNotificationSound("error");
      toast.error(
        msg.includes("INSUFFICIENT_POINTS") ? "Solde insuffisant — rechargez votre portefeuille."
          : msg.includes("ALREADY_PAID") ? "Ce déménagement est déjà payé."
            : "Paiement impossible. Réessayez.",
      );
    } finally { setBusy(false); }
  };

  const docData = (): MovingDocData | null => {
    if (!request) return null;
    return {
      reference: request.reference_code,
      clientName: request.full_name,
      phone: request.phone,
      email: request.email,
      fromAddress: request.from_address,
      toAddress: request.to_address,
      serviceLabel: label(SERVICE_TYPES, request.service_type),
      housingLabel: label(HOUSING_TYPES, request.housing_type),
      volumeLabel: label(VOLUMES, request.volume),
      moversCount: request.movers_count,
      scheduledDate: activeQuote?.scheduled_date ?? request.desired_date,
      scheduledTime: activeQuote?.scheduled_time ?? request.desired_time,
      amount: request.paid_amount || activeQuote?.price || 0,
      paidAt: request.paid_at ?? new Date().toISOString(),
      details: activeQuote?.details ?? null,
      conditions: activeQuote?.conditions ?? null,
    };
  };

  const download = async (kind: "receipt" | "invoice") => {
    const d = docData();
    if (!d) return;
    const { buildMovingInvoice, buildMovingReceipt } = await import("@/lib/moving-receipt");
    const doc = kind === "receipt" ? buildMovingReceipt(d) : buildMovingInvoice(d);
    doc.save(`${kind === "receipt" ? "recu" : "facture"}-${d.reference}.pdf`);
  };

  if (loading || isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!request) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-sm text-muted-foreground">Demande introuvable.</p>
        <Button asChild variant="outline" className="mt-4 rounded-xl"><Link to="/demenagement">Retour</Link></Button>
        <ClientNav />
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="mx-auto max-w-3xl space-y-4 px-5 pt-6">
        <Link to="/demenagement" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Mes déménagements
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold">{request.reference_code}</h1>
                <p className="text-xs text-muted-foreground">
                  {new Date(request.desired_date).toLocaleDateString("fr-FR")}
                  {request.desired_time ? ` à ${request.desired_time.slice(0, 5)}` : ""}
                </p>
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${movingStatusClass(request.status)}`}>
              {MOVING_STATUS_LABELS[request.status]}
            </span>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <a href={googleMapsLink(request.from_lat, request.from_lng, request.from_address)}
              target="_blank" rel="noopener noreferrer"
              className="rounded-2xl border bg-background p-3 transition-colors hover:bg-secondary">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary"><MapPin className="h-3.5 w-3.5" /> Départ</div>
              <div className="mt-1 font-medium">{request.from_address}</div>
              <div className="text-xs text-muted-foreground">
                {[request.from_quartier, request.from_commune].filter(Boolean).join(" · ")} — Étage {request.from_floor}
                {request.from_elevator ? " (ascenseur)" : ""}
              </div>
            </a>
            <a href={googleMapsLink(request.to_lat, request.to_lng, request.to_address)}
              target="_blank" rel="noopener noreferrer"
              className="rounded-2xl border bg-background p-3 transition-colors hover:bg-secondary">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary"><MapPin className="h-3.5 w-3.5" /> Arrivée</div>
              <div className="mt-1 font-medium">{request.to_address}</div>
              <div className="text-xs text-muted-foreground">
                {[request.to_quartier, request.to_commune].filter(Boolean).join(" · ")} — Étage {request.to_floor}
                {request.to_elevator ? " (ascenseur)" : ""}
              </div>
            </a>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {[
              label(SERVICE_TYPES, request.service_type),
              label(HOUSING_TYPES, request.housing_type),
              `Volume ${label(VOLUMES, request.volume)}`,
              request.movers_count > 0 ? `${request.movers_count} déménageurs` : "Sans déménageurs",
              request.ac_dismount ? `${request.ac_units} climatiseur(s)` : null,
              `${request.boxes_count} cartons`,
            ].filter(Boolean).map((t) => (
              <span key={String(t)} className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">{t}</span>
            ))}
          </div>

          {photoUrls.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {photoUrls.map((u) => (
                <img key={u} src={u} alt="Photo du déménagement" loading="lazy"
                  className="aspect-square w-full rounded-xl border object-cover" />
              ))}
            </div>
          )}
        </motion.div>

        {activeQuote ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-bold">Votre devis personnalisé</h2>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Montant</span>
              <span className="text-2xl font-bold text-primary">{formatFcfa(activeQuote.price)}</span>
            </div>
            {(activeQuote.scheduled_date || activeQuote.scheduled_time) && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {activeQuote.scheduled_date ? new Date(activeQuote.scheduled_date).toLocaleDateString("fr-FR") : ""}
                {activeQuote.scheduled_time ? ` à ${activeQuote.scheduled_time.slice(0, 5)}` : ""}
              </p>
            )}
            {activeQuote.details && <p className="mt-3 whitespace-pre-wrap text-sm">{activeQuote.details}</p>}
            {activeQuote.conditions && (
              <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{activeQuote.conditions}</p>
            )}
            {activeQuote.admin_note && (
              <p className="mt-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground">{activeQuote.admin_note}</p>
            )}

            {activeQuote.status === "ENVOYE" && (
              <div className="mt-4 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={() => respond("accept")} disabled={busy} className="flex-1 rounded-xl">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Accepter
                  </Button>
                  <Button onClick={() => respond("refuse")} disabled={busy} variant="destructive" className="flex-1 rounded-xl">
                    <XCircle className="mr-2 h-4 w-4" /> Refuser
                  </Button>
                  <Button onClick={() => setShowModify((v) => !v)} disabled={busy} variant="outline" className="flex-1 rounded-xl">
                    <MessageSquare className="mr-2 h-4 w-4" /> Modification
                  </Button>
                </div>
                {showModify && (
                  <div className="space-y-2">
                    <Textarea rows={3} value={modifyMsg} onChange={(e) => setModifyMsg(e.target.value)}
                      placeholder="Décrivez la modification souhaitée…" />
                    <Button onClick={() => respond("modify")} disabled={busy || !modifyMsg.trim()} className="w-full rounded-xl">
                      Envoyer la demande de modification
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeQuote.status === "ACCEPTE" && !request.paid && (
              <div className="mt-4 space-y-3 rounded-2xl border bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Wallet className="h-4 w-4 text-primary" /> Portefeuille Wina
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Solde disponible</span>
                  <span className="font-bold">{balance === null ? "…" : formatXAF(balance)}</span>
                </div>
                {balance !== null && balance < activeQuote.price ? (
                  <Button asChild className="w-full rounded-xl">
                    <Link to="/wallet/recharger">Recharger mon portefeuille</Link>
                  </Button>
                ) : (
                  <Button onClick={pay} disabled={busy} className="w-full rounded-xl">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Payer ${formatFcfa(activeQuote.price)}`}
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <div className="rounded-3xl border bg-card p-5 text-sm text-muted-foreground">
            Notre équipe étudie votre dossier et vous enverra un devis personnalisé.
          </div>
        )}

        {request.paid && (
          <div className="rounded-3xl border border-green-500/40 bg-green-500/5 p-5">
            <div className="flex items-center gap-2 font-semibold text-green-600">
              <CheckCircle2 className="h-5 w-5" /> Paiement confirmé — {formatFcfa(request.paid_amount)}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => download("receipt")}>
                <FileDown className="mr-2 h-4 w-4" /> Reçu PDF
              </Button>
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => download("invoice")}>
                <FileDown className="mr-2 h-4 w-4" /> Facture PDF
              </Button>
            </div>
          </div>
        )}
      </div>
      <ClientNav />
    </div>
  );
}
