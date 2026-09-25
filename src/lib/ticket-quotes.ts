export type ManagedTicketType = "flight" | "train" | "boat";

export const TICKET_TYPE_META: Record<ManagedTicketType, { label: string; shortLabel: string; providerLabel: string }> = {
  flight: { label: "billet d’avion", shortLabel: "Avion", providerLabel: "Compagnie aérienne" },
  train: { label: "billet de train", shortLabel: "Train", providerLabel: "Compagnie ferroviaire" },
  boat: { label: "billet de bateau", shortLabel: "Bateau", providerLabel: "Compagnie maritime" },
};

export function isManagedTicketType(value: string): value is ManagedTicketType {
  return value === "flight" || value === "train" || value === "boat";
}

export function managedTypeFromCategory(slug: string): ManagedTicketType | null {
  if (slug === "avion" || slug === "flight") return "flight";
  if (slug === "train") return "train";
  if (slug === "bateau" || slug === "navire" || slug === "boat") return "boat";
  return null;
}

export const TICKET_STATUS_LABEL: Record<string, string> = {
  pending: "Demande envoyée",
  in_progress: "En cours de traitement",
  offer_sent: "Offre reçue",
  accepted_pending_payment: "En attente de paiement",
  refused: "Offre refusée",
  paid: "Payée — billet en préparation",
  ticket_issued: "Billet émis",
  cancelled: "Annulée",
  expired: "Offre expirée",
};

export const formatXaf = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
