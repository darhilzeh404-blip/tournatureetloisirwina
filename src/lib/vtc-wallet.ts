import { supabase } from "@/integrations/supabase/client";

export interface VtcWallet {
  user_id: string;
  balance_points: number;
  total_recharged: number;
  total_spent: number;
}

export interface VtcWalletTx {
  id: string;
  user_id: string;
  type: "recharge" | "trip_payment" | "refund" | "admin_adjust";
  amount_points: number;
  balance_after: number;
  reference_code: string | null;
  related_type: string | null;
  related_id: string | null;
  note: string | null;
  created_at: string;
}

export interface VtcRechargeRequest {
  id: string;
  user_id: string;
  amount_points: number;
  amount_fcfa: number;
  payment_method: "mobile_money" | "cash_agent" | "bank_transfer" | "other" | "airtel_money" | "moov_money";
  payment_reference: string | null;
  agent_code: string | null;
  proof_url: string | null;
  status: "pending" | "approved" | "rejected";
  validated_by: string | null;
  validated_at: string | null;
  admin_note: string | null;
  client_note: string | null;
  created_at: string;
}

export const POINT_TO_FCFA = 1; // 1 point = 1 FCFA
export const PLATFORM_COMMISSION_PCT = 20;

export function formatPoints(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

export function formatXAF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

export async function fetchVtcWallet(userId: string): Promise<VtcWallet> {
  const { data } = await supabase
    .from("vtc_wallets" as never)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as unknown as VtcWallet;
  return { user_id: userId, balance_points: 0, total_recharged: 0, total_spent: 0 };
}

export async function fetchVtcTransactions(userId: string, limit = 50): Promise<VtcWalletTx[]> {
  const { data } = await supabase
    .from("vtc_wallet_transactions" as never)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as VtcWalletTx[];
}

export async function fetchVtcRecharges(userId: string): Promise<VtcRechargeRequest[]> {
  const { data } = await supabase
    .from("vtc_recharge_requests" as never)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as VtcRechargeRequest[];
}

export async function requestRecharge(args: {
  amountPoints: number;
  method: VtcRechargeRequest["payment_method"];
  paymentReference: string;
  agentCode: string;
  proofUrl?: string;
  clientNote?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("request_vtc_recharge" as never, {
    _amount_points: args.amountPoints,
    _payment_method: args.method,
    _payment_reference: args.paymentReference,
    _agent_code: args.agentCode,
    _proof_url: args.proofUrl ?? null,
    _client_note: args.clientNote ?? null,
  } as never);
  if (error) throw error;
  return data as unknown as string;
}

export async function spendVtcPoints(args: {
  amount: number;
  relatedType: string;
  relatedId: string;
  note?: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc("spend_vtc_points" as never, {
    _amount: args.amount,
    _related_type: args.relatedType,
    _related_id: args.relatedId,
    _note: args.note ?? null,
  } as never);
  if (error) throw error;
  return data as unknown as number;
}

export async function adminValidateRecharge(requestId: string, approve: boolean, note?: string) {
  const { data, error } = await supabase.rpc("admin_validate_vtc_recharge" as never, {
    _request_id: requestId,
    _approve: approve,
    _note: note ?? null,
  } as never);
  if (error) throw error;
  return data;
}

export async function payReservationWithWallet(reservationId: string): Promise<{ new_balance: number; total_paid: number }> {
  const { data, error } = await supabase.rpc("pay_reservation_with_wallet" as never, {
    _reservation_id: reservationId,
  } as never);
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { new_balance?: number; total_paid?: number } | null;
  return { new_balance: Number(row?.new_balance ?? 0), total_paid: Number(row?.total_paid ?? 0) };
}

export async function completeVtcTrip(tripId: string): Promise<{ driver_net: number; driver_balance: number; paid_via_wallet: boolean }> {
  const { data, error } = await supabase.rpc("complete_vtc_trip" as never, {
    _trip_id: tripId,
  } as never);
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { driver_net?: number; driver_balance?: number; paid_via_wallet?: boolean }
    | null;
  return {
    driver_net: Number(row?.driver_net ?? 0),
    driver_balance: Number(row?.driver_balance ?? 0),
    paid_via_wallet: Boolean(row?.paid_via_wallet ?? false),
  };
}

export function walletErrorMessage(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  if (msg.includes("INSUFFICIENT_POINTS")) return "Solde VTC Points insuffisant. Rechargez votre portefeuille.";
  if (msg.includes("ALREADY_PAID")) return "Cette réservation est déjà payée.";
  if (msg.includes("NOT_AUTHENTICATED")) return "Session expirée, reconnectez-vous.";
  if (msg.includes("FORBIDDEN")) return "Action non autorisée.";
  return msg || "Erreur portefeuille";
}

export const RECHARGE_METHOD_LABEL: Record<VtcRechargeRequest["payment_method"], string> = {
  mobile_money: "Mobile Money",
  cash_agent: "Cash agent",
  bank_transfer: "Virement bancaire",
  other: "Autre",
};
