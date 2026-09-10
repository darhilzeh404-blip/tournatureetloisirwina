import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PAYMENT_CHANNEL_LABEL } from '@/lib/payment-methods';
import { mypvitRequest, type MyPvitTransaction } from '@/lib/mypvit';
import { formatXAF } from '@/lib/vtc-wallet';

interface Props {
  purpose: 'reservation' | 'wallet_recharge';
  reservationId?: string;
  channel: 'airtel_money' | 'moov_money';
  amount: number;
  beforeStart?: () => Promise<void>;
  onLockChange?: (locked: boolean) => void;
  onSuccess: () => void;
}

export function MyPvitCheckout({ purpose, reservationId, channel, amount, beforeStart, onLockChange, onSuccess }: Props) {
  const [phone, setPhone] = useState('');
  const [tx, setTx] = useState<MyPvitTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const successRef = useRef(onSuccess);
  successRef.current = onSuccess;
  const completed = useRef<string | null>(null);

  useEffect(() => {
    onLockChange?.(busy || tx?.status === 'PENDING');
    return () => onLockChange?.(false);
  }, [busy, tx?.status, onLockChange]);

  async function restore() {
    setLoading(true);
    setError('');
    try {
      setTx(await mypvitRequest({ action: 'current', purpose, reservationId }));
      setLoading(false);
    } catch (e) { setError((e as Error).message); }
  }

  useEffect(() => {
    let active = true;
    mypvitRequest({ action: 'current', purpose, reservationId }).then(result => {
      if (active) { setTx(result); setLoading(false); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [purpose, reservationId]);

  useEffect(() => {
    if (!tx || tx.status !== 'PENDING') return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await mypvitRequest({ action: 'status', id: tx.id });
        if (active && result) { setTx(result); setError(''); }
        if (result?.status !== 'PENDING') return;
      } catch (e) { if (active) setError((e as Error).message); }
      if (active) timer = setTimeout(poll, 12000);
    };
    timer = setTimeout(poll, 2000);
    return () => { active = false; clearTimeout(timer); };
  }, [tx?.id, tx?.status]);

  useEffect(() => {
    if (tx?.status === 'SUCCESS' && completed.current !== tx.id) {
      completed.current = tx.id;
      successRef.current();
    }
  }, [tx]);

  async function start() {
    if (submitting.current || loading || tx?.status === 'PENDING') return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      if (beforeStart) await beforeStart();
      const result = await mypvitRequest({ action: 'start', purpose, reservationId, channel, amount, phone, requestId: requestId.current });
      if (!result) throw new Error('Transaction introuvable.');
      setTx(result);
    } catch (e) { setError((e as Error).message); }
    finally { submitting.current = false; setBusy(false); }
  }

  return (
    <section className="space-y-4 border-y py-5" aria-label="Paiement Mobile Money">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Smartphone className="h-5 w-5 shrink-0" /> {PAYMENT_CHANNEL_LABEL[tx?.channel ?? channel]}
      </h2>
      <p className="text-xl font-bold">{formatXAF(tx?.amount ?? amount)}</p>
      {error && <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
      {loading ? (
        error ? <Button variant="outline" onClick={restore}><RefreshCw className="mr-2 h-4 w-4" />Réessayer</Button>
          : <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Vérification des paiements en cours...</p>
      ) : tx?.status === 'PENDING' ? (
        <div className="space-y-3" role="status" aria-live="polite">
          <p className="flex items-center gap-2 font-medium"><Loader2 className="h-4 w-4 animate-spin" />En attente de confirmation</p>
          <p className="text-sm text-muted-foreground">Validez la demande sur votre téléphone. Ne renvoyez pas de paiement pendant la vérification.</p>
          <p className="text-xs break-all">Référence : <span className="font-mono">{tx.reference}</span></p>
          <p className="text-xs text-muted-foreground">La confirmation peut prendre quelques minutes. Vous pouvez revenir sur cette page pour consulter le résultat.</p>
        </div>
      ) : tx?.status === 'SUCCESS' ? (
        <p role="status" className="flex items-center gap-2 text-green-700"><CheckCircle2 className="h-5 w-5" />Paiement confirmé</p>
      ) : tx?.status === 'FAILED' ? (
        <div className="space-y-3">
          <p role="status">Le paiement a échoué.</p>
          <Button variant="outline" onClick={() => { requestId.current = crypto.randomUUID(); setTx(null); }}><RefreshCw className="mr-2 h-4 w-4" />Nouvelle tentative</Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); void start(); }}>
          <div className="space-y-2">
            <Label htmlFor="mypvit-phone">Numéro {PAYMENT_CHANNEL_LABEL[channel]}</Label>
            <Input id="mypvit-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="077 12 34 56" value={phone}
              onChange={e => setPhone(e.target.value)} disabled={busy} required maxLength={23} />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !phone.trim() || amount <= 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}Payer {formatXAF(amount)}
          </Button>
          <p className="text-xs text-muted-foreground">Des frais opérateur peuvent s'ajouter au montant débité.</p>
        </form>
      )}
    </section>
  );
}
