import { lazy, Suspense, type ComponentProps } from "react";
import { MapErrorBoundary } from "@/components/MapErrorBoundary";
import type { VtcZoneMap as VtcZoneMapComponent, AvailableDriver } from "@/components/VtcZoneMap";

export type { AvailableDriver };

type VtcZoneMapProps = ComponentProps<typeof VtcZoneMapComponent>;

const VtcZoneMap = lazy(() =>
  import("@/components/VtcZoneMap").then((m) => ({ default: m.VtcZoneMap })),
);

/**
 * Leaflet (~150 Ko + init canvas) était importé statiquement par la page VTC,
 * ce qui bloquait le premier rendu sur les WebView Android. On le charge
 * désormais uniquement quand la carte est réellement affichée.
 */
export function LazyVtcZoneMap(props: VtcZoneMapProps) {
  return (
    <MapErrorBoundary>
      <Suspense
        fallback={
          <div
            className="flex w-full items-center justify-center rounded-xl border bg-muted/50 text-sm text-muted-foreground"
            style={{ height: props.height ?? "240px" }}
          >
            Chargement de la carte…
          </div>
        }
      >
        <VtcZoneMap {...props} />
      </Suspense>
    </MapErrorBoundary>
  );
}