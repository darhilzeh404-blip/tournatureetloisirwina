```tsx
import { useEffect, useRef, useState } from "react";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { detectZone, zoneLabel } from "@/lib/vtc-zones";

type Suggestion = {
  display_name: string;
  lat: string;
  lon: string;
};

interface Props {
  placeholder?: string;
  value: string;
  onSelect: (result: {
    lat: number;
    lng: number;
    label: string;
    inZone: boolean;
  }) => void;
  onClear?: () => void;
  icon?: React.ReactNode;
  sticky?: boolean;
}

// Cadre approximatif autour de Libreville / Akanda / Owendo
// Nominatim viewbox: left,top,right,bottom (lng,lat)
const VIEWBOX = "9.20,0.70,10.00,0.20";

// Cache mémoire partagé entre montages
// LRU simple, max 50 entrées, TTL 10 min
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 50;

const suggestionCache = new Map<
  string,
  { at: number; data: Suggestion[] }
>();

const normKey = (q: string) =>
  q.trim().toLowerCase().replace(/\s+/g, " ");

function cacheGet(key: string): Suggestion[] | null {
  const hit = suggestionCache.get(key);

  if (!hit) return null;

  if (Date.now() - hit.at > CACHE_TTL_MS) {
    suggestionCache.delete(key);
    return null;
  }

  // Refresh recency
  suggestionCache.delete(key);
  suggestionCache.set(key, hit);

  return hit.data;
}

function cacheSet(key: string, data: Suggestion[]) {
  suggestionCache.set(key, {
    at: Date.now(),
    data,
  });

  if (suggestionCache.size > CACHE_MAX) {
    const oldest = suggestionCache.keys().next().value;

    if (oldest) {
      suggestionCache.delete(oldest);
    }
  }
}

function parseCoordinates(s: Suggestion) {
  const lat = Number(s.lat);
  const lng = Number(s.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

export function VtcDestinationSearch({
  placeholder,
  value,
  onSelect,
  onClear,
  icon,
  sticky,
}: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickedRef = useRef(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);

    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    // Évite de relancer une recherche après la sélection
    // d'une suggestion.
    if (pickedRef.current) {
      pickedRef.current = false;
      return;
    }

    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const key = normKey(query);
    const cached = cacheGet(key);

    if (cached) {
      setSuggestions(cached);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);

      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, 6000);

      try {
        const url =
          `https://nominatim.openstreetmap.org/search?format=json&limit=6` +
          `&countrycodes=ga&viewbox=${VIEWBOX}&bounded=1` +
          `&q=${encodeURIComponent(query)}`;

        const res = await fetch(url, {
          headers: {
            "Accept-Language": "fr",
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error("Nominatim request failed");
        }

        const data = (await res.json()) as Suggestion[];

        cacheSet(key, data);
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }

      controller.abort();
    };
  }, [query]);

  const pick = (s: Suggestion) => {
    const coordinates = parseCoordinates(s);

    // Protection importante :
    // aucune coordonnée invalide ne doit atteindre VtcCourseFlow.
    if (!coordinates) {
      console.error("❌ Coordonnées Nominatim invalides", {
        address: s.display_name,
        lat: s.lat,
        lon: s.lon,
      });

      return;
    }

    const { lat, lng } = coordinates;

    // Toujours recalculer la zone à partir des coordonnées réelles.
    // On ne fait pas confiance à une valeur calculée précédemment.
    const zone = detectZone(lat, lng);

    console.log("🚗 VTC DESTINATION SELECTED");
    console.log("Adresse :", s.display_name);
    console.log("Latitude :", lat);
    console.log("Longitude :", lng);
    console.log("Zone détectée :", zone);
    console.log("Zone affichée :", zoneLabel(zone));
    console.log("Dans zone :", Boolean(zone));

    const label = s.display_name
      .split(",")
      .slice(0, 2)
      .join(",")
      .trim();

    pickedRef.current = true;

    setQuery(label);
    setSuggestions([]);
    setOpen(false);
    setLoading(false);

    // On laisse le dropdown se fermer avant le recalcul complet
    // du parcours côté parent.
    window.setTimeout(() => {
      onSelect({
        lat,
        lng,
        label,
        inZone: Boolean(zone),
      });
    }, 0);
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${sticky ? "sticky top-2 z-20" : ""}`}
    >
      <div className="relative flex items-center rounded-2xl border border-border/70 bg-card/90 backdrop-blur-md shadow-sm transition focus-within:border-primary focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]">
        <span className="flex h-10 w-10 items-center justify-center text-muted-foreground">
          {icon ?? <Search className="h-4 w-4" />}
        </span>

        <input
          type="text"
          value={query}
          placeholder={placeholder ?? "Où allez-vous ?"}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="flex-1 bg-transparent py-3 pr-2 text-sm outline-none placeholder:text-muted-foreground"
        />

        {loading && (
          <Loader2 className="mr-3 h-4 w-4 animate-spin text-muted-foreground" />
        )}

        {!loading && query && (
          <button
            type="button"
            onClick={() => {
              pickedRef.current = true;
              setQuery("");
              setSuggestions([]);
              setOpen(false);
              onClear?.();
            }}
            className="mr-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Effacer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-2xl border border-border bg-card shadow-xl"
          >
            {suggestions.map((s, i) => {
              const coordinates = parseCoordinates(s);

              const zone = coordinates
                ? detectZone(coordinates.lat, coordinates.lng)
                : null;

              const parts = s.display_name.split(",");

              return (
                <li key={`${s.lat}-${s.lon}-${i}`}>
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-muted/60"
                  >
                    <MapPin
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        zone
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">
                        {parts[0]}
                      </p>

                      <p className="truncate text-[11px] text-muted-foreground">
                        {parts.slice(1).join(",").trim()}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        zone
                          ? "bg-primary/10 text-primary"
                          : "bg-amber-500/15 text-amber-600"
                      }`}
                    >
                      {zoneLabel(zone)}
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
```
