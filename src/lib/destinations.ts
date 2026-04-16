import pongaraImg from "@/assets/destinations/pongara.jpg";
import capImg from "@/assets/destinations/cap-caravane.jpg";
import mondahImg from "@/assets/destinations/mondah.jpg";
import ndzessiImg from "@/assets/destinations/ndzessi.jpg";
import rapondaImg from "@/assets/destinations/raponda-walker.jpg";

export interface Destination {
  id: string;
  name: string;
  price: number; // FCFA per person per day
  image: string;
  description: string;
  tags: string[];
}

export const DESTINATIONS: Destination[] = [
  { id: "pongara", name: "Pongara", price: 40_000, image: pongaraImg, description: "Plages paradisiaques et tortues marines", tags: ["plage", "nature"] },
  { id: "cap-caravane", name: "Cap Caravane", price: 35_000, image: capImg, description: "Resort balnéaire et détente tropicale", tags: ["plage", "détente"] },
  { id: "mondah", name: "Baie de la Mondah", price: 20_000, image: mondahImg, description: "Mangroves, pêche et sérénité", tags: ["nature", "pêche"] },
  { id: "ndzessi", name: "Ndzessi Village", price: 40_000, image: ndzessiImg, description: "Immersion culturelle en forêt tropicale", tags: ["culture", "forêt"] },
  { id: "raponda-walker", name: "Raponda Walker", price: 10_000, image: rapondaImg, description: "Arboretum botanique et randonnée", tags: ["randonnée", "nature"] },
];

export const ACTIVITIES = [
  { id: "excursion", label: "Excursions", icon: "🏞️" },
  { id: "randonnee", label: "Randonnées", icon: "🥾" },
  { id: "peche", label: "Pêche", icon: "🎣" },
  { id: "agriculture", label: "Agriculture", icon: "🌱" },
  { id: "gastronomie", label: "Gastronomie", icon: "🍽️" },
  { id: "scolaire", label: "Sorties scolaires", icon: "📚" },
  { id: "cuisine", label: "Ateliers culinaires", icon: "👨‍🍳" },
];

export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}
