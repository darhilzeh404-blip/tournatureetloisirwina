import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ZONES,
  detectZone,
  zoneLabel,
  type ZoneId,
} from "@/lib/vtc-zones";

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const pinIcon = (color: string, label: string) =>
  L.divIcon({
    className: "vtc-pin",
    html: `
      <div
        style="
          background:${color};
          color:white;
          font-size:11px;
          font-weight:700;
          padding:4px 8px;
          border-radius:9999px;
          border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,.3);
          white-space:nowrap;
        "
      >
        ${label}
      </div>
    `,
    iconSize: [80, 28],
    iconAnchor: [40, 14],
  });

type Point = { lat: number; lng: number } | null;

export type AvailableDriver = {
  id: string;
  lat: number;
  lng: number;
  heading?: number | null;
};

interface Props {
  pickup: Point;
  destination: Point;
  selecting: "pickup" | "destination" | null;
  onPick: (
    point: { lat: number; lng: number },
    zone: ZoneId | null,
  ) => void;
  height?: string;
  availableDrivers?: AvailableDriver[];
  highlightDriverId?: string | null;
}

const carIcon = (heading: number | null, highlight: boolean) => {
  const rotate = heading ?? 0;
  const color = highlight ? "#0ea5e9" : "#1e293b";

  return L.divIcon({
    className: "vtc-car-marker",
    html: `
      <div
        style="
          transform:rotate(${rotate}deg);
          transition:transform .6s ease;
          filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));
          ${highlight ? "animation:winaPulse 1.6s ease-in-out infinite;" : ""}
        "
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="${color}"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h.5a1.5 1.5 0 0 1 1.5 1.5V17a1 1 0 0 1-1 1h-1.2a2 2 0 0 1-3.6 0H8.8a2 2 0 0 1-3.6 0H4a1 1 0 0 1-1-1v-4.5A1.5 1.5 0 0 1 4.5 11H5zm2.1 0h9.8l-1-3H8.1l-1 3z"/>
        </svg>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

function ClickHandler({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

function FitBounds({
  pickup,
  destination,
}: {
  pickup: Point;
  destination: Point;
}) {
  const map = useMap();

  useEffect(() => {
    if (pickup && destination) {
      map.fitBounds(
        L.latLngBounds(
          [pickup.lat, pickup.lng],
          [destination.lat, destination.lng],
        ),
        {
          padding: [40, 40],
          maxZoom: 13,
        },
      );
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 13);
    } else if (destination) {
      map.setView([destination.lat, destination.lng], 13);
    }
  }, [pickup, destination, map]);

  return null;
}

export function VtcZoneMap({
  pickup,
  destination,
  selecting,
  onPick,
  height = "320px",
  availableDrivers = [],
  highlightDriverId = null,
}: Props) {
  const center: [number, number] = [0.45, 9.45];

  /*
   * IMPORTANT :
   * Toujours recalculer la zone à partir des coordonnées réelles.
   *
   * detectZone attend :
   *   detectZone(latitude, longitude)
   *
   * et NON :
   *   detectZone(longitude, latitude)
   */
  const pickupZone = useMemo(() => {
    if (!pickup) return null;

    return detectZone(
      Number(pickup.lat),
      Number(pickup.lng),
    );
  }, [pickup]);

  const destinationZone = useMemo(() => {
    if (!destination) return null;

    return detectZone(
      Number(destination.lat),
      Number(destination.lng),
    );
  }, [destination]);

  const pickupZoneName = zoneLabel(pickupZone);
  const destinationZoneName = zoneLabel(destinationZone);

  /*
   * Debug utile pour vérifier directement dans la console
   * les coordonnées et la zone utilisées par la carte.
   */
  useEffect(() => {
    if (!destination) return;

    console.log("🗺️ VTC DESTINATION MAP TEST");
    console.log("Latitude :", destination.lat);
    console.log("Longitude :", destination.lng);
    console.log("Zone destination :", destinationZone);
    console.log("Nom zone :", destinationZoneName);
    console.log(
      "Dans zone :",
      Boolean(destinationZone),
    );
  }, [destination, destinationZone, destinationZoneName]);

  return (
    <div
      className="overflow-hidden rounded-2xl border-2 border-border"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={11}
        style={{
          height: "100%",
          width: "100%",
        }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Zones VTC */}
        {ZONES.map((z) => (
          <Polygon
            key={z.id}
            positions={z.polygon}
            pathOptions={{
              color: z.color,
              weight: 2,
              fillOpacity: 0.12,
            }}
          />
        ))}

        {/* Sélection directement sur la carte */}
        <ClickHandler
          onClick={(lat, lng) => {
            if (!selecting) return;

            const safeLat = Number(lat);
            const safeLng = Number(lng);

            const zone = detectZone(
              safeLat,
              safeLng,
            );

            console.log("🗺️ VTC MAP CLICK");
            console.log("Latitude :", safeLat);
            console.log("Longitude :", safeLng);
            console.log("Zone :", zone);

            onPick(
              {
                lat: safeLat,
                lng: safeLng,
              },
              zone,
            );
          }}
        />

        {/* Chauffeurs disponibles */}
        {availableDrivers.map((d) => (
          <Marker
            key={d.id}
            position={[d.lat, d.lng]}
            icon={carIcon(
              d.heading ?? null,
              d.id === highlightDriverId,
            )}
            interactive={false}
          />
        ))}

        {/* Départ */}
        {pickup && (
          <Marker
            position={[
              Number(pickup.lat),
              Number(pickup.lng),
            ]}
            icon={pinIcon(
              "#16a34a",
              "Départ",
            )}
          >
            <Tooltip
              direction="top"
              offset={[0, -12]}
              permanent={false}
            >
              <strong>Départ</strong>
              <br />
              {pickupZoneName}
            </Tooltip>
          </Marker>
        )}

        {/* Destination */}
        {destination && (
          <Marker
            position={[
              Number(destination.lat),
              Number(destination.lng),
            ]}
            icon={pinIcon(
              "#dc2626",
              destinationZone
                ? "Arrivée"
                : "Hors zone",
            )}
          >
            <Tooltip
              direction="top"
              offset={[0, -12]}
              permanent
            >
              <strong>Arrivée</strong>
              <br />
              {destinationZoneName}
            </Tooltip>
          </Marker>
        )}

        <FitBounds
          pickup={pickup}
          destination={destination}
        />
      </MapContainer>
    </div>
  );
}
