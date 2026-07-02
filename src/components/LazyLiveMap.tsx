import { lazy, Suspense, type ComponentProps, type ReactNode } from "react";
import { MapErrorBoundary } from "@/components/MapErrorBoundary";
import type { LiveMap as LiveMapComponent, MapMarker } from "@/components/LiveMap";

export type { MapMarker };

type LiveMapProps = ComponentProps<typeof LiveMapComponent>;

interface LazyLiveMapProps extends LiveMapProps {
  fallback?: ReactNode;
  withErrorBoundary?: boolean;
}

const LiveMap = lazy(() => import("@/components/LiveMap").then((module) => ({ default: module.LiveMap })));

function DefaultMapFallback({ height }: { height?: string }) {
  return (
    <div
      className="flex w-full items-center justify-center rounded-xl border bg-muted/50 text-sm text-muted-foreground"
      style={{ height: height ?? "100%" }}
    >
      Chargement de la carte…
    </div>
  );
}

export function LazyLiveMap({ fallback, withErrorBoundary = true, ...props }: LazyLiveMapProps) {
  const content = (
    <Suspense fallback={fallback ?? <DefaultMapFallback height={props.height} />}>
      <LiveMap {...props} />
    </Suspense>
  );

  if (!withErrorBoundary) return content;
  return <MapErrorBoundary>{content}</MapErrorBoundary>;
}