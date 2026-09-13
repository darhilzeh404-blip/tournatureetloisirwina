import { supabase } from '@/integrations/supabase/client';

export interface MyPvitTransaction {
  id: string;
  reference: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  amount: number;
  channel: 'airtel_money' | 'moov_money';
  created_at: string;
}

export async function mypvitRequest(body: Record<string, unknown>): Promise<MyPvitTransaction | null> {
  const { data, error } = await supabase.functions.invoke('mypvit-payment', { body });
  if (error) {
    let message = 'Paiement indisponible. Vérifiez votre connexion et réessayez.';
    if ('context' in error && error.context instanceof Response) {
      try {
        const payload = await error.context.json();
        // The Edge Function only returns a safe error and diagnostic code here;
        // never log request headers or payment credentials in the browser.
        console.error('[MyPVIT] Edge Function response', payload);
        if (typeof payload.error === 'string') message = payload.error;
      } catch { /* Keep the connection error for non-JSON gateway responses. */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  if (!data || !('transaction' in data)) throw new Error('Réponse de paiement invalide.');
  return data.transaction;
}
