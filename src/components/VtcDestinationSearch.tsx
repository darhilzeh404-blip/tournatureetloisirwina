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
  onSelect: (result: { lat: number; lng: number; label: string; inZone: boolean }) => void;
  onClear?: () => void;
  icon?: React.ReactNode;
  sticky?: boolean;
}

// Cadre approximatif autour de Libreville / Akanda / Owendo
// Nominatim viewbox: left,top,right,bottom (lng,lat)
const VIEWBOX = "9.20,0.70,9.65,0.20";

// Cache mémoire partagé entre montages (LRU simple, max 50 entrées, TTL 10 min)
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 50;
const suggestionCache = new Map<string, { at: number; data: Suggestion[] }>();
const normKey = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");
function cacheGet(key: string): Suggestion[] | null {
  const hit = suggestionCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    suggestionCache.delete(key);
    return null;
  }
  // refresh recency
  suggestionCache.delete(key);
  suggestionCache.set(key, hit);
  return hit.data;
}
function cacheSet(key: string, data: Suggestion[]) {
  suggestionCache.set(key, { at: Date.now(), data });
  if (suggestionCache.size > CACHE_MAX) {
    const oldest = suggestionCache.keys().next().value;
    if (oldest) suggestionCache.delete(oldest);
  }
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

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const pickedRef = useRef(false);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (pickedRef.current) {
      // Skip fetch triggered by our own setQuery(label) after picking
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
      const timeoutId = window.setTimeout(() => controller.abort(), 6000);
      try {
        const url =
          `https://nominatim.openstreetmap.org/search?format=json&limit=6` +
          `&countrycodes=ga&viewbox=${VIEWBOX}&bounded=1` +
          `&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          headers: { "Accept-Language": "fr" },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("net");
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
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      controller.abort();
    };
  }, [query]);

  const pick = (s: Suggestion) => {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    const zone = detectZone(lat, lng);
    const label = s.display_name.split(",").slice(0, 2).join(",").trim();
    pickedRef.current = true;
    setQuery(label);
    setSuggestions([]);
    setOpen(false);
    setLoading(false);
    // Defer parent update to next tick so the dropdown closes before any heavy re-render
    setTimeout(() => onSelect({ lat, lng, label, inZone: !!zone }), 0);
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
              setQuery("");
              setSuggestions([]);
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
              const lat = parseFloat(s.lat);
              const lng = parseFloat(s.lon);
              const zone = detectZone(lat, lng);
              const parts = s.display_name.split(",");
              return (
                <li key={`${s.lat}-${s.lon}-${i}`}>
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-muted/60"
                  >
                    <MapPin
                      className={`mt-0.5 h-4 w-4 shrink-0 ${zone ? "text-primary" : "text-muted-foreground"}`}
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
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${zone ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-amber-600"}`}
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
