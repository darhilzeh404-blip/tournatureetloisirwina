import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

/**
 * Virtualisation basée sur le scroll de la fenêtre : seules les lignes
 * visibles (plus une marge) sont montées dans le DOM. Indispensable sur
 * Android où les longues listes admin (centaines de cartes/lignes avec ombres
 * et flous) provoquaient des tempêtes de layout/paint.
 *
 * En dessous de `threshold` éléments, on rend la liste normalement : la
 * virtualisation n'apporte rien et évite tout risque de régression visuelle.
 */

function useWindowOffset(ref: React.RefObject<HTMLElement | null>) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const measure = () => {
      if (!ref.current) return;
      setOffset(ref.current.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });
  return offset;
}

/* ============================ Grille de cartes ============================ */

interface VirtualCardGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
  /** Largeur minimale d'une colonne (px) — détermine le nombre de colonnes. */
  minColWidth?: number;
  /** Espacement en px (doit correspondre au gap visuel souhaité). */
  gap?: number;
  estimateRowHeight?: number;
  threshold?: number;
  className?: string;
}

export function VirtualCardGrid<T>({
  items,
  renderItem,
  getKey,
  minColWidth = 320,
  gap = 16,
  estimateRowHeight = 240,
  threshold = 40,
  className,
}: VirtualCardGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);
  const offset = useWindowOffset(containerRef);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const compute = () => {
      const w = el.clientWidth;
      setCols(Math.max(1, Math.floor((w + gap) / (minColWidth + gap))));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gap, minColWidth]);

  const virtualize = items.length > threshold;

  const rows: T[][] = [];
  if (virtualize) {
    for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  }

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => estimateRowHeight + gap,
    overscan: 3,
    scrollMargin: offset,
  });

  if (!virtualize) {
    return (
      <div
        ref={containerRef}
        className={className}
        style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}
      >
        {items.map((item, i) => (
          <div key={getKey(item, i)}>{renderItem(item, i)}</div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((v) => {
          const row = rows[v.index];
          if (!row) return null;
          return (
            <div
              key={v.key}
              data-index={v.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  gap,
                  paddingBottom: gap,
                }}
              >
                {row.map((item, i) => {
                  const index = v.index * cols + i;
                  return <div key={getKey(item, index)}>{renderItem(item, index)}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ Corps de tableau ============================ */

interface VirtualTableBodyProps<T> {
  items: T[];
  renderRow: (item: T, index: number) => ReactNode;
  colSpan: number;
  estimateRowHeight?: number;
  threshold?: number;
}

/**
 * `<tbody>` virtualisé : les lignes hors écran sont remplacées par deux
 * lignes d'espacement, ce qui conserve la hauteur de scroll et l'alignement
 * des colonnes.
 */
export function VirtualTableBody<T>({
  items,
  renderRow,
  colSpan,
  estimateRowHeight = 72,
  threshold = 40,
}: VirtualTableBodyProps<T>) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const offset = useWindowOffset(bodyRef);
  const virtualize = items.length > threshold;

  const virtualizer = useWindowVirtualizer({
    count: virtualize ? items.length : 0,
    estimateSize: () => estimateRowHeight,
    overscan: 8,
    scrollMargin: offset,
  });

  if (!virtualize) {
    return <tbody>{items.map((item, i) => renderRow(item, i))}</tbody>;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const total = virtualizer.getTotalSize();
  const paddingTop = virtualItems.length ? virtualItems[0].start - virtualizer.options.scrollMargin : 0;
  const paddingBottom = virtualItems.length
    ? total - (virtualItems[virtualItems.length - 1].end - virtualizer.options.scrollMargin)
    : 0;

  return (
    <tbody ref={bodyRef}>
      {paddingTop > 0 && (
        <tr aria-hidden="true">
          <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 0 }} />
        </tr>
      )}
      {virtualItems.map((v) => {
        const item = items[v.index];
        if (item === undefined) return null;
        return renderRow(item, v.index);
      })}
      {paddingBottom > 0 && (
        <tr aria-hidden="true">
          <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 0 }} />
        </tr>
      )}
    </tbody>
  );
}
