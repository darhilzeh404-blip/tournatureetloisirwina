export type FlightRequestStatus =
  | "pending"
  | "offer_sent"
  | "refused"
  | "accepted_pending_payment"
  | "paid"
  | "ticket_issued"
  | "completed"
  | "cancelled"
  | "expired";

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: "En attente de traitement",
  offer_sent: "Offre disponible",
  refused: "Refusée",
  accepted_pending_payment: "En attente de paiement",
  paid: "Paiement confirmé",
  ticket_issued: "Billet émis",
  completed: "Terminée",
  cancelled: "Annulée",
  expired: "Offre expirée",
};

export const REQUEST_STATUS_CLASS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  offer_sent: "bg-primary/10 text-primary",
  refused: "bg-destructive/10 text-destructive",
  accepted_pending_payment: "bg-amber-500/15 text-amber-600",
  paid: "bg-emerald-500/15 text-emerald-600",
  ticket_issued: "bg-emerald-500/15 text-emerald-600",
  completed: "bg-emerald-500/15 text-emerald-600",
  cancelled: "bg-destructive/10 text-destructive",
  expired: "bg-destructive/10 text-destructive",
};

export const PROGRAM_STATUS_LABEL: Record<string, string> = {
  available: "Disponible",
  suspended: "Suspendu",
  full: "Complet",
};

export const FCFA = (n: number | null | undefined) =>
  `${Math.round(Number(n ?? 0)).toLocaleString("fr-FR")} FCFA`;

export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("fr-FR", { dateStyle: "medium" }) : "—";

export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "—";

/** Un bébé (infant) a au maximum 2 ans et 6 mois. */
export const INFANT_MAX_MONTHS = 30;

export function isInfantAge(birthDate: string, reference = new Date()): boolean {
  if (!birthDate) return false;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return false;
  const months =
    (reference.getFullYear() - b.getFullYear()) * 12 +
    (reference.getMonth() - b.getMonth()) -
    (reference.getDate() < b.getDate() ? 1 : 0);
  return months >= 0 && months <= INFANT_MAX_MONTHS;
}
