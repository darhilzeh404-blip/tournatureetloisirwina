import type { VehicleCategory } from "@/lib/vtc-zones";

export type CatMeta = {
  id: VehicleCategory;
  title: string;
  subtitle: string;
  models: string[];
  usage: string;
  icon: string;
};

export const CATEGORIES: CatMeta[] = [
  {
    id: "standard",
    title: "VTC Standard",
    subtitle: "Citadines & Compactes",
    models: ["Toyota Yaris", "Toyota Starlet", "Suzuki Swift", "Suzuki Baleno", "Kia Picanto", "Kia Morning"],
    usage: "Courses urbaines rapides et trajets express.",
    icon: "/icons/standard-3d.png",
  },
  {
    id: "confort",
    title: "VTC Confort",
    subtitle: "Berlines & Familiales",
    models: ["Toyota Corolla", "Hyundai Sonata", "Hyundai Advance", "Hyundai i30", "Hyundai i40", "Kia K3", "Kia K5"],
    usage: "Trajets plus longs et confort accru. (+30 % vs Standard)",
    icon: "/icons/confort-3d.png",
  },
  {
    id: "vip",
    title: "VTC VIP",
    subtitle: "Luxe & Prestige",
    models: ["Kia K7", "Berlines de haut standing"],
    usage: "Mariages, événements VIP, clientèle d'affaires.",
    icon: "/icons/vip-3d.png",
  },
];

export const getCategory = (id: VehicleCategory) =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

/** Course de nuit : 21h → 06h (paiement portefeuille uniquement, plus d'espèces). */
export function isNightRide(iso: string) {
  const h = new Date(iso).getHours();
  return h >= 21 || h < 6;
}
