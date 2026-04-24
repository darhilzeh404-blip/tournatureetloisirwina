import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon paths (broken with bundlers)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const driverIcon = L.divIcon({
  className: "driver-marker",
  html: `<div style="background:hsl(var(--primary));width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:14px;">🚐</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

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
  // E2E hook: expose the Leaflet map + current markers on window so Playwright
  // can assert exact coordinates. No-op in production (just a window property).
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as unknown as { __leafletMap?: L.Map }).__leafletMap = map;
    (window as unknown as { __leafletMarkers?: MapMarker[] }).__leafletMarkers = markers;
  }, [map, markers]);
  useEffect(() => {
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

const iconFor = (type: MapMarker["type"]) =>
  type === "driver" ? driverIcon : type === "client" ? clientIcon : destIcon;

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
          <Marker key={m.id} position={[m.lat, m.lng]} icon={iconFor(m.type)}>
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
