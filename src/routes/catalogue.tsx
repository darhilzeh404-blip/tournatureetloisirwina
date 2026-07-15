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
import berlineIcon from "@/assets/catalog-icon-berline.png";
import busIcon from "@/assets/catalog-icon-bus.png";
import minibusIcon from "@/assets/catalog-icon-minibus.png";
import suvIcon from "@/assets/catalog-icon-suv.png";
import utilitaireIcon from "@/assets/catalog-icon-utilitaire.png";
import vipIcon from "@/assets/catalog-icon-vip.png";
import autocarIcon from "@/assets/catalog-icon-autocar.png";

const categoryIcons: Record<string, string> = {
  "Berline": berlineIcon,
  "Bus": busIcon,
  "Minibus": minibusIcon,
  "SUV": suvIcon,
  "Utilitaire": utilitaireIcon,
  "VIP": vipIcon,
  "Autocar": autocarIcon,
};

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
              iconUrl={categoryIcons[c.name] || c.icon_url}
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
                <BookingForm vehicle={preview} onDone={() => setPreview(null)} />
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

const fmtXAF = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

const SERVICE_OPTIONS: { value: string; label: string }[] = [
  { value: "avec_chauffeur", label: "Avec chauffeur" },
  { value: "sans_chauffeur", label: "Sans chauffeur" },
  { value: "evenement", label: "Événement / cérémonie" },
  { value: "transfert_aeroport", label: "Transfert aéroport" },
];

function BookingForm({ vehicle, onDone }: { vehicle: CatalogVehicle; onDone: () => void }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [service, setService] = useState(SERVICE_OPTIONS[0].value);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const days = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const a = new Date(startDate).getTime();
    const b = new Date(endDate).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 1;
    return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
  }, [startDate, endDate]);

  const rate = vehicle.daily_rate ?? 0;
  const total = rate * days * Math.max(1, quantity);

  const submit = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver");
      navigate({ to: "/connexion" });
      return;
    }
    if (rate <= 0) {
      toast.error("Ce véhicule n'a pas encore de tarif — contactez le support.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("La date de fin doit être après la date de début.");
      return;
    }
    setSubmitting(true);
    try {
      const serviceLabel = SERVICE_OPTIONS.find((s) => s.value === service)?.label ?? service;
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "LOCATION_CATALOGUE" as any,
        reservation_date: startDate,
        total_amount: total,
        paid_amount: 0,
        details: {
          flow: "catalog_rental",
          catalog_vehicle_id: vehicle.id,
          vehicle_name: vehicle.name,
          service_option: service,
          start_date: startDate,
          end_date: endDate,
          days,
          quantity,
          daily_rate: rate,
          quote: [
            { label: `${vehicle.name} — ${serviceLabel}`, amount: 0 },
            { label: `${days} jour(s) × ${quantity} × ${fmtXAF(rate)}`, amount: total },
          ],
        },
      } as any).select("id").single();
      if (error) throw error;
      toast.success("Réservation créée ! Procédez au paiement.");
      onDone();
      navigate({ to: "/paiement/$reservationId", params: { reservationId: (data as any).id } });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Réserver ce véhicule</h3>
        {rate > 0 && (
          <span className="text-xs font-semibold text-primary">{fmtXAF(rate)} / jour</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-medium">Du</label>
          <Input type="date" min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="text-[11px] font-medium">Au</label>
          <Input type="date" min={startDate || today} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-medium">Type de service</label>
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {SERVICE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium">Quantité</label>
          <Input
            type="number" min={1} max={20}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-background border p-3">
        <div className="text-xs text-muted-foreground">
          {days} jour{days > 1 ? "s" : ""} × {quantity} × {fmtXAF(rate)}
        </div>
        <div className="text-lg font-bold text-primary">{fmtXAF(total)}</div>
      </div>

      {rate <= 0 && (
        <p className="text-[11px] text-amber-600">
          Tarif non défini. Contactez l'admin pour définir le tarif journalier avant réservation.
        </p>
      )}

      <Button
        onClick={submit}
        disabled={submitting || rate <= 0}
        className="w-full"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Réserver et payer — ${fmtXAF(total)}`}
      </Button>
    </div>
  );
}
