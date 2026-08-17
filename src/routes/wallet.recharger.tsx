import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Camera, CheckCircle2, Copy, Image as ImageIcon, Loader2,
  AlertCircle, Wallet, Landmark,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { prepareReceiptImage } from "@/lib/image-upload";
import { formatPoints, formatXAF, requestRecharge } from "@/lib/vtc-wallet";
import { copyText } from "@/lib/clipboard";
import { PaymentMethodSelector } from "@/components/payment/PaymentMethodSelector";
import { BankTransferDetails } from "@/components/payment/BankTransferDetails";
import { AgencyCashInfo } from "@/components/payment/AgencyCashInfo";
import { MobileMoneyDetails } from "@/components/payment/MobileMoneyDetails";

import { CHANNEL_TO_RECHARGE_METHOD, PAYMENT_CHANNEL_LABEL, type PaymentChannel } from "@/lib/payment-methods";

const QUICK_AMOUNTS = [2000, 5000, 10000, 20000, 50000];

export const Route = createFileRoute("/wallet/recharger")({
  head: () => ({
    meta: [
      { title: "Recharger mon portefeuille — Wina" },
      {
        name: "description",
        content: "Rechargez votre portefeuille WINA TOUR par virement bancaire AFG ou en espèces à l'agence.",
      },
    ],
  }),
  component: WalletRechargePage,
});

function WalletRechargePage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number>(5000);
  const [channel, setChannel] = useState<PaymentChannel | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/connexion" });
  }, [authLoading, user, navigate]);

  // Référence courte WLT + 8 caractères alphanumériques
  const shortRef = useMemo(() => {
    const raw = crypto.randomUUID().replace(/-/g, "").toUpperCase();
    return "WLT" + raw.slice(0, 8);
  }, []);

  const isCash = channel === "cash";
  const isMobileMoney = channel === "airtel_money" || channel === "moov_money";
  const needsProof = channel === "bank_transfer" || isMobileMoney;


  const copy = async (text: string, label: string) => {
    const ok = await copyText(text);
    if (ok) toast.success(`${label} copié`);
    else toast.error("Copie impossible — sélectionnez le texte manuellement");
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPreparing(true);
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
      console.error("[recharge onFileChange]", err);
      toast.error("Impossible de lire cette photo. Essayez une autre.");
    } finally {
      setPreparing(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !channel || channel === "wallet" || channel === "card") return;
    if (amount <= 0) { toast.error("Montant invalide"); return; }
    if (!receiptFile && !isCash) { toast.error("Veuillez joindre le justificatif du virement"); return; }
    setSubmitting(true);
    try {
      let path: string | null = null;
      if (receiptFile) {
        const ext = (receiptFile.name.split(".").pop() || "jpg").toLowerCase();
        path = `${user.id}/wallet-${shortRef}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("payment-receipts")
          .upload(path, receiptFile, { upsert: false, contentType: receiptFile.type || "image/jpeg" });
        if (upErr) throw upErr;
      }

      await requestRecharge({
        amountPoints: amount,
        method: CHANNEL_TO_RECHARGE_METHOD[channel] as never,
        paymentReference: shortRef,
        agentCode: PAYMENT_CHANNEL_LABEL[channel],
        proofUrl: path ?? undefined,
      });
      toast.success("Demande envoyée — en attente de validation administrateur.");
      navigate({ to: "/wallet" });
    } catch (e: unknown) {
      console.error("[recharge submit]", e);
      const msg = e instanceof Error ? e.message : "Erreur lors de l'envoi";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 space-y-6 pb-24">
      <Link to="/wallet" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour au portefeuille
      </Link>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" /> Recharger mon portefeuille
        </h1>
        <p className="text-sm text-muted-foreground">
          Portefeuille WINA TOUR — utilisé pour tous vos achats et réservations dans l'application.
        </p>
      </div>

      {/* Étape 1 — Montant */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 space-y-3">
          <Label htmlFor="amount" className="text-xs">Montant à recharger (1 point = 1 FCFA)</Label>
          <NumberInput
            id="amount"
            value={amount}
            onChange={(v) => setAmount(Number(v) || 0)}
            min={500}
            className="mt-1 flex h-12 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xl font-bold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  amount === a ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
                }`}
              >
                {formatPoints(a)} FCFA
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Crédit du portefeuille : {formatXAF(amount)} après validation administrateur.
          </p>
        </CardContent>
      </Card>

      {/* Étape 2 — Moyen de paiement */}
      {channel === null ? (
        <PaymentMethodSelector
          hideWallet
          note="Choisissez comment vous réglez cette recharge."
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

          {/* Référence */}
          <Card className="border-success/40 bg-success/5">
            <CardContent className="p-5 space-y-3">
              <p className="text-xs font-bold uppercase text-success">Votre référence de recharge</p>
              <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-dashed border-success/40 bg-background p-4">
                <span className="font-mono text-xl font-bold tracking-widest">{shortRef}</span>
                <Button size="sm" variant="ghost" onClick={() => copy(shortRef, "Référence")}>
                  <Copy className="h-4 w-4 mr-1" /> Copier
                </Button>
              </div>
            </CardContent>
          </Card>

          {channel === "bank_transfer" && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Landmark className="h-5 w-5 text-primary" /> Virement bancaire
                </h2>
                <BankTransferDetails />
                <p className="text-sm text-muted-foreground">
                  Motif : <strong>{shortRef}</strong> · Montant : <strong>{formatXAF(amount)}</strong>
                </p>
                <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Le portefeuille est crédité uniquement après validation du virement par l'administration.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {isCash && (
            <AgencyCashInfo intro="Rendez-vous à l'agence WINA TOUR pour déposer le montant de votre recharge en espèces. Votre portefeuille est crédité après encaissement." />
          )}

          {isMobileMoney && (
            <MobileMoneyDetails channel={channel as "airtel_money" | "moov_money"} amount={amount} />
          )}

          {/* Justificatif — virement & mobile money */}
          {needsProof && (

            <Card>
              <CardContent className="p-5 space-y-4">
                <Label className="font-semibold">📸 Justificatif de virement</Label>

                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={onFileChange} className="hidden" />
                <input ref={galleryInputRef} type="file" accept="image/*,.heic,.heif" onChange={onFileChange} className="hidden" />

                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="h-12" disabled={preparing || submitting} onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="h-4 w-4 mr-2" /> Photo directe
                  </Button>
                  <Button type="button" variant="outline" className="h-12" disabled={preparing || submitting} onClick={() => galleryInputRef.current?.click()}>
                    <ImageIcon className="h-4 w-4 mr-2" /> Galerie
                  </Button>
                </div>

                {preparing && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Préparation de l'image…
                  </div>
                )}

                {receiptPreview && (
                  <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-success/40 bg-success/5 p-4">
                    <img loading="lazy" decoding="async" src={receiptPreview} alt="Justificatif de recharge" className="max-h-48 rounded shadow" />
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
            disabled={submitting || preparing || amount <= 0 || (channel === "bank_transfer" && !receiptFile)}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi…</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 mr-2" /> Envoyer ma demande de recharge</>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Statut : en attente de validation administrateur — le solde est crédité une fois le paiement vérifié.
          </p>
        </>
      )}
    </div>
  );
}
