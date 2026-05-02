import { useEffect } from "react";
import { MapContainer, TileLayer, Polygon, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ZONES, detectZone, type ZoneId } from "@/lib/vtc-zones";

// Fix Leaflet default icon (bundler)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const pinIcon = (color: string, label: string) =>
  L.divIcon({
    className: "vtc-pin",
    html: `<div style="background:${color};color:white;font-size:11px;font-weight:700;padding:4px 8px;border-radius:9999px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);white-space:nowrap;">${label}</div>`,
    iconSize: [50, 24],
    iconAnchor: [25, 12],
  });

type Point = { lat: number; lng: number } | null;

interface Props {
  pickup: Point;
  destination: Point;
  selecting: "pickup" | "destination" | null;
  onPick: (point: { lat: number; lng: number }, zone: ZoneId | null) => void;
  height?: string;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitBounds({ pickup, destination }: { pickup: Point; destination: Point }) {
  const map = useMap();
  useEffect(() => {
    if (pickup && destination) {
      map.fitBounds(
        L.latLngBounds([pickup.lat, pickup.lng], [destination.lat, destination.lng]),
        { padding: [40, 40], maxZoom: 13 },
      );
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 13);
    } else if (destination) {
      map.setView([destination.lat, destination.lng], 13);
    }
  }, [pickup, destination, map]);
  return null;
}

export function VtcZoneMap({ pickup, destination, selecting, onPick, height = "320px" }: Props) {
  const center: [number, number] = [0.45, 9.45];

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-border" style={{ height }}>
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {ZONES.map((z) => (
          <Polygon
            key={z.id}
            positions={z.polygon}
            pathOptions={{ color: z.color, weight: 2, fillOpacity: 0.12 }}
          />
        ))}
        <ClickHandler
          onClick={(lat, lng) => {
            if (!selecting) return;
            onPick({ lat, lng }, detectZone(lat, lng));
          }}
        />
        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pinIcon("#16a34a", "Départ")} />
        )}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={pinIcon("#dc2626", "Arrivée")} />
        )}
        <FitBounds pickup={pickup} destination={destination} />
      </MapContainer>
    </div>
  );
}
