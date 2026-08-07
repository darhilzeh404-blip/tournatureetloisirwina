import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Camera, CheckCircle2, Copy, Image as ImageIcon, Loader2,
  Smartphone, AlertCircle, Wallet, FileCheck, CreditCard, Landmark,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { prepareReceiptImage } from "@/lib/image-upload";
import { formatPoints, formatXAF, requestRecharge } from "@/lib/vtc-wallet";

const CODE_AGENT_MOOV = "TRANSPORT";
const CODE_AGENT_AIRTEL = "BGG94";
const BANK_NAME = "BGFI Bank Gabon";
const BANK_IBAN = "GA21 4000 1000 0000 1234 5678 901";
const CHEQUE_ORDRE = "AGENCE WINA TOUR";
const QUICK_AMOUNTS = [2000, 5000, 10000, 20000, 50000];

type Operator = "Moov Money" | "Airtel Money" | "Chèque" | "Carte Visa" | "Virement";

const PAYMENT_METHODS: { value: Operator; label: string; icon: typeof Smartphone }[] = [
  { value: "Airtel Money", label: "Airtel Money", icon: Smartphone },
  { value: "Moov Money", label: "Moov Money", icon: Smartphone },
  { value: "Chèque", label: "Chèque", icon: FileCheck },
  { value: "Carte Visa", label: "Carte Visa", icon: CreditCard },
  { value: "Virement", label: "Virement bancaire", icon: Landmark },
];

const RECHARGE_ENUM: Record<Operator, string> = {
  "Airtel Money": "airtel_money",
  "Moov Money": "moov_money",
  "Chèque": "other",
  "Carte Visa": "other",
  "Virement": "bank_transfer",
};

export const Route = createFileRoute("/wallet/recharger")({
  head: () => ({
    meta: [
      { title: "Recharger mon portefeuille — Wina" },
      { name: "description", content: "Recharge sécurisée du portefeuille Wina par Mobile Money (Moov / Airtel)." },
    ],
  }),
  component: WalletRechargePage,
});

function WalletRechargePage() {
  const { user, isLoading: authLoading } = useNavigateIfNoAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number>(5000);
  const [method, setMethod] = useState<Operator>("Moov Money");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Référence courte WLT + 8 caractères alphanumériques
  const shortRef = useMemo(() => {
    const raw = crypto.randomUUID().replace(/-/g, "").toUpperCase();
    return "WLT" + raw.slice(0, 8);
  }, []);

  const isMobileMoney = method === "Moov Money" || method === "Airtel Money";
  const codeAgent = method === "Moov Money" ? CODE_AGENT_MOOV : CODE_AGENT_AIRTEL;
  const ussdCode = method === "Moov Money" ? "*555#" : "*150*4#";

  const copy = (text: string, label: string) => {
    try { navigator.clipboard.writeText(text); toast.success(`${label} copié`); } catch { /* noop */ }
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
    if (!user) return;
    if (amount <= 0) { toast.error("Montant invalide"); return; }
    if (!receiptFile) { toast.error("Veuillez joindre la preuve de paiement"); return; }
    setSubmitting(true);
    try {
      const ext = (receiptFile.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/wallet-${shortRef}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-receipts")
        .upload(path, receiptFile, { upsert: false, contentType: receiptFile.type || "image/jpeg" });
      if (upErr) throw upErr;

      await requestRecharge({
        amountPoints: amount,
        method: RECHARGE_ENUM[method] as never,
        paymentReference: shortRef,
        agentCode: isMobileMoney ? codeAgent : method,
        proofUrl: path,
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
          Portefeuille Wina — utilisé pour tous vos achats et réservations dans l’application.
        </p>
      </div>

      {/* Montant */}
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
            Total à payer : <strong>{formatXAF(amount)}</strong>
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 py-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">choisissez votre moyen de paiement</span>
        <div className="h-px flex-1 bg-border" />
      </div>


      {/* Méthode */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <Label>Mode de paiement</Label>
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as Operator)} className="grid gap-3 sm:grid-cols-2">
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
        </CardContent>
      </Card>

      {/* Référence générée */}
      <Card className="border-success/40 bg-success/5">
        <CardContent className="p-5 space-y-3">
          <p className="text-xs font-bold uppercase text-success">Votre référence de recharge</p>
          <div className="flex items-center justify-between gap-2 rounded-lg bg-background border-2 border-dashed border-success/40 p-4">
            <span className="font-mono text-2xl font-bold tracking-widest">{shortRef}</span>
            <Button size="sm" variant="ghost" onClick={() => copy(shortRef, "Référence")}>
              <Copy className="h-4 w-4 mr-1" /> Copier
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Indiquez cette référence lors du paiement pour qu'on retrouve votre recharge.
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
                  <h3 className="font-semibold text-primary">Pour Moov Money</h3>
                  <ol className="space-y-2 text-sm list-decimal list-inside">
                    <li>Composez <CodeChip text={ussdCode} onCopy={() => copy(ussdCode, "Code USSD")} />.</li>
                    <li>Choisissez <strong>"Paiement de services"</strong>.</li>
                    <li>Sélectionnez <strong>"Code agent"</strong> ou <strong>"Marchand"</strong>.</li>
                    <li>Saisissez le code marchand : <CodeChip text={codeAgent} onCopy={() => copy(codeAgent, "Code marchand")} /></li>
                    <li>Saisissez la référence : <CodeChip text={shortRef} onCopy={() => copy(shortRef, "Référence")} /></li>
                    <li>Saisissez le montant : <CodeChip text={String(amount)} onCopy={() => copy(String(amount), "Montant")} /> FCFA exact.</li>
                    <li>Validez avec votre <strong>code PIN Moov Money</strong>.</li>
                    <li>📸 <strong>Prenez une photo du reçu ou du SMS de confirmation.</strong></li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-semibold text-primary">Pour Airtel Money</h3>
                  <ol className="space-y-2 text-sm list-decimal list-inside">
                    <li>Composez <CodeChip text={ussdCode} onCopy={() => copy(ussdCode, "Code USSD")} />.</li>
                    <li>Choisissez <strong>"Retrait par code"</strong> ou <strong>"Paiement"</strong>.</li>
                    <li>Saisissez le code agent : <CodeChip text={codeAgent} onCopy={() => copy(codeAgent, "Code agent")} /></li>
                    <li>Saisissez la référence : <CodeChip text={shortRef} onCopy={() => copy(shortRef, "Référence")} /></li>
                    <li>Saisissez le montant : <CodeChip text={String(amount)} onCopy={() => copy(String(amount), "Montant")} /> FCFA.</li>
                    <li>Validez avec votre <strong>code PIN Airtel</strong>.</li>
                    <li>📸 <strong>Prenez une photo du reçu ou du SMS de confirmation.</strong></li>
                  </ol>
                </div>
              )}

              <div className="rounded-lg bg-muted p-3 text-xs font-mono">
                {method === "Moov Money"
                  ? `Moov : ${ussdCode} → Code marchand ${codeAgent} → Référence ${shortRef} → Montant ${amount} → PIN`
                  : `Airtel : ${ussdCode} → Code agent ${codeAgent} → Référence ${shortRef} → Montant ${amount} → PIN`}
              </div>
            </>
          )}

          {method === "Chèque" && (
            <div className="space-y-3">
              <h2 className="font-bold text-lg">🧾 Paiement par chèque</h2>
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li>Libellez le chèque à l'ordre de <CodeChip text={CHEQUE_ORDRE} onCopy={() => copy(CHEQUE_ORDRE, "Ordre")} />.</li>
                <li>Inscrivez la référence <CodeChip text={shortRef} onCopy={() => copy(shortRef, "Référence")} /> au dos du chèque.</li>
                <li>Montant : <strong>{formatXAF(amount)}</strong>.</li>
                <li>Déposez le chèque à l'agence Wina Tour.</li>
                <li>📸 <strong>Photographiez le chèque (recto) ou le reçu de dépôt.</strong></li>
              </ol>
            </div>
          )}

          {method === "Carte Visa" && (
            <div className="space-y-3">
              <h2 className="font-bold text-lg">💳 Paiement par carte Visa</h2>
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li>Réglez <strong>{formatXAF(amount)}</strong> par carte Visa au comptoir Wina Tour ou via le TPE de l'agence.</li>
                <li>Communiquez la référence <CodeChip text={shortRef} onCopy={() => copy(shortRef, "Référence")} /> à l'agent.</li>
                <li>📸 <strong>Photographiez le ticket de carte bancaire.</strong></li>
              </ol>
            </div>
          )}

          {method === "Virement" && (
            <div className="space-y-3">
              <h2 className="font-bold text-lg">🏦 Paiement par virement bancaire</h2>
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li>Banque : <CodeChip text={BANK_NAME} onCopy={() => copy(BANK_NAME, "Banque")} /></li>
                <li>IBAN : <CodeChip text={BANK_IBAN} onCopy={() => copy(BANK_IBAN, "IBAN")} /></li>
                <li>Bénéficiaire : <CodeChip text={CHEQUE_ORDRE} onCopy={() => copy(CHEQUE_ORDRE, "Bénéficiaire")} /></li>
                <li>Motif du virement : <CodeChip text={shortRef} onCopy={() => copy(shortRef, "Référence")} /></li>
                <li>Montant : <strong>{formatXAF(amount)}</strong>.</li>
                <li>📸 <strong>Joignez l'avis de virement.</strong></li>
              </ol>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
            <AlertCircle className="h-4 w-4 text-warning-foreground shrink-0 mt-0.5" />
            <span><strong>Photo du justificatif obligatoire</strong> pour la validation de votre recharge par l'admin.</span>
          </div>
        </CardContent>
      </Card>


      {/* Preuve de paiement */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <Label className="font-semibold">📸 Preuve de paiement</Label>
          <p className="text-xs text-muted-foreground">
            Téléversez la photo du reçu ou la capture d'écran du SMS de confirmation.
            Formats acceptés : JPG, PNG, HEIC, HEIF. Taille max : 5 Mo.
          </p>

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
              <img loading="lazy" decoding="async" src={receiptPreview} alt="Reçu" className="max-h-48 rounded shadow" />
              <span className="text-xs text-muted-foreground">
                {receiptFile ? `${(receiptFile.size / 1024).toFixed(0)} Ko — prêt à envoyer` : ""}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={submitting || preparing || !receiptFile || amount <= 0}
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi…</>
        ) : (
          <><CheckCircle2 className="h-4 w-4 mr-2" /> Soumettre la recharge</>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Votre demande passera en statut <strong>"En attente"</strong>.
        Le solde sera crédité automatiquement après validation par un administrateur.
      </p>
    </div>
  );
}

function useNavigateIfNoAuth() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoading && !user) navigate({ to: "/connexion" });
  }, [user, isLoading, navigate]);
  return { user, isLoading };
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
