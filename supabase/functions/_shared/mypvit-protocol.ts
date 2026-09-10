export type MobileChannel = "airtel_money" | "moov_money";
export interface Transaction {
  id: string;
  user_id: string;
  reference: string;
  purpose: "reservation" | "wallet_recharge";
  reservation_id: string | null;
  amount: number;
  channel: MobileChannel;
  phone: string;
  account_code: string;
  operator_code: string;
  provider_id: string | null;
  status: "PENDING" | "SUCCESS" | "FAILED";
  submitted_at: string | null;
  checked_at: string | null;
  created_at: string;
}

export function normalizePhone(value: unknown): string {
  if (typeof value !== "string" || !/^[+\d\s()-]+$/.test(value)) {
    throw new Error("INVALID_PHONE");
  }
  let phone = value.replace(/[\s()-]/g, "").replace(/^(\+|00)?241/, "");
  if (/^[67]\d{7}$/.test(phone)) phone = `0${phone}`;
  if (!/^0[67]\d{7}$/.test(phone)) throw new Error("INVALID_PHONE");
  return phone;
}

export function verifiedStatus(body: Record<string, unknown>, tx: Transaction) {
  if (
    body.merchant_reference_id !== tx.reference ||
    body.merchant_operation_account_code !== tx.account_code ||
    typeof body.amount !== "number" || body.amount !== tx.amount ||
    body.operator !== tx.operator_code ||
    normalizePhone(body.customer_account_number) !== tx.phone
  ) throw new Error("PROVIDER_MISMATCH");
  if (
    !["PENDING", "SUCCESS", "FAILED", "AMBIGUOUS"].includes(String(body.status))
  ) throw new Error("INVALID_STATUS");
  return body.status === "SUCCESS" || body.status === "FAILED"
    ? body.status
    : "PENDING";
}

export function publicTransaction(tx: Transaction) {
  return {
    id: tx.id,
    reference: tx.reference,
    status: tx.status,
    amount: tx.amount,
    channel: tx.channel,
    created_at: tx.created_at,
  };
}

export function paymentPayload(
  tx: Transaction,
  config: { callback: string; owner: string; operatorOwner: string },
) {
  return {
    amount: tx.amount,
    reference: tx.reference,
    service: "RESTFUL",
    customer_account_number: tx.phone,
    merchant_operation_account_code: tx.account_code,
    transaction_type: "PAYMENT",
    owner_charge: config.owner,
    owner_charge_operator: config.operatorOwner,
    operator_code: tx.operator_code,
    callback_url_code: config.callback,
    product: tx.purpose === "reservation" ? "RESERVATION" : "WALLET",
  };
}
