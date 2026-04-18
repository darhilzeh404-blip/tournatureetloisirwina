import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Smartphone, Camera, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

// Codes agents marchands (à personnaliser depuis l'admin plus tard)
const CODE_AGENT_MOOV = "074512";
const CODE_AGENT_AIRTEL = "074512";

export const Route = createFileRoute("/paiement/$reservationId")({
  head: () => ({
    meta: [
      { title: "Paiement — Agence Wina" },
      { name: "description", content: "Payez votre réservation par Mobile Money (Moov / Airtel)." },
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
  const [method, setMethod] = useState<"Moov Money" | "Airtel Money">("Moov Money");
  const [amount, setAmount] = useState<number>(0);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      const { data, error } = await supabase
        .from("reservations")
        .select("id, total_amount, paid_amount, status, user_id")
        .eq("id", reservationId)
        .maybeSingle();
      if (error || !data) {
        toast.error("Réservation introuvable");
        navigate({ to: "/mes-reservations" });
        return;
      }
      setReservation(data);
      // Acompte minimum 50%
      const minDeposit = Math.ceil(data.total_amount * 0.5);
      setAmount(Math.max(minDeposit - data.paid_amount, 0) || data.total_amount);
      setLoading(false);
    })();
  }, [authLoading, user, reservationId, navigate]);

  const codeAgent = method === "Moov Money" ? CODE_AGENT_MOOV : CODE_AGENT_AIRTEL;
  const ussdCode = method === "Moov Money" ? "*555#" : "*150*4#";

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La photo ne doit pas dépasser 5 Mo");
      return;
    }
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!user || !reservation) return;
    if (!receiptFile) {
      toast.error("Veuillez joindre la photo du reçu / SMS de confirmation");
      return;
    }
    if (amount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    setSubmitting(true);
    try {
      // Upload photo dans le bucket privé sous le dossier de l'utilisateur
      const ext = receiptFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${transactionUuid}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-receipts")
        .upload(path, receiptFile, { upsert: false, contentType: receiptFile.type });
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

      toast.success("Paiement soumis. En attente de validation par l'admin.");
      navigate({ to: "/mes-reservations" });
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la soumission. Réessayez.");
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
        <h1 className="text-2xl font-bold">Paiement Mobile Money</h1>
        <p className="text-sm text-muted-foreground">Réservation #{reservation.id.slice(0, 8).toUpperCase()}</p>
      </div>

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
          <div>
            <Label htmlFor="amount" className="text-xs">Montant de ce versement (FCFA)</Label>
            <Input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1 text-lg font-bold"
            />
            <p className="text-xs text-muted-foreground mt-1">Acompte minimum : 50% du total</p>
          </div>
        </CardContent>
      </Card>

      {/* Choix méthode */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <Label>Méthode de paiement</Label>
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as typeof method)} className="grid grid-cols-2 gap-3">
            <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${method === "Moov Money" ? "border-primary bg-primary/5" : ""}`}>
              <RadioGroupItem value="Moov Money" />
              <Smartphone className="h-4 w-4" />
              <span className="font-medium">Moov Money</span>
            </label>
            <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${method === "Airtel Money" ? "border-primary bg-primary/5" : ""}`}>
              <RadioGroupItem value="Airtel Money" />
              <Smartphone className="h-4 w-4" />
              <span className="font-medium">Airtel Money</span>
            </label>
          </RadioGroup>
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
            Saisissez cette référence lors du paiement USSD pour qu'on retrouve votre versement.
          </p>
        </CardContent>
      </Card>

      {/* Instructions USSD */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-lg">📱 PAYEZ DIRECT DEPUIS VOTRE TÉLÉPHONE</h2>

          {method === "Moov Money" ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-primary">Pour Moov Money</h3>
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li>Tapez <CodeChip text={ussdCode} onCopy={() => copy(ussdCode, "Code USSD")} /> sur votre téléphone.</li>
                <li>Choisissez <strong>"Paiement de services"</strong> ou <strong>"Transfert"</strong>.</li>
                <li>Sélectionnez <strong>"Code agent"</strong> ou <strong>"Marchand"</strong>.</li>
                <li>Saisissez le code agent entreprise : <CodeChip text={codeAgent} onCopy={() => copy(codeAgent, "Code agent")} /></li>
                <li>Entrez la référence : <CodeChip text={shortRef} onCopy={() => copy(shortRef, "Référence")} /></li>
                <li>Saisissez le montant : <CodeChip text={String(amount)} onCopy={() => copy(String(amount), "Montant")} /> FCFA exact.</li>
                <li>Confirmez avec votre <strong>PIN Moov Money</strong>.</li>
                <li>📸 <strong>Prenez une photo du reçu / SMS de confirmation.</strong></li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-primary">Pour Airtel Money</h3>
              <ol className="space-y-2 text-sm list-decimal list-inside">
                <li>Tapez <CodeChip text={ussdCode} onCopy={() => copy(ussdCode, "Code USSD")} /> (retrait/paiement par code).</li>
                <li>Choisissez <strong>"Retrait par code"</strong> ou paiement.</li>
                <li>Code agent : <CodeChip text={codeAgent} onCopy={() => copy(codeAgent, "Code agent")} /></li>
                <li>Référence : <CodeChip text={shortRef} onCopy={() => copy(shortRef, "Référence")} /></li>
                <li>Montant : <CodeChip text={String(amount)} onCopy={() => copy(String(amount), "Montant")} /> FCFA.</li>
                <li><strong>PIN Airtel</strong> → Confirmé !</li>
                <li>📸 <strong>Prenez une photo du reçu / SMS de confirmation.</strong></li>
              </ol>
            </div>
          )}

          <div className="rounded-lg bg-muted p-3 text-xs font-mono">
            {method === "Moov Money" ? "Moov" : "Airtel"}: {ussdCode} → Code agent {codeAgent} → Ref {shortRef} → Montant {amount} → PIN
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
            <AlertCircle className="h-4 w-4 text-warning-foreground shrink-0 mt-0.5" />
            <span><strong>Photo du reçu obligatoire</strong> pour la validation de votre paiement par l'admin.</span>
          </div>
        </CardContent>
      </Card>

      {/* Upload photo */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <Label htmlFor="receipt" className="font-semibold">📸 Photo du reçu / SMS de confirmation</Label>
          <input
            id="receipt"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange}
            className="hidden"
          />
          <label
            htmlFor="receipt"
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-muted/50 transition"
          >
            {receiptPreview ? (
              <>
                <img src={receiptPreview} alt="Reçu" className="max-h-48 rounded" />
                <span className="text-xs text-muted-foreground">Cliquez pour changer</span>
              </>
            ) : (
              <>
                <Camera className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">Prendre / choisir la photo</span>
                <span className="text-xs text-muted-foreground">JPG, PNG — max 5 Mo</span>
              </>
            )}
          </label>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={submitting || !receiptFile}
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi…</>
        ) : (
          <><CheckCircle2 className="h-4 w-4 mr-2" /> Soumettre le paiement pour validation</>
        )}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        Votre paiement passera en statut <strong>"En attente"</strong>. L'admin vérifiera la photo et la référence avant validation.
      </p>
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
