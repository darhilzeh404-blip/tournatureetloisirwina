import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Loader2, Smartphone, Camera, CheckCircle2, ArrowLeft, AlertCircle, Image as ImageIcon, MessageCircle, FileCheck, CreditCard, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { prepareReceiptImage, buildWhatsappLink } from "@/lib/image-upload";
import { UseCoinsToggle } from "@/components/wina-coins/UseCoinsToggle";
import { fetchBalance } from "@/lib/wina-coins";
import { isNightHoursNow, requestNotificationPermission, showAppNotification } from "@/lib/notifications";
import { WalletCheckout } from "@/components/WalletCheckout";

// Codes marchands / coordonnées de paiement (à personnaliser depuis l'admin plus tard)
const CODE_AGENT_MOOV = "TRANSPORT";
const CODE_AGENT_AIRTEL = "BGG94";
const BANK_ACCOUNT_NAME = "Agence Wina";
const BANK_NAME = "AFG";
const BANK_ACCOUNT_NUMBER = "10122312301";
const CHEQUE_ORDRE = "AGENCE WINA TOUR";

type PaymentMethod = "Airtel Money" | "Moov Money" | "Chèque" | "Carte Visa" | "Virement";

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: typeof Smartphone }[] = [
  { value: "Airtel Money", label: "Airtel Money", icon: Smartphone },
  { value: "Moov Money", label: "Moov Money", icon: Smartphone },
  { value: "Chèque", label: "Chèque", icon: FileCheck },
  { value: "Carte Visa", label: "Carte Visa", icon: CreditCard },
  { value: "Virement", label: "Virement bancaire", icon: Landmark },
];



export const Route = createFileRoute("/paiement/$reservationId")({
  head: () => ({
    meta: [
      { title: "Paiement — Agence Wina" },
      { name: "description", content: "Payez votre réservation : portefeuille Wina, Airtel Money, Moov Money, chèque, carte Visa ou virement." },
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
  const [method, setMethod] = useState<PaymentMethod>("Airtel Money");
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

  const isMobileMoney = method === "Moov Money" || method === "Airtel Money";
  const isVtc = reservation?.service_type === "VTC";
  const codeAgent = method === "Moov Money" ? CODE_AGENT_MOOV : CODE_AGENT_AIRTEL;
  const ussdCode = method === "Moov Money" ? "*555#" : "*150*4#";

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
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
    const msg = `Bonjour, voici la preuve de mon paiement.\nRéservation: ${reservation?.id ?? ""}\nRéférence: ${shortRef}\nMontant: ${amount} FCFA\nMéthode: ${method}`;
    window.open(buildWhatsappLink(whatsappNumber, msg), "_blank");
  };


  const handleSubmit = async () => {
    if (!user || !reservation) return;
    if (!receiptFile) {
      toast.error("Veuillez joindre la photo du reçu / SMS de confirmation");
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
      const ext = (receiptFile.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${transactionUuid}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-receipts")
        .upload(path, receiptFile, { upsert: false, contentType: receiptFile.type || "image/jpeg" });
      if (upErr) throw upErr;

      // Insert paiement en attente
      const { error: payErr } = await supabase.from("payments").insert({
        reservation_id: reservation.id,
        user_id: user.id,
        amount,
        method,
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
      toast.success("Paiement soumis. En attente de validation par l'admin.");
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

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 space-y-6">
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
            Pour les courses VTC entre 22h et 06h, le paiement se fait <strong>en espèces directement au chauffeur</strong> à l'arrivée. Vous pouvez ignorer ce paiement Mobile Money si votre course est de nuit.
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
          {(reservation.coins_used ?? 0) === 0 && (
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
          <div>
            <Label htmlFor="amount" className="text-xs">Montant de ce versement (FCFA)</Label>
            <NumberInput
              id="amount"
              value={amount}
              onChange={setAmount}
              min={0}
              placeholder="0"
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-lg font-bold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">Montant total requis pour confirmer la réservation</p>
          </div>
        </CardContent>
      </Card>

      {/* Paiement par portefeuille Wina */}
      <Card className="border-green-500/40 bg-green-500/5">
        <CardContent className="p-5 space-y-3">
          <div>
            <p className="text-sm font-bold">💳 Paiement par portefeuille</p>
            <p className="text-xs text-muted-foreground">Réservation confirmée immédiatement après débit du solde.</p>
          </div>
          <WalletCheckout
            purpose="reservation"
            relatedId={reservation.id}
            amount={Math.max(reservation.total_amount - reservation.paid_amount - (reservation.coins_used ?? 0), 0)}
            onSuccess={() =>
              ((reservation.details as any)?.train_booking || (reservation.details as any)?.mode === "bateau")
                ? navigate({ to: "/billets/confirmation/$reservationId", params: { reservationId: reservation.id } })
                : navigate({ to: "/mes-reservations" })
            }
          />
        </CardContent>
      </Card>

      {isVtc ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-semibold">Portefeuille Wina uniquement</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pour les courses VTC, le paiement se fait exclusivement depuis votre portefeuille Wina.
            Rechargez-le si votre solde est insuffisant.
          </p>
        </div>
      ) : (
      <>
      <div className="flex items-center gap-3 py-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou choisissez un autre moyen de paiement</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Choix méthode */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <Label>Moyen de paiement</Label>
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} className="grid gap-3 sm:grid-cols-2">
            {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
              <label
                key={value}
                className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${method === value ? "border-primary bg-primary/5" : ""}`}
              >
                <RadioGroupItem value={value} />
                <Icon className="h-4 w-4" />
                <span className="font-medium">{label}</span>
              </label>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            Le portefeuille Wina (ci-dessus) reste le moyen le plus rapide : confirmation immédiate.
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

      {/* Instructions par moyen de paiement */}
      <Card>
        <CardContent className="p-5 space-y-4">
          {isMobileMoney && (
            <>
              <h2 className="font-bold text-lg">📱 PAYEZ DIRECT DEPUIS VOTRE TÉLÉPHONE</h2>
              {method === "Moov Money" ? (
                <div className="space-y-3">
                  <h3 className="font-semibold text-primary">Moov Money — code marchand</h3>
                  <ol className="space-y-2 text-sm list-decimal list-inside">
                    <li>Tapez <CodeChip text={ussdCode} onCopy={() => copy(ussdCode, "Code USSD")} /> sur votre téléphone.</li>
                    <li>Choisissez <strong>"Paiement de services"</strong> ou <strong>"Marchand"</strong>.</li>
                    <li>Saisissez le code marchand : <CodeChip text={codeAgent} onCopy={() => copy(codeAgent, "Code marchand")} /></li>
                    <li>Entrez la référence : <CodeChip text={shortRef} onCopy={() => copy(shortRef, "Référence")} /></li>
                    <li>Saisissez le montant : <CodeChip text={String(amount)} onCopy={() => copy(String(amount), "Montant")} /> FCFA exact.</li>
                    <li>Confirmez avec votre <strong>PIN Moov Money</strong>.</li>
                    <li>📸 <strong>Prenez une photo du reçu / SMS de confirmation.</strong></li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-semibold text-primary">Airtel Money — code marchand</h3>
                  <ol className="space-y-2 text-sm list-decimal list-inside">
                    <li>Tapez <CodeChip text={ussdCode} onCopy={() => copy(ussdCode, "Code USSD")} /> (paiement marchand).</li>
                    <li>Choisissez <strong>"Paiement marchand"</strong>.</li>
                    <li>Code marchand : <CodeChip text={codeAgent} onCopy={() => copy(codeAgent, "Code marchand")} /></li>
                    <li>Référence : <CodeChip text={shortRef} onCopy={() => copy(shortRef, "Référence")} /></li>
                    <li>Montant : <CodeChip text={String(amount)} onCopy={() => copy(String(amount), "Montant")} /> FCFA.</li>
                    <li><strong>PIN Airtel</strong> → Confirmé !</li>
                    <li>📸 <strong>Prenez une photo du reçu / SMS de confirmation.</strong></li>
                  </ol>
                </div>
              )}
              <div className="rounded-lg bg-muted p-3 text-xs font-mono">
                {method === "Moov Money" ? "Moov" : "Airtel"}: {ussdCode} → Code marchand {codeAgent} → Ref {shortRef} → Montant {amount} → PIN
              </div>
            </>
          )}

          {method === "Virement" && (
            <div className="space-y-3">
              <h2 className="font-bold text-lg">🏦 Virement bancaire</h2>
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li>Banque : <strong>{BANK_NAME}</strong></li>
                <li>Bénéficiaire : <CodeChip text={CHEQUE_ORDRE} onCopy={() => copy(CHEQUE_ORDRE, "Bénéficiaire")} /></li>
                <li>IBAN : <CodeChip text={BANK_IBAN} onCopy={() => copy(BANK_IBAN, "IBAN")} /></li>
                <li>Motif du virement : <CodeChip text={shortRef} onCopy={() => copy(shortRef, "Référence")} /></li>
                <li>Montant : <CodeChip text={String(amount)} onCopy={() => copy(String(amount), "Montant")} /> FCFA.</li>
                <li>📸 <strong>Photographiez l'avis de virement</strong> et joignez-le ci-dessous.</li>
              </ol>
            </div>
          )}

          {method === "Chèque" && (
            <div className="space-y-3">
              <h2 className="font-bold text-lg">🧾 Paiement par chèque</h2>
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li>Établissez le chèque à l'ordre de <CodeChip text={CHEQUE_ORDRE} onCopy={() => copy(CHEQUE_ORDRE, "Ordre")} /></li>
                <li>Inscrivez la référence <CodeChip text={shortRef} onCopy={() => copy(shortRef, "Référence")} /> au dos du chèque.</li>
                <li>Montant : <CodeChip text={String(amount)} onCopy={() => copy(String(amount), "Montant")} /> FCFA.</li>
                <li>Déposez le chèque à l'agence Wina Tour.</li>
                <li>📸 <strong>Photographiez le chèque / le reçu de dépôt</strong> et joignez-le ci-dessous.</li>
              </ol>
              <p className="text-xs text-muted-foreground">
                La réservation est confirmée après encaissement et validation par l'administrateur.
              </p>
            </div>
          )}

          {method === "Carte Visa" && (
            <div className="space-y-3">
              <h2 className="font-bold text-lg">💳 Carte Visa</h2>
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li>Réglez par carte Visa au guichet Wina Tour ou via le terminal de paiement de l'agence.</li>
                <li>Communiquez la référence <CodeChip text={shortRef} onCopy={() => copy(shortRef, "Référence")} /> à l'agent.</li>
                <li>Montant : <CodeChip text={String(amount)} onCopy={() => copy(String(amount), "Montant")} /> FCFA.</li>
                <li>📸 <strong>Photographiez le ticket de la carte</strong> et joignez-le ci-dessous.</li>
              </ol>
              <p className="text-xs text-muted-foreground">
                Aucune donnée de carte n'est saisie ni conservée dans l'application.
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
            <AlertCircle className="h-4 w-4 text-warning-foreground shrink-0 mt-0.5" />
            <span><strong>Photo du justificatif obligatoire</strong> pour la validation de votre paiement par l'admin.</span>
          </div>
        </CardContent>
      </Card>


      {/* Upload photo : 2 boutons (capture + galerie) */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <Label className="font-semibold">📸 Photo du reçu / SMS de confirmation</Label>

          {/* Inputs cachés — un par mode pour qu'iOS Safari respecte 'capture' */}
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
              <img loading="lazy" decoding="async" src={receiptPreview} alt="Reçu" className="max-h-48 rounded shadow" />
              <span className="text-xs text-muted-foreground">
                {receiptFile ? `${(receiptFile.size / 1024).toFixed(0)} Ko — prêt à envoyer` : ""}
              </span>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Auto-conversion HEIC (iPhone) → JPEG, compression sous 2 Mo.
          </p>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={submitting || preparing || !receiptFile}
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi…</>
        ) : (
          <><CheckCircle2 className="h-4 w-4 mr-2" /> Soumettre le paiement pour validation</>
        )}
      </Button>

      {/* Fallback WhatsApp si l'upload a échoué (iOS PWA) */}
      {whatsappEnabled && (uploadFailed || !receiptFile) && whatsappNumber && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start gap-2 text-xs">
              <MessageCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
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

      <p className="text-xs text-center text-muted-foreground">
        Votre paiement passera en statut <strong>"En attente"</strong>. L'admin vérifiera la photo et la référence avant validation.
      </p>
      </>
      )}
    </div>

  );
}

function CodeChip({ text, onCopy }: { text: string; onCopy: () => void }) {
  return (
    <button
      onClick={onCopy}
      className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-mono font-bold text-primary hover:bg-primary/20"
    >
      {text}
      <Copy className="h-3 w-3" />
    </button>
  );
}
