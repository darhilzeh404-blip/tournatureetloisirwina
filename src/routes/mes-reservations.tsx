import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, CheckCircle, XCircle, AlertCircle, Compass, ArrowRight, Wallet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ReservationListSkeleton } from "@/components/skeletons";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type ReservationStatus = Database["public"]["Enums"]["reservation_status"];
type ServiceType = Database["public"]["Enums"]["service_type"];

interface Reservation {
  id: string;
  service_type: ServiceType;
  reservation_date: string;
  total_amount: number;
  paid_amount: number;
  status: ReservationStatus;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const Route = createFileRoute("/mes-reservations")({
  head: () => ({
    meta: [
      { title: "Mes Réservations — Agence Wina" },
      { name: "description", content: "Suivez vos réservations de transport et circuits touristiques." },
    ],
  }),
  component: MesReservationsPage,
});

const STATUS_CONFIG: Record<ReservationStatus, { label: string; icon: React.ReactNode; className: string }> = {
  PENDING_PAYMENT: { label: "En attente de paiement", icon: <Clock className="h-4 w-4" />, className: "bg-warning/10 text-warning-foreground border-warning/30" },
  CONFIRMED: { label: "Confirmée", icon: <CheckCircle className="h-4 w-4" />, className: "bg-success/10 text-success border-success/30" },
  REJECTED: { label: "Refusée", icon: <XCircle className="h-4 w-4" />, className: "bg-destructive/10 text-destructive border-destructive/30" },
  CANCELLED: { label: "Annulée", icon: <AlertCircle className="h-4 w-4" />, className: "bg-muted text-muted-foreground border-muted" },
};

const SERVICE_LABEL: Record<ServiceType, string> = {
  TRANSPORT_SCOLAIRE: "Transport Scolaire",
  LOCATION_BUS: "Location de Bus",
  CIRCUIT_TOURISTIQUE: "Circuit Touristique",
};

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function summarize(details: Record<string, unknown> | null, type: ServiceType): string {
  if (!details) return SERVICE_LABEL[type];
  const d = details as Record<string, string | number | boolean>;
  if (type === "CIRCUIT_TOURISTIQUE") {
    const dest = d.destination || d.circuit;
    const persons = d.persons ? ` — ${d.persons} pers.` : "";
    const days = d.days ? ` — ${d.days} jour(s)` : "";
    return `${dest ?? "Destination"}${persons}${days}`;
  }
  if (type === "TRANSPORT_SCOLAIRE") {
    const route = d.trajet || d.route;
    const formula = d.formule ? ` — ${d.formule}` : "";
    const kids = d.children || d.enfants;
    return `${route ?? "Trajet"}${formula}${kids ? ` — ${kids} enfant(s)` : ""}`;
  }
  if (type === "LOCATION_BUS") {
    const seats = d.places || d.seats;
    const event = d.evenement || d.event;
    return `${seats ? `Bus ${seats} places` : "Bus"}${event ? ` — ${event}` : ""}`;
  }
  return SERVICE_LABEL[type];
}

function MesReservationsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<Reservation | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/connexion" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("reservations")
      .select("id, service_type, reservation_date, total_amount, paid_amount, status, details, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
        } else {
          setReservations((data as Reservation[]) ?? []);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handlePaymentSubmitted = (updated: Reservation) => {
    setReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setPayTarget(null);
  };

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
      <h1 className="text-2xl font-bold">Mes Réservations</h1>
      <p className="mt-1 text-sm text-muted-foreground">Suivez le statut de toutes vos réservations.</p>

      <div className="mt-8">
        {loading ? (
          <ReservationListSkeleton count={4} />
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
            Impossible de charger vos réservations. {error}
          </div>
        ) : reservations.length === 0 ? (
          <div className="rounded-2xl border bg-card p-10 text-center">
            <Compass className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <h2 className="mt-4 text-lg font-bold">Aucune réservation pour le moment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Découvrez nos circuits et transports pour commencer votre prochaine aventure.
            </p>
            <Link
              to="/circuits"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Explorer les voyages <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {reservations.map((res) => {
              const cfg = STATUS_CONFIG[res.status];
              const remaining = Math.max(0, res.total_amount - res.paid_amount);
              const canPay = res.status === "PENDING_PAYMENT" && remaining > 0;
              return (
                <div key={res.id} className="card-hover rounded-2xl border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">
                          #{res.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <h3 className="mt-1 font-bold text-card-foreground">
                        {SERVICE_LABEL[res.service_type]}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {summarize(res.details, res.service_type)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Date : {new Date(res.reservation_date).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-lg font-bold">{formatXAF(res.total_amount)}</p>
                      {res.paid_amount > 0 && (
                        <p className="text-xs text-accent">Payé : {formatXAF(res.paid_amount)}</p>
                      )}
                      {canPay && (
                        <p className="mt-0.5 text-xs font-semibold text-warning-foreground">
                          Reste : {formatXAF(remaining)}
                        </p>
                      )}
                    </div>
                  </div>
                  {canPay && (
                    <div className="mt-4 flex justify-end border-t pt-4">
                      <Button
                        size="sm"
                        onClick={() => setPayTarget(res)}
                        className="gap-2"
                      >
                        <Wallet className="h-4 w-4" />
                        Payer le solde ({formatXAF(remaining)})
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PaymentDialog
        reservation={payTarget}
        userId={user?.id ?? null}
        onClose={() => setPayTarget(null)}
        onSuccess={handlePaymentSubmitted}
      />
    </section>
  );
}

function PaymentDialog({
  reservation,
  userId,
  onClose,
  onSuccess,
}: {
  reservation: Reservation | null;
  userId: string | null;
  onClose: () => void;
  onSuccess: (updated: Reservation) => void;
}) {
  const [provider, setProvider] = useState<"Airtel Money" | "Moov Money">("Airtel Money");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (reservation) {
      setProvider("Airtel Money");
      setPhone("");
    }
  }, [reservation?.id]);

  const open = !!reservation;
  const remaining = reservation ? Math.max(0, reservation.total_amount - reservation.paid_amount) : 0;

  const submit = async () => {
    if (!reservation || !userId) return;
    const cleaned = phone.replace(/\s+/g, "");
    if (!/^0?[0-9]{8,9}$/.test(cleaned)) {
      toast.error("Numéro invalide. Format : 074XXXXXX ou 06XXXXXXX.");
      return;
    }
    setSubmitting(true);
    const { error: payError } = await supabase.from("payments").insert({
      reservation_id: reservation.id,
      user_id: userId,
      amount: remaining,
      method: `${provider} (${cleaned})`,
      status: "PENDING",
    });
    if (payError) {
      setSubmitting(false);
      toast.error("Erreur lors de l'enregistrement du paiement : " + payError.message);
      return;
    }
    const newPaid = reservation.paid_amount + remaining;
    const { data: updatedRes, error: resError } = await supabase
      .from("reservations")
      .update({ paid_amount: newPaid })
      .eq("id", reservation.id)
      .select("id, service_type, reservation_date, total_amount, paid_amount, status, details, created_at")
      .single();
    setSubmitting(false);
    if (resError || !updatedRes) {
      toast.error("Paiement enregistré mais mise à jour impossible.");
      return;
    }
    toast.success("Paiement envoyé ! L'admin va valider votre transaction sous peu.");
    onSuccess(updatedRes as Reservation);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payer le solde via Mobile Money</DialogTitle>
          <DialogDescription>
            Solde à régler : <span className="font-bold text-foreground">{formatXAF(remaining)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-2 block text-sm">Opérateur</Label>
            <RadioGroup value={provider} onValueChange={(v) => setProvider(v as typeof provider)} className="grid grid-cols-2 gap-2">
              {(["Airtel Money", "Moov Money"] as const).map((p) => (
                <Label
                  key={p}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm transition-colors ${
                    provider === p ? "border-primary bg-primary/5 font-semibold" : "border-border"
                  }`}
                >
                  <RadioGroupItem value={p} />
                  {p}
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="phone" className="mb-2 block text-sm">Numéro Mobile Money</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="074 12 34 56"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Vous recevrez une notification {provider} pour confirmer le paiement.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            Après validation manuelle par notre équipe (sous 24h ouvrées), votre réservation passera au statut « Confirmée ».
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting || !phone} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmer le paiement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
