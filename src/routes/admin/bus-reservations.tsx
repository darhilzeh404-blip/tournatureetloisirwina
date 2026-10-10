import { createFileRoute } from "@tanstack/react-router";
import { toAdminReservation } from "@/lib/app-fees";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSignedUrlMap } from "@/lib/signed-urls";

import { z } from "zod";
import { Bus, CheckCircle, Eye, ImageIcon, Loader2, MapPin, MessageSquare, Search, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/bus-reservations")({
  component: AdminBusReservations,
});

type ReservationStatus = "PENDING_PAYMENT" | "CONFIRMED" | "REJECTED" | "CANCELLED";
type PaymentStatus = "PENDING" | "VALIDATED" | "REJECTED";

type BusDetails = {
  trajet_groupe?: string;
  lieu_rassemblement?: string;
  destinations?: string[];
  formule?: string;
  jours?: number;
  tarif_unitaire?: number;
  depart_prevu?: string;
  heure_depart?: string;
};

type Reservation = {
  id: string;
  user_id: string;
  status: ReservationStatus;
  reservation_date: string;
  total_amount: number;
  paid_amount: number;
  paiement_valide: boolean;
  details: BusDetails;
  created_at: string;
  admin_comment: string | null;
};

type Payment = {
  id: string;
  reservation_id: string;
  amount: number;
  status: PaymentStatus;
  receipt_url: string | null;
  transaction_ref: string | null;
  created_at: string;
  signed_receipt_url?: string | null;
};

type Profile = { user_id: string; full_name: string; email: string | null; phone: string | null };

const commentSchema = z.string().trim().min(3, "Ajoutez un commentaire de validation ou de rejet.").max(500, "Le commentaire doit faire moins de 500 caractères.");

const STATUS_LABEL: Record<ReservationStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING_PAYMENT: { label: "À traiter", variant: "outline" },
  CONFIRMED: { label: "Validée", variant: "default" },
  REJECTED: { label: "Rejetée", variant: "destructive" },
  CANCELLED: { label: "Annulée", variant: "secondary" },
};

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function AdminBusReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Map<string, Payment>>(new Map());
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState<"CONFIRMED" | "REJECTED" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadingRef = useRef(false);
  const pendingRef = useRef(false);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    void loadRef.current();
    // Les événements temps réel arrivent par rafales (une réservation + son
    // paiement). Sans anti-rebond, chaque événement relançait un rechargement
    // complet : l'écran se figeait sur les WebView Android.
    const scheduleReload = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => void loadRef.current(), 600);
    };
    const channel = supabase
      .channel("admin-group-bus-reservations")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, scheduleReload)
      .subscribe();
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadReservations() {
    // Évite les rechargements concurrents (rafales temps réel).
    if (loadingRef.current) {
      pendingRef.current = true;
      return;
    }
    loadingRef.current = true;
    setLoading(true);
    const { data, error } = await supabase
      .from("reservations")
      .select("id,user_id,status,reservation_date,total_amount,paid_amount,service_amount,paiement_valide,details,created_at,admin_comment")
      .eq("service_type", "LOCATION_BUS")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error("Impossible de charger les réservations bus.");
      setLoading(false);
      loadingRef.current = false;
      return;
    }

    const groupBusReservations = ((data ?? []) as unknown as Reservation[]).filter((reservation) => Boolean(reservation.details?.trajet_groupe)).map(toAdminReservation);
    setReservations(groupBusReservations);

    const reservationIds = groupBusReservations.map((reservation) => reservation.id);
    const userIds = Array.from(new Set(groupBusReservations.map((reservation) => reservation.user_id)));

    const [{ data: profilesData }, { data: paymentsData }] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("user_id,full_name,email,phone").in("user_id", userIds)
        : Promise.resolve({ data: [] }),
      reservationIds.length
        ? supabase.from("payments").select("id,reservation_id,amount,status,receipt_url,transaction_ref,created_at").in("reservation_id", reservationIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map<string, Profile>();
    ((profilesData ?? []) as Profile[]).forEach((profile) => profileMap.set(profile.user_id, profile));
    setProfiles(profileMap);

    // Une seule requête de signature pour tous les reçus (au lieu d'un appel
    // réseau par ligne, qui saturait la WebView).
    const latest: Payment[] = [];
    const seen = new Set<string>();
    ((paymentsData ?? []) as Payment[]).forEach((payment) => {
      if (seen.has(payment.reservation_id)) return;
      seen.add(payment.reservation_id);
      latest.push(payment);
    });
    const signedMap = await createSignedUrlMap("payment-receipts", latest.map((p) => p.receipt_url));
    const paymentMap = new Map<string, Payment>();
    latest.forEach((payment) => {
      paymentMap.set(payment.reservation_id, {
        ...payment,
        signed_receipt_url: payment.receipt_url ? signedMap.get(payment.receipt_url) ?? null : null,
      });
    });
    setPayments(paymentMap);
    setLoading(false);
    loadingRef.current = false;
    if (pendingRef.current) {
      pendingRef.current = false;
      void loadReservations();
    }
  }

  loadRef.current = loadReservations;


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reservations;
    return reservations.filter((reservation) => {
      const profile = profiles.get(reservation.user_id);
      const details = reservation.details;
      return [profile?.full_name, profile?.phone, reservation.id, details.trajet_groupe, details.lieu_rassemblement, details.formule]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [profiles, reservations, search]);

  const pendingCount = reservations.filter((reservation) => reservation.status === "PENDING_PAYMENT").length;
  const validatedCount = reservations.filter((reservation) => reservation.status === "CONFIRMED").length;
  const rejectedCount = reservations.filter((reservation) => reservation.status === "REJECTED").length;

  async function decideReservation(status: "CONFIRMED" | "REJECTED") {
    if (!selected) return;
    const parsed = commentSchema.safeParse(comment);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Commentaire invalide.");
      return;
    }

    const payment = payments.get(selected.id);
    if (status === "CONFIRMED" && !payment?.receipt_url) {
      toast.error("Impossible de valider sans preuve de paiement.");
      return;
    }

    setSaving(status);
    const { error: reservationError } = await supabase
      .from("reservations")
      .update({
        status,
        admin_comment: parsed.data,
        paiement_valide: status === "CONFIRMED",
        paid_amount: status === "CONFIRMED" ? payment?.amount ?? selected.paid_amount : selected.paid_amount,
      })
      .eq("id", selected.id);

    if (reservationError) {
      toast.error(reservationError.message);
      setSaving(null);
      return;
    }

    if (payment) {
      await supabase
        .from("payments")
        .update({ status: status === "CONFIRMED" ? "VALIDATED" : "REJECTED", admin_comment: parsed.data })
        .eq("id", payment.id);
    }

    toast.success(status === "CONFIRMED" ? "Réservation bus validée." : "Réservation bus rejetée.");
    setSelected(null);
    setComment("");
    setSaving(null);
    void loadReservations();
  }

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Validation bus de groupe</h1>
          <p className="text-sm text-muted-foreground">Contrôlez la preuve de paiement avant validation ou rejet.</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher…" className="h-10 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="À traiter" value={pendingCount} />
        <SummaryCard label="Validées" value={validatedCount} />
        <SummaryCard label="Rejetées" value={rejectedCount} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Aucune réservation bus de groupe.</CardContent></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((reservation) => {
            const profile = profiles.get(reservation.user_id);
            const payment = payments.get(reservation.id);
            const status = STATUS_LABEL[reservation.status];
            return (
              <Card key={reservation.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="grid gap-0 md:grid-cols-[180px_1fr]">
                    <button type="button" onClick={() => payment?.signed_receipt_url && setPreviewUrl(payment.signed_receipt_url)} className="flex min-h-44 items-center justify-center bg-muted">
                      {payment?.signed_receipt_url ? <img loading="lazy" decoding="async" src={payment.signed_receipt_url} alt="Preuve de paiement" className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
                    </button>
                    <div className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{profile?.full_name || "Client"}</p>
                          <p className="text-xs text-muted-foreground">{profile?.phone || profile?.email || reservation.user_id}</p>
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>

                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <Info label="Trajet" value={reservation.details.trajet_groupe || "—"} />
                        <Info label="Départ" value={formatDateTime(reservation.details.depart_prevu)} />
                        <Info label="Rassemblement" value={reservation.details.lieu_rassemblement || "—"} />
                        <Info label="Formule" value={reservation.details.formule || "—"} />
                        <Info label="Total" value={formatXAF(reservation.total_amount)} strong />
                        <Info label="Paiement" value={payment ? `${formatXAF(payment.amount)} · ${payment.status}` : "Aucune preuve"} strong={Boolean(payment)} />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(reservation.details.destinations ?? []).map((destination) => <span key={destination} className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-semibold">{destination}</span>)}
                      </div>

                      {reservation.admin_comment && <p className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground"><MessageSquare className="mr-1 inline h-3.5 w-3.5" />{reservation.admin_comment}</p>}

                      <div className="flex flex-wrap gap-2">
                        {payment?.signed_receipt_url && <Button type="button" variant="outline" size="sm" onClick={() => setPreviewUrl(payment.signed_receipt_url ?? null)}><Eye className="h-4 w-4" /> Voir preuve</Button>}
                        <Button type="button" size="sm" onClick={() => { setSelected(reservation); setComment(reservation.admin_comment ?? ""); }}><Bus className="h-4 w-4" /> Traiter</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Décision admin</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <textarea value={comment} onChange={(event) => setComment(event.target.value.slice(0, 500))} placeholder="Commentaire obligatoire…" className="min-h-32 w-full rounded-xl border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <p className="text-xs text-muted-foreground">{comment.trim().length}/500 caractères</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="destructive" disabled={Boolean(saving)} onClick={() => void decideReservation("REJECTED")}><XCircle className="h-4 w-4" /> Rejeter</Button>
              <Button type="button" disabled={Boolean(saving)} onClick={() => void decideReservation("CONFIRMED")}><CheckCircle className="h-4 w-4" /> Valider</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewUrl)} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Preuve de paiement</DialogTitle></DialogHeader>
          {previewUrl && <img loading="lazy" decoding="async" src={previewUrl} alt="Preuve de paiement" className="max-h-[75vh] w-full rounded-xl object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></CardContent></Card>;
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className={strong ? "font-bold text-primary" : "font-medium"}>{value}</p></div>;
}