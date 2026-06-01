import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOsrmRoute } from "@/hooks/use-osrm-route";

interface Props {
  from: { lat: number; lng: number } | null;
  to: { lat: number; lng: number } | null;
  label?: string;
  showArrival?: boolean;
  className?: string;
}

function formatArrival(minutes: number) {
  const d = new Date(Date.now() + minutes * 60_000);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Displays a real-road ETA via OSRM (free routing, no API key).
 * Shows "≈ N min" and optionally the arrival clock time.
 */
export function EtaBadge({ from, to, label, showArrival = false, className }: Props) {
  const enabled = Boolean(from && to);
  const { route, loading } = useOsrmRoute(from, to, enabled);

  if (!enabled) return null;
  if (loading && !route) {
    return (
      <Badge variant="secondary" className={`gap-1 ${className ?? ""}`}>
        <Clock className="h-3 w-3 animate-pulse" />
        {label ? `${label} …` : "ETA …"}
      </Badge>
    );
  }
  if (!route) return null;

  return (
    <Badge variant="secondary" className={`gap-1 ${className ?? ""}`}>
      <Clock className="h-3 w-3" />
      {label ? `${label} ` : "ETA "}≈ {route.durationMin} min
      {showArrival && ` · ${formatArrival(route.durationMin)}`}
    </Badge>
  );
}
