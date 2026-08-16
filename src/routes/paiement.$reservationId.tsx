import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy, Loader2, Camera, CheckCircle2, ArrowLeft, AlertCircle,
  Image as ImageIcon, MessageCircle, Landmark, Banknote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { toast } from "sonner";
import { prepareReceiptImage, buildWhatsappLink } from "@/lib/image-upload";
import { copyText } from "@/lib/clipboard";
import { UseCoinsToggle } from "@/components/wina-coins/UseCoinsToggle";
import { fetchBalance } from "@/lib/wina-coins";
import { isNightHoursNow, requestNotificationPermission, showAppNotification } from "@/lib/notifications";
import { WalletCheckout } from "@/components/WalletCheckout";
import { PaymentMethodSelector } from "@/components/payment/PaymentMethodSelector";
import { BankTransferDetails } from "@/components/payment/BankTransferDetails";
import { AgencyCashInfo } from "@/components/payment/AgencyCashInfo";
import { PAYMENT_CHANNEL_LABEL, type PaymentChannel } from "@/lib/payment-methods";

export const Route = createFileRoute("/paiement/$reservationId")({
  head: () => ({
    meta: [
      { title: "Paiement — Agence Wina" },
      {
        name: "description",
        content:
          "Choisissez votre moyen de paiement : portefeuille WINA TOUR, virement bancaire AFG ou règlement en espèces en agence.",
      },
    ],
  }),
  component: PaiementPage,
});

interface Reservation {
  id: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  user_id: string;
  coins_used: number;
  service_type: string;
  details: Record<string, any> | null;
}

function formatXAF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

function PaiementPage() {
  const { reservationId } = Route.useParams();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<PaymentChannel | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState<string>("");
  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(true);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [coinsBalance, setCoinsBalance] = useState<number>(0);
  const [coinsEnabled, setCoinsEnabled] = useState(false);
  const [coinsAmount, setCoinsAmount] = useState(0);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // UUID transaction généré une seule fois côté app
  const transactionUuid = useMemo(() => crypto.randomUUID(), []);
  // Référence courte (8 derniers caractères, lisible au téléphone)
  const shortRef = useMemo(() => transactionUuid.replace(/-/g, "").slice(-8).toUpperCase(), [transactionUuid]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/connexion" });
      return;
    }
    (async () => {
      const [{ data, error }, { data: settings }] = await Promise.all([
        supabase
          .from("reservations")
          .select("id, total_amount, paid_amount, status, user_id, coins_used, service_type, details")
          .eq("id", reservationId)
          .maybeSingle(),
        supabase
          .from("transport_settings")
          .select("key, value, text_value")
          .in("key", ["whatsapp_admin_number", "whatsapp_fallback_enabled"]),
      ]);
      if (error || !data) {
        toast.error("Réservation introuvable");
        navigate({ to: "/mes-reservations" });
        return;
      }
      setReservation(data as unknown as Reservation);
      const alreadySpent = data.coins_used ?? 0;
      const remainingDue = Math.max(data.total_amount - data.paid_amount - alreadySpent, 0);
      setAmount(remainingDue || data.total_amount);
      const wnum = (settings ?? []).find((s) => s.key === "whatsapp_admin_number");
      const wen = (settings ?? []).find((s) => s.key === "whatsapp_fallback_enabled");
      setWhatsappNumber((wnum?.text_value as string | null) ?? "");
      setWhatsappEnabled(Number(wen?.value ?? 1) === 1);
      const bal = await fetchBalance(user.id);
      setCoinsBalance(bal?.coins_balance ?? 0);
      setLoading(false);
    })();
  }, [authLoading, user, reservationId, navigate]);

  // Recalcul automatique du montant à payer lorsque la réduction coins change
  useEffect(() => {
    if (!reservation) return;
    const discount = coinsEnabled ? coinsAmount : 0;
    const alreadySpent = reservation.coins_used ?? 0;
    const net = Math.max(reservation.total_amount - reservation.paid_amount - alreadySpent - discount, 0);
    setAmount(net);
  }, [coinsEnabled, coinsAmount, reservation]);

  const isVtc = reservation?.service_type === "VTC";
  const isCash = channel === "cash";

  const copy = async (text: string, label: string) => {
    const ok = await copyText(text);
    if (ok) toast.success(`${label} copié`);
    else toast.error("Copie impossible — sélectionnez le texte manuellement");
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset to allow re-pick same file
    if (!file) return;
    setPreparing(true);
    setUploadFailed(false);
    try {
      const prepared = await prepareReceiptImage(file);
      if (prepared.size > 5 * 1024 * 1024) {
        toast.error("Photo trop lourde après compression. Réessayez avec une autre.");
        return;
      }
      setReceiptFile(prepared);
      setReceiptPreview(URL.createObjectURL(prepared));
      toast.success("Photo prête à envoyer");
    } catch (err) {
      console.error("[onFileChange]", err);
      toast.error("Impossible de lire cette photo. Essayez une autre.");
    } finally {
      setPreparing(false);
    }
  };

  const openWhatsappFallback = () => {
    if (!whatsappNumber) {
      toast.error("Numéro WhatsApp admin non configuré.");
      return;
    }
    const msg = `Bonjour, voici la preuve de mon paiement.\nRéservation: ${reservation?.id ?? ""}\nRéférence: ${shortRef}\nMontant: ${amount} FCFA\nMéthode: ${channel ? PAYMENT_CHANNEL_LABEL[channel] : ""}`;
    window.open(buildWhatsappLink(whatsappNumber, msg), "_blank");
  };

  const handleSubmit = async () => {
    if (!user || !reservation || !channel) return;
    if (channel !== "cash" && !receiptFile) {
      toast.error("Veuillez joindre le justificatif de votre virement");
      return;
    }
    const discount = coinsEnabled ? coinsAmount : 0;
    const alreadySpent = reservation.coins_used ?? 0;
    const remaining = Math.max(reservation.total_amount - reservation.paid_amount - alreadySpent - discount, 0);
    if (amount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    if (amount < remaining) {
      toast.error(`Montant total requis : ${formatXAF(remaining)}`);
      return;
    }
    setSubmitting(true);
    setUploadFailed(false);
    try {
      // Appliquer la réduction Wina Coins avant l'enregistrement du paiement
      if (discount > 0 && alreadySpent === 0) {
        const { error: spendErr } = await supabase.rpc("spend_wina_coins", {
          _reservation_id: reservation.id,
          _amount: discount,
        });
        if (spendErr) {
          console.error("[wina-coins] spend", spendErr);
          toast.error("Impossible d'appliquer la réduction Wina Coins.");
          setSubmitting(false);
          return;
        }
      }

      // Upload photo dans le bucket privé sous le dossier de l'utilisateur
      let path: string | null = null;
      if (receiptFile) {
        const ext = (receiptFile.name.split(".").pop() || "jpg").toLowerCase();
        path = `${user.id}/${transactionUuid}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("payment-receipts")
          .upload(path, receiptFile, { upsert: false, contentType: receiptFile.type || "image/jpeg" });
        if (upErr) throw upErr;
      }

      // Insert paiement en attente (le statut réel dépend de la validation admin)
      const { error: payErr } = await supabase.from("payments").insert({
        reservation_id: reservation.id,
        user_id: user.id,
        amount,
        method: channel,
        status: "PENDING",
        transaction_ref: shortRef,
        receipt_url: path,
      });
      if (payErr) throw payErr;

      // Pour une course VTC sans trip encore créé, on lance le dispatch après paiement.
      const details = reservation.details ?? {};
      if (reservation.service_type === "VTC" && details.flow === "vtc_course") {
        const { data: existingTrip } = await supabase
          .from("trips")
          .select("id")
          .eq("reservation_id", reservation.id)
          .is("archived_at", null)
          .maybeSingle();
        let tripId = existingTrip?.id as string | undefined;
        if (!tripId) {
          const pickup = details.pickup ?? {};
          const destination = details.destination ?? {};
          const { data: createdTrip, error: tripErr } = await supabase.from("trips").insert({
            reservation_id: reservation.id,
            client_id: user.id,
            driver_id: null,
            status: "pending",
            origin_address: pickup.label || "Point de prise en charge",
            origin_lat: pickup.lat ?? null,
            origin_lng: pickup.lng ?? null,
            destination_address: destination.label || "Destination",
            destination_lat: destination.lat ?? null,
            destination_lng: destination.lng ?? null,
          }).select("id, origin_lat, origin_lng").maybeSingle();
          if (!tripErr && createdTrip) {
            tripId = createdTrip.id;
            try {
              if (createdTrip.origin_lat != null && createdTrip.origin_lng != null) {
                const { triggerDriverSearch } = await import("@/lib/vtc-dispatch");
                await triggerDriverSearch(
                  createdTrip.id,
                  Number(createdTrip.origin_lat),
                  Number(createdTrip.origin_lng),
                );
              }
            } catch (e) {
              console.error("[VTC paiement] triggerDriverSearch", e);
            }
          }
        }
        toast.success("Paiement envoyé — recherche d'un chauffeur lancée.");
        try {
          await requestNotificationPermission();
          await showAppNotification("Paiement VTC reçu", {
            body: "Recherche d'un chauffeur en cours. Vous serez prévenu dès l'assignation.",
            tag: `vtc-paid-${reservation.id}`,
          });
        } catch { /* notifications best-effort */ }
        navigate({ to: "/vtc/suivi/$reservationId", params: { reservationId: reservation.id } });
        return;
      }

      if ((reservation.details as any)?.train_booking || (reservation.details as any)?.mode === "bateau") {
        navigate({ to: "/billets/confirmation/$reservationId", params: { reservationId: reservation.id } });
        return;
      }
      toast.success(
        channel === "cash"
          ? "Réservation enregistrée — paiement en agence en attente."
          : "Virement soumis. En attente de validation par l'admin.",
      );
      navigate({ to: "/mes-reservations" });
    } catch (e) {
      console.error(e);
      setUploadFailed(true);
      toast.error("Échec de l'envoi. Vous pouvez utiliser WhatsApp en secours.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!reservation) return null;

  const walletAmount = Math.max(
    reservation.total_amount - reservation.paid_amount - (reservation.coins_used ?? 0),
    0,
  );

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 space-y-6 pb-24">
      <Link to="/mes-reservations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à mes réservations
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Paiement</h1>
        <p className="text-sm text-muted-foreground">Réservation #{reservation.id.slice(0, 8).toUpperCase()}</p>
      </div>

      {reservation.service_type === "VTC" && isNightHoursNow() && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold text-amber-700">💵 Heures de nuit (22h → 06h)</p>
          <p className="mt-1 text-xs text-amber-700/80">
            Pour les courses VTC entre 22h et 06h, le paiement se fait <strong>en espèces directement au chauffeur</strong> à l'arrivée.
          </p>
        </div>
      )}

      {/* Récap montant */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total à payer</span>
            <span className="font-semibold">{formatXAF(reservation.total_amount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Déjà payé</span>
            <span>{formatXAF(reservation.paid_amount)}</span>
          </div>
          {(reservation.coins_used ?? 0) > 0 && (
            <div className="flex justify-between text-sm text-primary">
              <span>Réduction Wina Coins déjà appliquée</span>
              <span>−{formatXAF(reservation.coins_used)}</span>
            </div>
          )}
          {(reservation.coins_used ?? 0) === 0 && channel !== "wallet" && (
            <UseCoinsToggle
              balance={coinsBalance}
              total={Math.max(reservation.total_amount - reservation.paid_amount - 1, 0)}
              enabled={coinsEnabled}
              amount={coinsAmount}
              onToggle={(v) => {
                setCoinsEnabled(v);
                if (!v) setCoinsAmount(0);
              }}
              onAmountChange={setCoinsAmount}
            />
          )}
          {coinsEnabled && coinsAmount > 0 && (
            <div className="flex justify-between text-sm text-primary">
              <span>Réduction Wina Coins</span>
              <span>−{formatXAF(coinsAmount)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Étape 1 — choix du moyen de paiement */}
      {channel === null ? (
        <PaymentMethodSelector
          allowed={isVtc ? ["wallet"] : ["bank_transfer", "cash", "wallet"]}
          note={
            isVtc
              ? "Pour les courses VTC, le règlement se fait exclusivement depuis le portefeuille WINA TOUR."
              : `Montant restant dû : ${formatXAF(amount)}`
          }
          onContinue={setChannel}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setChannel(null)}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Changer de moyen de paiement ({PAYMENT_CHANNEL_LABEL[channel]})
          </button>

          {/* Portefeuille */}
          {channel === "wallet" && (
            <Card className="border-green-500/40 bg-green-500/5">
              <CardContent className="p-5 space-y-3">
                <div>
                  <p className="text-sm font-bold">👛 Portefeuille WINA TOUR</p>
                  <p className="text-xs text-muted-foreground">
                    Réservation confirmée immédiatement après débit du solde.
                  </p>
                </div>
                <WalletCheckout
                  purpose="reservation"
                  relatedId={reservation.id}
                  amount={walletAmount}
                  onSuccess={() =>
                    ((reservation.details as any)?.train_booking || (reservation.details as any)?.mode === "bateau")
                      ? navigate({ to: "/billets/confirmation/$reservationId", params: { reservationId: reservation.id } })
                      : navigate({ to: "/mes-reservations" })
                  }
                />
              </CardContent>
            </Card>
          )}

          {/* Virement bancaire & espèces */}
          {(channel === "bank_transfer" || channel === "cash") && (
            <>
              {/* Montant du versement */}
              <Card>
                <CardContent className="p-5">
                  <Label htmlFor="amount" className="text-xs">Montant de ce versement (FCFA)</Label>
                  <NumberInput
                    id="amount"
                    value={amount}
                    onChange={setAmount}
                    min={0}
                    placeholder="0"
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-lg font-bold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Montant total requis pour confirmer la réservation
                  </p>
                </CardContent>
              </Card>

              {/* Référence transaction */}
              <Card className="border-success/40 bg-success/5">
                <CardContent className="p-5 space-y-3">
                  <p className="text-xs font-bold uppercase text-success">Votre référence de transaction</p>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-background border-2 border-dashed border-success/40 p-4">
                    <span className="font-mono text-2xl font-bold tracking-widest">{shortRef}</span>
                    <Button size="sm" variant="ghost" onClick={() => copy(shortRef, "Référence")}>
                      <Copy className="h-4 w-4 mr-1" /> Copier
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Indiquez cette référence lors du paiement pour qu'on retrouve votre versement.
                  </p>
                </CardContent>
              </Card>

              {channel === "bank_transfer" && (
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h2 className="flex items-center gap-2 text-lg font-bold">
                      <Landmark className="h-5 w-5 text-primary" /> Virement bancaire
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Effectuez votre virement avec les coordonnées suivantes :
                    </p>
                    <BankTransferDetails />
                    <p className="text-sm text-muted-foreground">
                      Motif du virement : <strong>{shortRef}</strong> · Montant : <strong>{formatXAF(amount)}</strong>
                    </p>
                    <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
                      <span>
                        <strong>Justificatif obligatoire.</strong> Votre paiement reste
                        « En attente de validation du virement » jusqu'à vérification par l'administration.
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isCash && (
                <>
                  <AgencyCashInfo />
                  <Card>
                    <CardContent className="p-5 space-y-3">
                      <h3 className="flex items-center gap-2 font-semibold">
                        <Banknote className="h-4 w-4 text-primary" /> Comment ça se passe
                      </h3>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                        <li>Validez ci-dessous : votre réservation passe en « Paiement en agence en attente ».</li>
                        <li>Rendez-vous à l'agence avec la référence <strong>{shortRef}</strong>.</li>
                        <li>Réglez <strong>{formatXAF(amount)}</strong> en espèces auprès de l'agent.</li>
                        <li>L'agent confirme le paiement : votre réservation et votre billet sont validés.</li>
                      </ol>
                      <p className="text-xs text-muted-foreground">
                        Aucun justificatif ne vous est demandé pour le paiement en espèces.
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Justificatif — virement uniquement */}
              {channel === "bank_transfer" && (
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <Label className="font-semibold">📸 Justificatif de virement</Label>

                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={onFileChange}
                      className="hidden"
                    />
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*,.heic,.heif"
                      onChange={onFileChange}
                      className="hidden"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12"
                        disabled={preparing || submitting}
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera className="h-4 w-4 mr-2" /> Photo directe
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12"
                        disabled={preparing || submitting}
                        onClick={() => galleryInputRef.current?.click()}
                      >
                        <ImageIcon className="h-4 w-4 mr-2" /> Galerie
                      </Button>
                    </div>

                    {preparing && (
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Préparation de l'image (HEIC → JPEG, compression)…
                      </div>
                    )}

                    {receiptPreview && (
                      <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-success/40 bg-success/5 p-4">
                        <img loading="lazy" decoding="async" src={receiptPreview} alt="Justificatif de virement" className="max-h-48 rounded shadow" />
                        <span className="text-xs text-muted-foreground">
                          {receiptFile ? `${(receiptFile.size / 1024).toFixed(0)} Ko — prêt à envoyer` : ""}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Button
                size="lg"
                className="w-full"
                onClick={handleSubmit}
                disabled={submitting || preparing || (channel === "bank_transfer" && !receiptFile) || amount <= 0}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi…</>
                ) : isCash ? (
                  <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmer — je règle en agence</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-2" /> Soumettre le virement pour validation</>
                )}
              </Button>

              {/* Fallback WhatsApp si l'upload a échoué (iOS PWA) */}
              {channel === "bank_transfer" && whatsappEnabled && (uploadFailed || !receiptFile) && whatsappNumber && (
                <Card className="border-success/40 bg-success/5">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start gap-2 text-xs">
                      <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>
                        <strong>Problème pour envoyer la photo ?</strong> Envoyez-la sur WhatsApp à l'admin avec votre référence.
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-success/50 text-success hover:bg-success/10"
                      onClick={openWhatsappFallback}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" /> Envoyer la preuve via WhatsApp
                    </Button>
                  </CardContent>
                </Card>
              )}

              <p className="text-center text-xs text-muted-foreground">
                {isCash
                  ? "Statut : Paiement en agence en attente — confirmé par un agent WINA TOUR après encaissement."
                  : "Statut : En attente de validation du virement — l'admin vérifie le justificatif et la référence."}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
