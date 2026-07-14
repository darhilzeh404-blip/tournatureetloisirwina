import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LayoutGrid, Car, Users, Calendar, ChevronRight, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CatalogCategory, CatalogVehicle } from "@/lib/catalog";

export const Route = createFileRoute("/catalogue")({
  head: () => ({
    meta: [
      { title: "Catalogue véhicules — Agence Wina" },
      {
        name: "description",
        content:
          "Découvrez toute notre flotte : berlines, SUV, minibus, autocars et véhicules VIP. Photos HD et réservation.",
      },
      { property: "og:title", content: "Catalogue véhicules — Agence Wina" },
      {
        property: "og:description",
        content:
          "Toute la flotte Wina en photos HD : berlines, SUV, minibus, autocars, VIP.",
      },
    ],
  }),
  component: CataloguePage,
});

function CataloguePage() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [vehicles, setVehicles] = useState<CatalogVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [preview, setPreview] = useState<CatalogVehicle | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  useEffect(() => {
    (async () => {
      const [cats, vehs] = await Promise.all([
        supabase
          .from("catalog_vehicle_categories" as any)
          .select("*")
          .eq("is_active", true)
          .order("sort_order")
          .order("name"),
        supabase
          .from("catalog_vehicles" as any)
          .select("*")
          .eq("is_active", true)
          .order("sort_order")
          .order("name"),
      ]);
      setCategories((cats.data as any) ?? []);
      setVehicles(
        ((vehs.data as any) ?? []).map((v: any) => ({
          ...v,
          gallery: Array.isArray(v.gallery) ? v.gallery : [],
        })),
      );
      setLoading(false);
    })();
  }, []);

  const filtered = activeCat === "all" ? vehicles : vehicles.filter((v) => v.category_id === activeCat);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/70 text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-10 lg:py-14">
          <div className="flex items-center gap-2 text-xs opacity-80 mb-3">
            <LayoutGrid className="h-4 w-4" />
            <span>Catalogue</span>
          </div>
          <h1 className="text-3xl lg:text-5xl font-bold tracking-tight">Toute la flotte Wina</h1>
          <p className="mt-3 text-base lg:text-lg opacity-90 max-w-2xl">
            Berlines, SUV, minibus, autocars et véhicules VIP — parcourez le catalogue en photos HD et réservez celui qui vous correspond.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Category chips with 3D icons */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <CategoryChip
            active={activeCat === "all"}
            label="Tout"
            onClick={() => setActiveCat("all")}
            count={vehicles.length}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              active={activeCat === c.id}
              iconUrl={c.icon_url}
              label={c.name}
              count={vehicles.filter((v) => v.category_id === c.id).length}
              onClick={() => setActiveCat(c.id)}
            />
          ))}
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-16">Chargement du catalogue…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center space-y-2">
              <Car className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Aucun véhicule disponible dans cette catégorie.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((v) => {
              const cat = categories.find((c) => c.id === v.category_id);
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setPreview(v);
                    setPreviewIdx(0);
                  }}
                  className="group text-left rounded-2xl border bg-card overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                    {v.gallery[0] ? (
                      <img
                        src={v.gallery[0]}
                        alt={v.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Car className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    {cat && (
                      <Badge className="absolute top-3 left-3 bg-black/60 backdrop-blur text-white border-0">
                        {cat.name}
                      </Badge>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold text-lg leading-tight">{v.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {[v.brand, v.model, v.year].filter(Boolean).join(" · ") || "\u00A0"}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                      {v.seats && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {v.seats} places
                        </span>
                      )}
                      {v.year && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" /> {v.year}
                        </span>
                      )}
                      <span className="ml-auto inline-flex items-center gap-1 text-primary font-medium">
                        Voir <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Detail dialog with gallery + booking CTAs */}
      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden max-h-[95vh] flex flex-col">
          {preview && (
            <>
              <div className="relative bg-muted">
                <img
                  src={preview.gallery[previewIdx] ?? ""}
                  alt={preview.name}
                  className="w-full aspect-video object-cover"
                />
                <button
                  onClick={() => setPreview(null)}
                  className="absolute top-3 right-3 rounded-full bg-black/60 p-1.5 text-white"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
                {preview.gallery.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {preview.gallery.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPreviewIdx(i)}
                        className={`h-2 w-2 rounded-full transition-all ${
                          i === previewIdx ? "bg-white w-6" : "bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="p-5 space-y-4 overflow-y-auto">
                <div>
                  <h2 className="text-2xl font-bold">{preview.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {[preview.brand, preview.model, preview.year].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {preview.description && (
                  <p className="text-sm text-foreground/80 leading-relaxed">{preview.description}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {preview.seats && (
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4" /> {preview.seats} places
                    </span>
                  )}
                  {preview.year && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" /> {preview.year}
                    </span>
                  )}
                </div>
                {preview.gallery.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {preview.gallery.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setPreviewIdx(i)}
                        className={`aspect-video rounded-lg overflow-hidden border-2 ${
                          i === previewIdx ? "border-primary" : "border-transparent"
                        }`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button asChild className="flex-1">
                    <Link to="/vtc">Réserver une course VTC</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link to="/location-bus">Louer / affréter</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link to="/support">
                      <Phone className="h-4 w-4 mr-1" /> Contact
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryChip({
  active,
  iconUrl,
  label,
  count,
  onClick,
}: {
  active: boolean;
  iconUrl?: string | null;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-2 rounded-2xl border px-4 py-2.5 transition-all ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
          : "bg-card border-border hover:border-primary/40"
      }`}
    >
      {iconUrl ? (
        <img src={iconUrl} alt="" width={40} height={40} className="h-10 w-10 object-contain -my-1" />
      ) : (
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${active ? "bg-white/10" : "bg-muted"}`}>
          <LayoutGrid className="h-5 w-5" />
        </div>
      )}
      <div className="text-left">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        <p className={`text-[10px] ${active ? "opacity-80" : "text-muted-foreground"}`}>{count} véhicules</p>
      </div>
    </button>
  );
}
