import { Bus, TrainFront, Plane, Ship, PartyPopper, Ticket, type LucideIcon } from "lucide-react";

export type TicketCategorySlug = "bus" | "train" | "avion" | "bateau" | "evenement";

const MAP: Record<string, LucideIcon> = {
  bus: Bus,
  train: TrainFront,
  avion: Plane,
  bateau: Ship,
  evenement: PartyPopper,
};

export function TicketCategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = MAP[slug] ?? Ticket;
  return <Icon className={className} />;
}

export const CATEGORY_LABELS: Record<TicketCategorySlug, string> = {
  bus: "Bus",
  train: "Train",
  avion: "Avion",
  bateau: "Bateau / Ferry",
  evenement: "Événement",
};
