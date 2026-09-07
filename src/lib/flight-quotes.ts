export type FlightRequestStatus =
  | "pending"
  | "in_progress"
  | "offer_sent"
  | "refused"
  | "accepted_pending_payment"
  | "paid"
  | "info_requested"
  | "documents_requested"
  | "processing"
  | "confirmed"
  | "ticket_issued"
  | "completed"
  | "cancelled"
  | "expired";

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: "Demande envoyée",
  in_progress: "Prise en charge",
  offer_sent: "Proposition disponible",
  refused: "Proposition refusée",
  accepted_pending_payment: "En attente de paiement",
  paid: "Paiement confirmé",
  info_requested: "Informations demandées",
  documents_requested: "Documents demandés",
  processing: "Traitement en cours",
  confirmed: "Réservation confirmée",
  ticket_issued: "Billet émis",
  completed: "Terminée",
  cancelled: "Annulée",
  expired: "Proposition expirée",
};

export const REQUEST_STATUS_CLASS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-sky-500/15 text-sky-600",
  offer_sent: "bg-primary/10 text-primary",
  refused: "bg-destructive/10 text-destructive",
  accepted_pending_payment: "bg-amber-500/15 text-amber-600",
  paid: "bg-emerald-500/15 text-emerald-600",
  info_requested: "bg-amber-500/15 text-amber-600",
  documents_requested: "bg-amber-500/15 text-amber-600",
  processing: "bg-sky-500/15 text-sky-600",
  confirmed: "bg-emerald-500/15 text-emerald-600",
  ticket_issued: "bg-emerald-500/15 text-emerald-600",
  completed: "bg-emerald-500/15 text-emerald-600",
  cancelled: "bg-destructive/10 text-destructive",
  expired: "bg-destructive/10 text-destructive",
};

/** Étapes visibles du parcours client (timeline). */
export const FLIGHT_TIMELINE: { key: string; label: string; matches: string[] }[] = [
  { key: "request", label: "Demande envoyée", matches: ["pending", "in_progress"] },
  { key: "offer", label: "Proposition reçue", matches: ["offer_sent", "refused", "expired"] },
  { key: "payment", label: "Paiement", matches: ["accepted_pending_payment", "paid"] },
  { key: "info", label: "Informations & documents", matches: ["info_requested", "documents_requested"] },
  { key: "processing", label: "Traitement", matches: ["processing"] },
  { key: "done", label: "Billet confirmé", matches: ["confirmed", "ticket_issued", "completed"] },
];

const ORDER = [
  "pending", "in_progress", "offer_sent", "refused", "expired",
  "accepted_pending_payment", "paid", "info_requested", "documents_requested",
  "processing", "confirmed", "ticket_issued", "completed",
];

/** Index de l'étape courante dans FLIGHT_TIMELINE (-1 si annulée/inconnue). */
export function timelineIndex(status: string): number {
  if (status === "cancelled") return -1;
  const rank = ORDER.indexOf(status);
  if (rank < 0) return 0;
  let idx = 0;
  FLIGHT_TIMELINE.forEach((step, i) => {
    if (step.matches.some((m) => ORDER.indexOf(m) <= rank)) idx = i;
  });
  return idx;
}

export const TRAVEL_CLASSES: { value: string; label: string }[] = [
  { value: "economy", label: "Économique" },
  { value: "premium_economy", label: "Économique premium" },
  { value: "business", label: "Affaires" },
  { value: "first", label: "Première" },
];

export const TRAVEL_CLASS_LABEL: Record<string, string> = Object.fromEntries(
  TRAVEL_CLASSES.map((c) => [c.value, c.label]),
);

export const DOC_STATUS_LABEL: Record<string, string> = {
  pending: "À téléverser",
  uploaded: "En vérification",
  approved: "Validé",
  rejected: "Refusé",
  to_replace: "À remplacer",
};

export const DOC_STATUS_CLASS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  uploaded: "bg-sky-500/15 text-sky-600",
  approved: "bg-emerald-500/15 text-emerald-600",
  rejected: "bg-destructive/10 text-destructive",
  to_replace: "bg-amber-500/15 text-amber-600",
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
