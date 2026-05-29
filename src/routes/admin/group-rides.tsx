import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle, XCircle, Users, MapPin, Search, ImageIcon, ExternalLink, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GROUP_RIDE_STATUS_LABEL } from "@/lib/group-ride";

export const Route = createFileRoute("/admin/group-rides")({
  head: () => ({ meta: [{ title: "Courses Groupées — Admin" }] }),
  component: AdminGroupRides,
});

type PayStatus = "PENDING" | "VALIDATED" | "REJECTED";

interface Payment {
  id: string;
  ride_id: string;
  passenger_id: string;
  user_id: string;
  amount: number;
  method: string;
  status: PayStatus;
  transaction_ref: string | null;
  receipt_url: string | null;
  admin_comment: string | null;
  created_at: string;
  client_name?: string;
  signed_receipt_url?: string | null;
}

interface Passenger {
  id: string;
  ride_id: string;
  user_id: string;
  pickup_address: string;
  destination_address: string;
  status: string;
  client_name?: string;
}

interface Ride {
  id: string;
  status: string;
  seats_taken: number;
  max_seats: number;
  price_per_seat: number;
  communes_count: number;
  driver_id: string | null;
  created_at: string;
  departure_deadline: string;
}

const STATUS_BADGE: Record<PayStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "En attente", variant: "outline" },
  VALIDATED: { label: "Validé", variant: "default" },
  REJECTED: { label: "Rejeté", variant: "destructive" },
};

const formatXAF = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " XAF";

function AdminGroupRides() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [paxByRide, setPaxByRide] = useState<Record<string, Passenger[]>>({});
  const [paymentsByRide, setPaymentsByRide] = useState<Record<string, Payment[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | string>("ALL");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rideData, error } = await supabase
      .from("group_rides")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (rideData || []) as Ride[];
    setRides(list);
    const ids = list.map((r) => r.id);
    if (ids.length === 0) {
      setPaxByRide({});
      setPaymentsByRide({});
      setLoading(false);
      return;
    }

    const [{ data: pax }, { data: pays }] = await Promise.all([
      supabase.from("group_ride_passengers").select("id, ride_id, user_id, pickup_address, destination_address, status").in("ride_id", ids),
      supabase.from("group_ride_payments").select("*").in("ride_id", ids).order("created_at", { ascending: false }),
    ]);

    const userIds = Array.from(new Set([
      ...((pax || []) as Passenger[]).map((p) => p.user_id),
      ...((pays || []) as Payment[]).map((p) => p.user_id),
    ]));
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
      : { data: [] as { user_id: string; full_name: string }[] };
    const nameMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

    const paxMap: Record<string, Passenger[]> = {};
    ((pax || []) as Passenger[]).forEach((p) => {
      (paxMap[p.ride_id] ||= []).push({ ...p, client_name: nameMap.get(p.user_id) || "—" });
    });
    setPaxByRide(paxMap);

    const enriched = await Promise.all(
      ((pays || []) as Payment[]).map(async (p) => {
        let signed: string | null = null;
        if (p.receipt_url) {
          const { data: s } = await supabase.storage.from("payment-receipts").createSignedUrl(p.receipt_url, 3600);
          signed = s?.signedUrl ?? null;
        }
        return { ...p, client_name: nameMap.get(p.user_id) || "—", signed_receipt_url: signed };
      })
    );
    const payMap: Record<string, Payment[]> = {};
    enriched.forEach((p) => { (payMap[p.ride_id] ||= []).push(p); });
    setPaymentsByRide(payMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("admin-group-rides")
      .on("postgres_changes", { event: "*", schema: "public", table: "group_rides" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_ride_payments" }, (payload) => {
        if (payload.eventType === "INSERT") toast.info("Nouveau paiement groupé reçu");
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_ride_passengers" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const validate = async (id: string) => {
    const { error } = await supabase.from("group_ride_payments").update({ status: "VALIDATED" }).eq("id", id);
    if (error) return toast.error(error.message);
    // Attribution automatique des Wina Coins au passager
    const { data: coinsData, error: coinsErr } = await supabase.rpc("award_wina_coins_group_payment", {
      _payment_id: id,
    });
    if (coinsErr) {
      console.error("[wina-coins] award group", coinsErr);
      toast.warning("Paiement validé mais l'attribution des Wina Coins a échoué.");
    } else {
      const earned = coinsData?.[0]?.coins_earned ?? 0;
      toast.success(earned > 0 ? `Paiement validé · +${earned} Wina Coins` : "Paiement validé");
    }
    void load();
  };

  const reject = async (id: string) => {
    const { error } = await supabase
      .from("group_ride_payments")
      .update({ status: "REJECTED", admin_comment: rejectComment || "Rejeté par l'admin" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    // Si des coins avaient été attribués (re-rejet après validation), on les rembourse
    const { error: refundErr } = await supabase.rpc("refund_wina_coins_group_payment", {
      _payment_id: id,
    });
    if (refundErr) console.error("[wina-coins] refund group", refundErr);
    setRejectTarget(null);
    setRejectComment("");
    toast.success("Paiement rejeté");
    void load();
  };

  const allPayments = Object.values(paymentsByRide).flat();
  const pendingCount = allPayments.filter((p) => p.status === "PENDING").length;
  const totalValidated = allPayments.filter((p) => p.status === "VALIDATED").reduce((s, p) => s + p.amount, 0);

  const filtered = rides.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    if (r.id.toLowerCase().includes(q)) return true;
    const pax = paxByRide[r.id] || [];
    return pax.some((p) =>
      (p.client_name || "").toLowerCase().includes(q) ||
      p.pickup_address.toLowerCase().includes(q) ||
      p.destination_address.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Courses Groupées</h1>
        <p className="text-sm text-muted-foreground">Suivi des covoiturages et validation des paiements</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Courses</p><p className="text-2xl font-bold">{rides.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Paiements en attente</p><p className="text-2xl font-bold">{pendingCount}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Total validé</p><p className="text-2xl font-bold">{formatXAF(totalValidated)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Actives</p><p className="text-2xl font-bold">{rides.filter((r) => ["searching","matched","driver_arriving","active"].includes(r.status)).length}</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher (client, adresse, ID)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="inline-flex rounded-lg border bg-card p-1">
          {(["ALL","searching","matched","driver_arriving","active","completed","cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {s === "ALL" ? "Tous" : GROUP_RIDE_STATUS_LABEL[s] || s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Aucune course trouvée.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            const pax = paxByRide[r.id] || [];
            const pays = paymentsByRide[r.id] || [];
            return (
              <Card key={r.id}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{GROUP_RIDE_STATUS_LABEL[r.status] || r.status}</Badge>
                        <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{r.seats_taken}/{r.max_seats}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-FR")}</span>
                      </div>
                      <p className="mt-2 text-sm">
                        {r.communes_count} commune(s) · {formatXAF(r.price_per_seat)} / place ·
                        {r.driver_id ? " Chauffeur assigné" : " Sans chauffeur"}
                      </p>
                      <code className="text-[10px] text-muted-foreground">{r.id.slice(0, 8)}…</code>
                    </div>
                  </div>

                  {pax.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Passagers ({pax.length})</p>
                      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                        {pax.map((p, i) => (
                          <div key={p.id} className="flex items-start gap-2 text-xs">
                            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">{p.client_name} <Badge variant="outline" className="ml-1 text-[9px]">{p.status}</Badge></p>
                              <p className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 text-green-600" /> {p.pickup_address}</p>
                              <p className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 text-red-600" /> {p.destination_address}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pays.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Paiements ({pays.length})</p>
                      <div className="space-y-2">
                        {pays.map((p) => {
                          const st = STATUS_BADGE[p.status];
                          return (
                            <div key={p.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row">
                              <button
                                type="button"
                                onClick={() => p.signed_receipt_url && setPreviewUrl(p.signed_receipt_url)}
                                className="relative h-24 w-full shrink-0 overflow-hidden rounded-md bg-muted sm:w-24"
                              >
                                {p.signed_receipt_url ? (
                                  <img src={p.signed_receipt_url} alt="Reçu" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>
                                )}
                              </button>
                              <div className="flex-1 space-y-1 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-semibold">{p.client_name}</p>
                                  <Badge variant={st.variant}>{st.label}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{p.method} · {new Date(p.created_at).toLocaleString("fr-FR")}</p>
                                <p className="font-semibold">{formatXAF(p.amount)}</p>
                                {p.transaction_ref && (
                                  <code className="rounded bg-muted px-2 py-0.5 text-[11px]">{p.transaction_ref}</code>
                                )}
                                {p.admin_comment && (
                                  <p className="flex items-start gap-1 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                                    <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" /> {p.admin_comment}
                                  </p>
                                )}
                                {p.status === "PENDING" && (
                                  <div className="flex gap-2 pt-1">
                                    <Button size="sm" onClick={() => validate(p.id)} className="flex-1">
                                      <CheckCircle className="mr-1 h-4 w-4" />Valider
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => setRejectTarget(p.id)} className="flex-1">
                                      <XCircle className="mr-1 h-4 w-4" />Rejeter
                                    </Button>
                                  </div>
                                )}
                                {p.signed_receipt_url && (
                                  <a href={p.signed_receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                    <ExternalLink className="h-3 w-3" /> Ouvrir le reçu
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Reçu de paiement</DialogTitle></DialogHeader>
          {previewUrl && <img src={previewUrl} alt="Reçu" className="max-h-[75vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="space-y-4 p-6">
              <h3 className="text-lg font-bold">Rejeter le paiement</h3>
              <p className="text-sm text-muted-foreground">Ajoutez un commentaire pour le passager.</p>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Raison du rejet…"
                className="h-24 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectComment(""); }}>Annuler</Button>
                <Button variant="destructive" onClick={() => reject(rejectTarget)}>Confirmer le rejet</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
