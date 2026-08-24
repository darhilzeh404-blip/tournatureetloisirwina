import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, ArrowRight, CarFront, Navigation, MapPin } from "lucide-react";
import { fetchOffersByType, type Offer } from "@/lib/fetch-offers.functions";
import { supabase } from "@/integrations/supabase/client";
import { BookingDialog, type BookingTarget } from "@/components/BookingDialog";
import { ClientNav } from "@/components/ClientNav";
import { formatFCFA } from "@/lib/destinations";
import circuitsImg from "@/assets/circuits-hero.jpg";
import { hdImg } from "@/lib/supabase-image";


type Circuit = {
  id: string;
  slug: string;
  nom: string;
  description: string;
  base_price: number;
  image_url: string | null;
};

/** Curated per-destination images (Unsplash, free) for unique visuals per circuit. */
const FALLBACK_IMAGES: Record<string, string> = {
  akanda: "https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=900&q=70&auto=format&fit=crop",
  pongara: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=900&q=70&auto=format&fit=crop",
  wonga: "https://images.unsplash.com/photo-1549366021-9f761d450615?w=900&q=70&auto=format&fit=crop",
  meyang: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=900&q=70&auto=format&fit=crop",
  chute: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=900&q=70&auto=format&fit=crop",
  cocobeach: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=70&auto=format&fit=crop",
  mondah: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=900&q=70&auto=format&fit=crop",
  arboretum: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=900&q=70&auto=format&fit=crop",
  raponda: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=900&q=70&auto=format&fit=crop",
  loango: "https://images.unsplash.com/photo-1535941339077-2dd1c7963098?w=900&q=70&auto=format&fit=crop",
  ivindo: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=900&q=70&auto=format&fit=crop",
  lope: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=900&q=70&auto=format&fit=crop",
  plage: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=70&auto=format&fit=crop",
  parc: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=900&q=70&auto=format&fit=crop",
  reserve: "https://images.unsplash.com/photo-1549366021-9f761d450615?w=900&q=70&auto=format&fit=crop",
};
const DEFAULT_FALLBACK = "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=900&q=70&auto=format&fit=crop";

function imageForCircuit(name: string, explicit?: string | null) {
  if (explicit) return explicit;
  const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const key of Object.keys(FALLBACK_IMAGES)) {
    if (norm.includes(key)) return FALLBACK_IMAGES[key];
  }
  // Deterministic pick to avoid all-same fallback
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const keys = Object.keys(FALLBACK_IMAGES);
  return FALLBACK_IMAGES[keys[hash % keys.length]] ?? DEFAULT_FALLBACK;
}

export const Route = createFileRoute("/circuits")({
  head: () => ({
    meta: [
      { title: "Circuits Touristiques — Agence Wina" },
      { name: "description", content: "Explorez le Gabon : parcs nationaux, plages paradisiaques, chutes et réserves naturelles." },
      { property: "og:title", content: "Circuits Touristiques — Agence Wina" },
      { property: "og:description", content: "Circuits et excursions touristiques au Gabon." },
    ],
  }),
  // Un réseau mobile qui stalle laissait cette promesse non résolue : la
  // navigation restait figée indéfiniment sur Android. On borne l'attente.
  loader: () =>
    Promise.race([
      fetchOffersByType({ data: "CIRCUIT_TOURISTIQUE" }),
      new Promise<Offer[]>((resolve) => setTimeout(() => resolve([]), 5000)),
    ]).catch(() => [] as Offer[]),
  component: CircuitsPage,
});

function CircuitsPage() {
  const offers = Route.useLoaderData();
  const navigate = useNavigate();
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [target, setTarget] = useState<BookingTarget | null>(null);

  const vtcHref = (destination: string, source: string) => {
    const params = new URLSearchParams({
      pickup: "Mon hôtel",
      destination: `Point de départ — ${destination}`,
      scheduled_at: nextMorningAtEight(),
      source,
    });
    return `/vtc?${params.toString()}`;
  };

  const gpsSlug = (value: string) => value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const openCircuitNavigation = (slug: string) => {
    navigate({ to: "/circuits/suivi/$slug", params: { slug } });
  };

  useEffect(() => {
    supabase
      .from("circuits")
      .select("id, slug, nom, description, base_price, image_url")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setCircuits((data as Circuit[]) ?? []));
  }, []);

  return (
    <>
      <section className="relative h-48 overflow-hidden lg:h-64">
        <img loading="lazy" decoding="async" src={circuitsImg} alt="Circuits touristiques" className="h-full w-full object-cover" width={1280} height={720} />
        <div className="absolute inset-0 hero-gradient opacity-80" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
                <Globe className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary-foreground lg:text-3xl">Circuits Touristiques</h1>
                <p className="text-sm text-primary-foreground/80">Découvrez les merveilles du Gabon</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 lg:px-8 space-y-8 lg:py-10">
        {offers.length > 0 && (
          <div>
            <h2 className="mb-3 text-base font-bold lg:text-lg">Nos offres</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {offers.map((offer: Offer) => (
                <CircuitCard
                  key={offer.id}
                  title={offer.title}
                  description={offer.description}
                  price={offer.price}
                  image={imageForCircuit(offer.title, offer.image_url)}
                  slug={gpsSlug(offer.title)}
                  vtcHref={vtcHref(offer.title, "circuit")}
                  onReserve={() => setTarget({ kind: "circuit", id: null, name: offer.title, basePrice: offer.price })}
                  onOpen={() => openCircuitNavigation(gpsSlug(offer.title))}
                />
              ))}
            </div>
          </div>
        )}

        {circuits.length > 0 && (
          <div>
            <h2 className="mb-3 text-base font-bold lg:text-lg">Tous les circuits</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {circuits.map((c) => (
                <CircuitCard
                  key={c.id}
                  title={c.nom}
                  description={c.description}
                  price={c.base_price}
                  image={imageForCircuit(c.nom, c.image_url)}
                  slug={gpsSlug(c.slug || c.nom)}
                  vtcHref={vtcHref(c.nom, "circuit")}
                  onReserve={() => setTarget({ kind: "circuit", id: c.id, slug: c.slug, name: c.nom, basePrice: c.base_price })}
                  onOpen={() => openCircuitNavigation(gpsSlug(c.slug || c.nom))}
                />
              ))}
            </div>
          </div>
        )}

        {!offers.length && !circuits.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun circuit disponible pour le moment.</p>
        )}

        <p className="mt-8 pb-20 text-center text-sm text-muted-foreground">
          Paiement total requis à la réservation. Réservation min. 48h à l'avance.
        </p>
      </section>

      {target && <BookingDialog target={target} onClose={() => setTarget(null)} />}
      <ClientNav />
    </>
  );
}

function nextMorningAtEight() {
  const date = new Date(Date.now() + 48 * 3600 * 1000);
  date.setHours(8, 0, 0, 0);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("a, button, input, select, textarea"));
}

function CircuitCard({
  title,
  description,
  price,
  image,
  slug,
  vtcHref,
  onReserve,
  onOpen,
}: {
  title: string;
  description?: string;
  price: number;
  image: string;
  slug: string;
  vtcHref: string;
  onReserve: () => void;
  onOpen: () => void;
}) {
  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Naviguer vers le circuit ${title}`}
      onClick={(event) => {
        if (isInteractiveTarget(event.target)) return;
        onOpen();
      }}
      onKeyDown={(event) => {
        if (isInteractiveTarget(event.target)) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group card-hover cursor-pointer overflow-hidden rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-fade-in"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        <img
          {...hdImg(image, "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw")}
          alt={title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between gap-2 text-white">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold leading-tight drop-shadow-md sm:text-base">{title}</h3>
            <p className="text-[10px] font-medium opacity-90">À partir de {formatFCFA(price)}</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/95 p-1.5 text-primary shadow-md backdrop-blur">
            <Navigation className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        {description && <p className="line-clamp-2 text-xs text-muted-foreground sm:text-sm">{description}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onReserve}
            className="inline-flex items-center justify-center gap-1 rounded-[var(--radius-control)] bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-[var(--shadow-card)] hover:brightness-110"
          >
            Réserver <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <a
            href={vtcHref}
            className="inline-flex items-center justify-center gap-1 rounded-[var(--radius-control)] border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            <CarFront className="h-3.5 w-3.5" /> VTC
          </a>
        </div>
        <Link
          to="/circuits/suivi/$slug"
          params={{ slug }}
          aria-label={`Naviguer vers le circuit ${title}`}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
        >
          <MapPin className="h-3.5 w-3.5 text-primary" /> Itinéraire sur la carte
        </Link>
      </div>
    </article>
  );
}
