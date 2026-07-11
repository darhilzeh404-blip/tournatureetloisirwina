// Icônes 3D réelles — pack open-source Microsoft Fluent Emoji (3D)
// servi via jsDelivr. Zéro dépendance npm, PNG haute résolution.

export type TicketCategorySlug = "bus" | "train" | "avion" | "bateau" | "evenement";

const CDN = "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets";

const MAP: Record<string, { src: string; alt: string }> = {
  bus:        { src: `${CDN}/Bus/3D/bus_3d.png`,                         alt: "Bus" },
  train:      { src: `${CDN}/Train/3D/train_3d.png`,                     alt: "Train" },
  avion:      { src: `${CDN}/Airplane/3D/airplane_3d.png`,               alt: "Avion" },
  bateau:     { src: `${CDN}/Ship/3D/ship_3d.png`,                       alt: "Bateau" },
  evenement:  { src: `${CDN}/Party%20popper/3D/party_popper_3d.png`,     alt: "Événement" },
};

const FALLBACK = { src: `${CDN}/Ticket/3D/ticket_3d.png`, alt: "Billet" };

export function TicketCategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const item = MAP[slug] ?? FALLBACK;
  return (
    <img
      src={item.src}
      alt={item.alt}
      loading="lazy"
      decoding="async"
      className={`object-contain ${className ?? ""}`}
      draggable={false}
    />
  );
}

export const CATEGORY_LABELS: Record<TicketCategorySlug, string> = {
  bus: "Bus",
  train: "Train",
  avion: "Avion",
  bateau: "Bateau / Ferry",
  evenement: "Événement",
};
