import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2, ArrowRight, Palmtree, Compass, Navigation, MapPin, Clock,
  Sparkles, Flame, Star, LocateFixed, Car, Footprints, Bus,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClientNav } from "@/components/ClientNav";
import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/destinations";
import { BookingDialog, type BookingTarget } from "@/components/BookingDialog";
import circuitsHero from "@/assets/circuits-hero.jpg";

export const Route = createFileRoute("/activites")({
  head: () => ({
    meta: [
      { title: "Activités & Circuits — Agence Wina" },
      { name: "description", content: "Découvrez les plus belles expériences au Gabon : circuits touristiques, excursions et activités premium." },
    ],
  }),
  component: ActivitesPage,
});

type Activity = { id: string; name: string; description: string; price: number; duration_hours: number; location: string; rating: number };
type Circuit = { id: string; slug: string; nom: string; description: string; base_price: number; image_url: string | null; duration_days: number; location: string; rating: number };

function formatDuration(days: number) {
  if (!days || days <= 0) return "Journée";
  if (days === 1) return "1 jour";
  return `${days} jours`;
}
function formatHours(h: number) {
  if (!h || h <= 0) return null;
  if (h < 1) return `${Math.round(h * 60)} min`;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

const FALLBACK_IMG = circuitsHero;

function isIOS() {
  return typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
}
function mapsUrl(place: string) {
  const q = encodeURIComponent(`${place || "Gabon"}, Gabon`);
  return isIOS() ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}
type TravelMode = "driving" | "walking" | "transit";
const TRAVEL_MODES: { value: TravelMode; label: string; icon: typeof Car }[] = [
  { value: "driving", label: "Voiture", icon: Car },
  { value: "walking", label: "Marche", icon: Footprints },
  { value: "transit", label: "Transports", icon: Bus },
];
function directionsUrl(place: string, mode: TravelMode = "driving", from?: { lat: number; lng: number }) {
  const dest = encodeURIComponent(`${place || "Gabon"}, Gabon`);
  if (isIOS()) {
    const dirflg = mode === "walking" ? "w" : mode === "transit" ? "r" : "d";
    const saddr = from ? `&saddr=${from.lat},${from.lng}` : "";
    return `https://maps.apple.com/?daddr=${dest}${saddr}&dirflg=${dirflg}`;
  }
  const origin = from ? `&origin=${from.lat},${from.lng}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}&travelmode=${mode}`;
}
// Cache la dernière position connue pour éviter de re-déclencher la
// permission native à chaque clic.
let cachedPosition: { lat: number; lng: number; at: number } | null = null;
const POSITION_TTL_MS = 2 * 60 * 1000;

function requestPosition(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  if (cachedPosition && Date.now() - cachedPosition.at < POSITION_TTL_MS) {
    return Promise.resolve({ lat: cachedPosition.lat, lng: cachedPosition.lng });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          at: Date.now(),
        };
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

async function openDirectionsFromMe(place: string, mode: TravelMode = "driving") {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    window.open(directionsUrl(place, mode), "_blank", "noopener");
    return;
  }

  // Vérifie l'état de la permission AVANT de déclencher la popup native.
  let state: PermissionState | "unsupported" = "unsupported";
  try {
    if (navigator.permissions?.query) {
      const res = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      state = res.state;
    }
  } catch { /* ignore */ }

  if (state === "denied") {
    toast.error("Géolocalisation refusée", {
      description: "Active la localisation dans les réglages du navigateur pour calculer l'itinéraire depuis ta position.",
    });
    window.open(directionsUrl(place, mode), "_blank", "noopener");
    return;
  }

  // Premier accès : prévient l'utilisateur avant la popup native du navigateur.
  if (state === "prompt") {
    toast.info("Autorise la localisation", {
      description: "Nous l'utilisons uniquement pour calculer ton itinéraire — aucune donnée stockée.",
      duration: 3500,
    });
  }

  const loading = toast.loading("Localisation en cours…");
  const pos = await requestPosition();
  toast.dismiss(loading);

  if (!pos) {
    toast.error("Position indisponible — itinéraire ouvert sans point de départ.");
    window.open(directionsUrl(place, mode), "_blank", "noopener");
    return;
  }
  window.open(directionsUrl(place, mode, pos), "_blank", "noopener");
}

function DirectionsMenu({
  place, size = "md",
}: { place: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const radius = size === "sm" ? "rounded-xl" : "rounded-2xl";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Itinéraire depuis ma position vers ${place}`}
          title="Itinéraire depuis ma position"
          className={`flex ${dim} items-center justify-center ${radius} border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/15 active:scale-[0.96]`}
        >
          <LocateFixed className={iconSize} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Mode de transport
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TRAVEL_MODES.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => openDirectionsFromMe(place, value)}
            className="gap-2 text-[13px] font-medium"
          >
            <Icon className="h-4 w-4 text-primary" /> {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActivitesPage() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<BookingTarget | null>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: acts }, { data: circs }] = await Promise.all([
        supabase.from("transport_activities")
          .select("id, name, description, price, duration_hours, location, rating")
          .eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("circuits")
          .select("id, slug, nom, description, base_price, image_url, duration_days, location, rating")
          .eq("is_active", true).order("sort_order"),
      ]);
      if (!mounted) return;
      setActivities((acts as Activity[]) ?? []);
      setCircuits((circs as Circuit[]) ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const popular = circuits.slice(0, 6);

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/30 via-background to-background pb-28">
      {/* ── Header immersif ─────────────────────────────────────────── */}
      <header className="relative h-[260px] overflow-hidden rounded-b-[32px] shadow-xl shadow-foreground/10">
        <motion.img
          src={circuitsHero}
          alt="Paysages du Gabon"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ y: scrollY * 0.3, scale: 1 + Math.min(scrollY, 200) / 2000 }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/30 via-foreground/50 to-foreground/85" />
        <div className="relative z-10 flex h-full flex-col justify-end px-5 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-widest text-background backdrop-blur-md ring-1 ring-background/20">
              <Sparkles className="h-3 w-3" /> Explore Gabon
            </span>
            <h1 className="mt-2 text-[26px] font-extrabold leading-tight text-background">
              Activités & Circuits
            </h1>
            <p className="mt-1 max-w-md text-[13px] leading-snug text-background/85">
              Découvrez les plus belles expériences au Gabon.
            </p>
          </motion.div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <main className="-mt-4 space-y-7">
          {/* ── Expériences populaires (carousel horizontal) ────────── */}
          {popular.length > 0 && (
            <section>
              <div className="flex items-end justify-between px-5">
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-widest text-primary">Tendance</p>
                  <h2 className="text-[17px] font-extrabold text-foreground">Expériences populaires</h2>
                </div>
                <Link to="/circuits" className="text-[12px] font-semibold text-primary">
                  Voir tout
                </Link>
              </div>

              <HorizontalScroller>
                {popular.map((c, i) => (
                  <PopularCard key={c.id} circuit={c} index={i} onOpen={() => navigate({ to: "/circuits/suivi/$slug", params: { slug: c.slug || gpsSlug(c.nom) } })} />
                ))}
              </HorizontalScroller>
            </section>
          )}

          {/* ── Circuits immersifs (stacked premium) ────────────────── */}
          {circuits.length > 0 && (
            <section className="px-4">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-foreground">
                  <Compass className="h-4 w-4 text-primary" /> Tous les circuits
                </h2>
                <span className="text-[11px] text-muted-foreground">{circuits.length} expériences</span>
              </div>
              <div className="space-y-3.5">
                {circuits.map((c, i) => (
                  <ImmersiveCircuitCard
                    key={c.id}
                    circuit={c}
                    index={i}
                    onExplore={() => setTarget({ kind: "circuit", id: c.id, slug: c.slug, name: c.nom, basePrice: c.base_price })}
                    navigateSlug={c.slug || gpsSlug(c.nom)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Activités ──────────────────────────────────────────── */}
          {activities.length > 0 && (
            <section className="px-4">
              <h2 className="mb-3 flex items-center gap-1.5 px-1 text-[15px] font-extrabold text-foreground">
                <Palmtree className="h-4 w-4 text-accent" /> Activités
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {activities.map((a, i) => (
                  <ActivityTile
                    key={a.id}
                    activity={a}
                    index={i}
                    onBook={() => setTarget({ kind: "activity", id: a.id, name: a.name, basePrice: a.price })}
                  />
                ))}
              </div>
            </section>
          )}

          {circuits.length === 0 && activities.length === 0 && (
            <div className="mx-5 rounded-3xl border border-dashed bg-muted/40 p-8 text-center">
              <Palmtree className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">Aucune activité ni circuit disponible.</p>
            </div>
          )}
        </main>
      )}

      {target && <BookingDialog target={target} onClose={() => setTarget(null)} />}
      <ClientNav />
    </div>
  );
}

// ─── Composants ─────────────────────────────────────────────────────────────

function HorizontalScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ scrollPaddingInline: 20 }}
    >
      {children}
    </div>
  );
}

function PopularCard({ circuit, index, onOpen }: { circuit: Circuit; index: number; onOpen: () => void }) {
  const badge = index === 0 ? "Populaire" : index === 1 ? "Nouveau" : null;
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileTap={{ scale: 0.97 }}
      className="group relative h-44 w-[72%] shrink-0 snap-start overflow-hidden rounded-3xl shadow-md ring-1 ring-border/40 sm:w-[300px]"
    >
      <img
        src={circuit.image_url || FALLBACK_IMG}
        alt={circuit.nom}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 group-active:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/30 to-transparent" />
      {badge && (
        <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-md ${
          badge === "Populaire" ? "bg-accent/90 text-accent-foreground" : "bg-primary/90 text-primary-foreground"
        }`}>
          {badge === "Populaire" ? <Flame className="h-2.5 w-2.5" /> : <Sparkles className="h-2.5 w-2.5" />}
          {badge}
        </span>
      )}
      <span className="absolute right-3 top-3 rounded-full bg-background/95 px-2 py-0.5 text-[11px] font-extrabold text-primary shadow-sm">
        {formatFCFA(circuit.base_price)}
      </span>
      <div className="absolute inset-x-3 bottom-3 text-left">
        <p className="line-clamp-1 text-[14px] font-extrabold text-background drop-shadow">{circuit.nom}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-background/85">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {circuit.location || "Gabon"}</span>
          <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-current text-accent" /> {Number(circuit.rating ?? 4.8).toFixed(1)}</span>
        </div>
      </div>
    </motion.button>
  );
}

function ImmersiveCircuitCard({
  circuit, index, onExplore, navigateSlug,
}: { circuit: Circuit; index: number; onExplore: () => void; navigateSlug: string }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.25), ease: "easeOut" }}
      whileHover={{ y: -3 }}
      className="group relative overflow-hidden rounded-[28px] border border-border/40 bg-card shadow-md shadow-foreground/5"
    >
      <div className="relative h-52 w-full overflow-hidden">
        <img
          src={circuit.image_url || FALLBACK_IMG}
          alt={circuit.nom}
          className="h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-110 group-active:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/15 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-background backdrop-blur-md ring-1 ring-background/30">
          <Compass className="h-2.5 w-2.5" /> Circuit
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-background px-2.5 py-1 text-[12px] font-extrabold text-primary shadow-md">
          {formatFCFA(circuit.base_price)}
          <span className="ml-1 text-[9px] font-semibold text-muted-foreground">/pers</span>
        </span>
        <div className="absolute inset-x-4 bottom-3">
          <h3 className="line-clamp-1 text-[18px] font-extrabold leading-tight text-background drop-shadow-md">
            {circuit.nom}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-background/90">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {circuit.location || "Gabon"}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDuration(circuit.duration_days)}</span>
            <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-current text-accent" /> {Number(circuit.rating ?? 4.8).toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3">
        {circuit.description && (
          <p className="line-clamp-2 flex-1 text-[12.5px] leading-snug text-muted-foreground">
            {circuit.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 pb-3">
        <button
          type="button"
          onClick={onExplore}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary text-[13.5px] font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all active:scale-[0.98]"
        >
          Explorer <ArrowRight className="h-4 w-4" />
        </button>
        <a
          href={mapsUrl(circuit.location || circuit.nom)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Voir ${circuit.location || circuit.nom} sur la carte`}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-card text-primary transition-colors hover:bg-primary/5 active:scale-[0.96]"
        >
          <Navigation className="h-4 w-4" />
        </a>
        <DirectionsMenu place={circuit.location || circuit.nom} size="md" />
      </div>
    </motion.article>
  );
}

function ActivityTile({ activity, index, onBook }: { activity: Activity; index: number; onBook: () => void }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.2) }}
      className="group relative overflow-hidden rounded-3xl border border-border/40 bg-card shadow-sm"
    >
      <div className="relative h-32 overflow-hidden">
        <img src={FALLBACK_IMG} alt={activity.name} loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
        <span className="absolute right-2 top-2 rounded-full bg-background px-2 py-0.5 text-[11px] font-extrabold text-accent shadow">
          {formatFCFA(activity.price)}
        </span>
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 text-[13.5px] font-bold">{activity.name}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {formatHours(activity.duration_hours) && (
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {formatHours(activity.duration_hours)}</span>
          )}
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {activity.location || "Gabon"}</span>
          <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-current text-accent" /> {Number(activity.rating ?? 4.7).toFixed(1)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onBook}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-2 text-[12.5px] font-bold text-accent-foreground active:scale-[0.98]"
          >
            Explorer <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <a
            href={mapsUrl(activity.location || activity.name)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Voir ${activity.location || activity.name} sur la carte`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card text-primary hover:bg-primary/5 active:scale-[0.96]"
          >
            <Navigation className="h-3.5 w-3.5" />
          </a>
          <DirectionsMenu place={activity.location || activity.name} size="sm" />
        </div>
      </div>
    </motion.article>
  );
}

function gpsSlug(value: string) {
  return value.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
