import bus3d from "@/assets/icons/bus-3d.png";
import train3d from "@/assets/icons/train-3d.png";
import avion3d from "@/assets/icons/avion-3d.png";
import bateau3d from "@/assets/icons/bateau-3d.png";
import billeterie3d from "@/assets/icons/billeterie 3d.webp";

export type TicketCategorySlug =
  | "bus"
  | "train"
  | "avion"
  | "bateau"
  | "evenement";

const MAP: Record<string, { src: string; alt: string }> = {
  bus: {
    src: bus3d,
    alt: "Bus",
  },
  train: {
    src: train3d,
    alt: "Train",
  },
  avion: {
    src: avion3d,
    alt: "Avion",
  },
  bateau: {
    src: bateau3d,
    alt: "Bateau",
  },
  evenement: {
    src: billeterie3d,
    alt: "Événement",
  },
};

const FALLBACK = {
  src: billeterie3d,
  alt: "Billet",
};

export function TicketCategoryIcon({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
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