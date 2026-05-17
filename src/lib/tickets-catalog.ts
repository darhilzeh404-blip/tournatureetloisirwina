export type TicketKind = "transport" | "event";

export interface TicketItem {
  id: string;
  kind: TicketKind;
  title: string;
  description: string;
  price: number; // FCFA per ticket
  date?: string; // ISO date or label
  location?: string;
}

export const TICKETS: TicketItem[] = [
  // Transport
  {
    id: "lbv-pog",
    kind: "transport",
    title: "Libreville → Port-Gentil",
    description: "Trajet bus climatisé, départ matinal.",
    price: 25000,
    date: "Tous les jours · 07h00",
    location: "Gare routière de Libreville",
  },
  {
    id: "lbv-oyem",
    kind: "transport",
    title: "Libreville → Oyem",
    description: "Liaison nord, bus 30 places.",
    price: 18000,
    date: "Lun · Mer · Ven · 06h30",
    location: "Gare routière de Libreville",
  },
  {
    id: "lbv-franceville",
    kind: "transport",
    title: "Libreville → Franceville",
    description: "Longue distance, arrêts intermédiaires.",
    price: 35000,
    date: "Mar · Jeu · Sam · 06h00",
    location: "Gare routière de Libreville",
  },
  // Events
  {
    id: "evt-festival-gabon",
    kind: "event",
    title: "Festival Gabao",
    description: "Festival musical international, scène principale.",
    price: 10000,
    date: "15 août 2026",
    location: "Esplanade du bord de mer, Libreville",
  },
  {
    id: "evt-pongara-tour",
    kind: "event",
    title: "Excursion Parc Pongara",
    description: "Journée découverte avec guide et déjeuner.",
    price: 45000,
    date: "Chaque samedi",
    location: "Embarcadère Michel Marine",
  },
  {
    id: "evt-concert-nouvel-an",
    kind: "event",
    title: "Concert Nouvel An",
    description: "Soirée live, DJ sets et feu d'artifice.",
    price: 15000,
    date: "31 décembre 2026",
    location: "Stade de l'Amitié",
  },
];

export function getTicket(id: string) {
  return TICKETS.find(t => t.id === id);
}
