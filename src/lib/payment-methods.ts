/**
 * Système de paiement WINA TOUR — constantes partagées.
 * Moyens de paiement disponibles : virement bancaire, espèces (en agence),
 * portefeuille Wina. La carte bancaire est temporairement indisponible.
 */

export type PaymentChannel = "bank_transfer" | "cash" | "wallet" | "card" | "airtel_money" | "moov_money";

export const PAYMENT_CHANNEL_LABEL: Record<PaymentChannel, string> = {
  bank_transfer: "Virement bancaire",
  cash: "Paiement en espèces",
  wallet: "Portefeuille WINA TOUR",
  card: "Carte bancaire",
  airtel_money: "Airtel Money",
  moov_money: "Moov Money",
};

/** Codes marchands officiels pour le mobile money. */
export const MERCHANT_CODES: Record<"airtel_money" | "moov_money", string> = {
  airtel_money: "BGG94",
  moov_money: "TRANSPORT",
};

/** Libellé de statut affiché selon le moyen de paiement retenu. */
export const PAYMENT_CHANNEL_PENDING_STATUS: Record<PaymentChannel, string> = {
  bank_transfer: "En attente de validation du virement",
  cash: "Paiement en agence en attente",
  wallet: "Payé",
  card: "Indisponible",
  airtel_money: "En attente de validation du paiement Airtel Money",
  moov_money: "En attente de validation du paiement Moov Money",
};


/** Coordonnées bancaires officielles WINA TOUR. */
export const BANK_DETAILS = {
  accountName: "Agence Wina",
  bankName: "AFG",
  accountNumber: "10122312301",
} as const;

/** Coordonnées de l'agence pour les règlements en espèces. */
export const AGENCY_INFO = {
  name: "AGENCE WINA TOUR",
  address: "2 Hôtel Akanda",
  phones: ["+241 77 11 09 95", "+241 62 76 65 49"],
  hours: "Ouvert à partir de 09h",
} as const;

export function agencyMapsUrl(): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${AGENCY_INFO.name} ${AGENCY_INFO.address}`,
  )}`;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

/** Correspondance vers l'enum de recharge du portefeuille (vtc_recharge_method). */
export const CHANNEL_TO_RECHARGE_METHOD: Record<
  Exclude<PaymentChannel, "wallet">,
  "bank_transfer" | "cash_agent" | "other" | "airtel_money" | "moov_money"
> = {
  bank_transfer: "bank_transfer",
  cash: "cash_agent",
  card: "other",
  airtel_money: "airtel_money",
  moov_money: "moov_money",

};
