import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix Leaflet default icon paths (broken with bundlers)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Modern minimalist SVG icons (inline so they always load — no network fallback risk)
const BUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h19.6"/><path d="M18 18h2a1 1 0 0 0 1-1v-6.5a1 1 0 0 0-.293-.707l-3.914-3.914A1 1 0 0 0 16.086 6H4a2 2 0 0 0-2 2v9a1 1 0 0 0 1 1h2"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>`;
const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;

// Cache des icônes : sans lui, chaque rendu (1 par point GPS) recréait un
// `divIcon` par marqueur, ce qui force Leaflet à détruire/recréer le nœud DOM
// du marqueur — cause directe des gels de la carte sur Android.
const driverIconCache = new Map<string, L.DivIcon>();

function buildDriverIcon(service: "vtc" | "bus" = "bus", heading: number | null = null, active = false) {
  const svg = service === "vtc" ? CAR_SVG : BUS_SVG;
  const color = service === "vtc" ? "#0ea5e9" : "#16a34a";
  // Cap de rotation à 5° : évite un nouvel icône pour chaque micro-variation
  // du cap renvoyé par le GPS.
  const rotation =
    typeof heading === "number" && !Number.isNaN(heading) ? Math.round(heading / 5) * 5 : 0;
  const cacheKey = `${service}|${rotation}|${active ? 1 : 0}`;
  const cached = driverIconCache.get(cacheKey);
  if (cached) return cached;
  const glow = active
    ? `box-shadow:0 0 0 6px ${color}33, 0 0 18px 4px ${color}66, 0 4px 14px rgba(0,0,0,.35);`
    : `box-shadow:0 4px 10px rgba(0,0,0,.25);`;
  const icon = L.divIcon({
    className: `driver-marker driver-marker--${service}${active ? " driver-marker--active" : ""}`,
    html: `
      <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
        ${active ? `<span style="position:absolute;inset:-4px;border-radius:9999px;background:${color};opacity:.18;animation:winaPulse 1.8s ease-out infinite;"></span>` : ""}
        <div style="width:36px;height:36px;border-radius:9999px;background:white;border:2px solid ${color};color:${color};display:flex;align-items:center;justify-content:center;${glow}transition:transform .6s ease;transform:rotate(${rotation}deg);">
          ${svg}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
  if (driverIconCache.size > 200) driverIconCache.clear();
  driverIconCache.set(cacheKey, icon);
  return icon;
}



const clientIcon = L.divIcon({
  className: "client-marker",
  html: `<div style="background:#10b981;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:12px;">📍</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const destIcon = L.divIcon({
  className: "dest-marker",
  html: `<div style="background:#ef4444;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:12px;">🏁</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: "driver" | "client" | "destination";
  label?: string;
  /** For driver markers: which service category to render (defaults to bus). */
  service?: "vtc" | "bus";
  /** Bearing in degrees (0=N, 90=E). Rotates the vehicle icon along travel direction. */
  heading?: number | null;
}

interface LiveMapProps {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  showRoute?: boolean;
  followMarkerId?: string;
  /** Real road route polyline (array of [lat,lng]). Overrides straight-line fallback when provided. */
  routePath?: [number, number][];
}

function MapAutoFit({
  markers,
  followMarkerId,
}: {
  markers: MapMarker[];
  followMarkerId?: string;
}) {
  const map = useMap();
  // Les appelants reconstruisent le tableau `markers` à chaque rendu : sans
  // cette signature stable, `fitBounds`/`setView` (animés) étaient rejoués à
  // chaque rendu, saturant la boucle d'animation de la WebView Android.
  const signature = markers
    .map((m) => `${m.id}:${m.lat.toFixed(5)}:${m.lng.toFixed(5)}`)
    .join("|");
  const markersRef = useRef(markers);
  markersRef.current = markers;
  // E2E hook: expose the Leaflet map + current markers on window so Playwright
  // can assert exact coordinates. No-op in production (just a window property).
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as unknown as { __leafletMap?: L.Map }).__leafletMap = map;
    (window as unknown as { __leafletMarkers?: MapMarker[] }).__leafletMarkers = markersRef.current;
  }, [map, signature]);
  useEffect(() => {
    const markers = markersRef.current;
    if (followMarkerId) {
      const m = markers.find((x) => x.id === followMarkerId);
      if (m) {
        map.setView([m.lat, m.lng], map.getZoom() < 14 ? 14 : map.getZoom(), {
          animate: true,
        });
      }
      return;
    }
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [markers, followMarkerId, map]);
  return null;
}

const iconFor = (m: MapMarker, active = false) => {
  if (m.type === "driver") return buildDriverIcon(m.service ?? "bus", m.heading ?? null, active);
  if (m.type === "client") return clientIcon;
  return destIcon;
};

export function LiveMap({
  markers,
  center = [0.39, 9.45], // Libreville, Gabon default
  zoom = 12,
  height = "100%",
  showRoute = false,
  followMarkerId,
  routePath,
}: LiveMapProps) {
  const fallbackPoints: [number, number][] = showRoute && (!routePath || routePath.length < 2)
    ? markers
        .filter((m) => m.type === "driver" || m.type === "destination" || m.type === "client")
        .map((m) => [m.lat, m.lng])
    : [];
  const realPath = routePath && routePath.length >= 2 ? routePath : null;

  return (
    <div style={{ height, width: "100%" }} className="rounded-xl overflow-hidden border">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={iconFor(m, followMarkerId === m.id)}>
            {m.label && <Popup>{m.label}</Popup>}
          </Marker>
        ))}
        {realPath && (
          <Polyline
            positions={realPath}
            pathOptions={{ color: "hsl(220 90% 56%)", weight: 5, opacity: 0.85 }}
          />
        )}
        {!realPath && fallbackPoints.length >= 2 && (
          <Polyline
            positions={fallbackPoints}
            pathOptions={{ color: "hsl(220 90% 56%)", weight: 4, opacity: 0.6, dashArray: "8 8" }}
          />
        )}
        <MapAutoFit markers={markers} followMarkerId={followMarkerId} />
      </MapContainer>
    </div>
  );
}
