import { supabase } from "@/integrations/supabase/client";

export interface DriverWallet {
  balance_earnings: number;
  total_earned: number;
  total_commission_paid: number;
}

export interface DriverTx {
  id: string;
  created_at: string;
  gross_amount: number;
  net_amount: number;
  platform_fee: number;
  payment_method: string;
  trip_id: string | null;
  reservation_id: string | null;
  note: string | null;
  kind: string;
  reference: string | null;
}

export interface DriverWithdrawal {
  id: string;
  driver_id: string;
  amount: number;
  deposit_number: string;
  method: string;
  status: "pending" | "paid" | "rejected";
  admin_note: string | null;
  reference: string;
  created_at: string;
  processed_at: string | null;
}

export const fmtXAF = (n: number) =>
  new Intl.NumberFormat("fr-FR").format(Math.abs(n)) + " FCFA";

export const MIN_WITHDRAWAL = 1000;

export function normalizeDepositNumber(raw: string) {
  return raw.replace(/[^0-9+]/g, "");
}

export function isValidDepositNumber(raw: string) {
  return normalizeDepositNumber(raw).replace(/\D/g, "").length >= 8;
}

export async function fetchDriverWallet(driverId: string): Promise<DriverWallet> {
  const { data } = await supabase
    .from("driver_wallets")
    .select("balance_earnings, total_earned, total_commission_paid")
    .eq("driver_id", driverId)
    .maybeSingle();
  return (data as DriverWallet) ?? { balance_earnings: 0, total_earned: 0, total_commission_paid: 0 };
}

export async function fetchDriverTransactions(driverId: string, limit = 60): Promise<DriverTx[]> {
  const { data } = await supabase
    .from("driver_wallet_transactions")
    .select("id, created_at, gross_amount, net_amount, platform_fee, payment_method, trip_id, reservation_id, note, kind, reference")
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as DriverTx[];
}

export async function fetchDriverWithdrawals(driverId: string): Promise<DriverWithdrawal[]> {
  const { data } = await supabase
    .from("driver_withdrawals" as never)
    .select("*")
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as DriverWithdrawal[];
}

export async function fetchAllWithdrawals(status?: string): Promise<DriverWithdrawal[]> {
  let q = supabase
    .from("driver_withdrawals" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as DriverWithdrawal[];
}

export async function requestWithdrawal(args: {
  amount: number;
  depositNumber: string;
  method?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("request_driver_withdrawal" as never, {
    _amount: args.amount,
    _deposit_number: normalizeDepositNumber(args.depositNumber),
    _method: args.method ?? "mobile_money",
  } as never);
  if (error) throw error;
  return data as unknown as string;
}

export async function decideWithdrawal(id: string, approve: boolean, note?: string) {
  const { data, error } = await supabase.rpc("admin_decide_withdrawal" as never, {
    _withdrawal_id: id,
    _approve: approve,
    _note: note ?? null,
  } as never);
  if (error) throw error;
  return data;
}

export const WITHDRAWAL_STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  paid: "Payé",
  rejected: "Refusé",
};

export const WITHDRAWAL_METHOD_LABEL: Record<string, string> = {
  mobile_money: "Mobile Money",
  airtel_money: "Airtel Money",
  moov_money: "Moov Money",
  cash_agent: "Cash agent",
  bank_transfer: "Virement bancaire",
};
