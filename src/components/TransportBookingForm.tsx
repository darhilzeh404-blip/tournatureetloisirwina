import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, MapPin, Bus as BusIcon, Sparkles, Repeat, Calendar, Users, Snowflake } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTransportData, computeQuote, type QuoteInput } from "@/hooks/use-transport-data";
import { TransportQuote } from "./TransportQuote";

type Props = {
  categorySlug: "scolaire" | "extra-scolaire" | "evenementiel";
  serviceType: "TRANSPORT_SCOLAIRE" | "LOCATION_BUS" | "CIRCUIT_TOURISTIQUE";
  showChildren?: boolean;
  showActivities?: boolean;
  showPackages?: boolean;
  showAcOption?: boolean;
};

const AC_MULTIPLIER = 1.8;

export function TransportBookingForm({ categorySlug, serviceType, showChildren, showActivities, showPackages, showAcOption }: Props) {
  const data = useTransportData();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [routeId, setRouteId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [svc, setSvc] = useState<"standard" | "vip">("standard");
  const [trip, setTrip] = useState<"aller_simple" | "aller_retour">("aller_simple");
  const [acType, setAcType] = useState<"classique" | "climatisee">("classique");
  const [children, setChildren] = useState(0);
  const [date, setDate] = useState("");
  const [activityIds, setActivityIds] = useState<string[]>([]);
  const [childLastName, setChildLastName] = useState("");
  const [childFirstName, setChildFirstName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [packageId, setPackageId] = useState("");
  const [loading, setLoading] = useState(false);

  const category = data.categories.find(c => c.slug === categorySlug);
  const routes = useMemo(
    () => data.routes.filter(r => r.is_active && r.category_id === category?.id),
    [data.routes, category?.id]
  );
  const vehicles = data.vehicles.filter(v => v.is_active);
  const packages = data.packages.filter(p => p.is_active);

  const input: QuoteInput = {
    routeId, vehicleId, serviceType: svc, tripType: trip,
    childrenCount: showChildren ? children : 0,
    activityIds: showActivities ? activityIds : [],
  };
  const baseQuote = computeQuote(input, data);

  const isAc = showAcOption && acType === "climatisee";
  const mult = isAc ? AC_MULTIPLIER : 1;

  const quote = useMemo(() => {
    const lines = baseQuote.lines.map(l => ({ ...l, amount: Math.round(l.amount * mult) }));
    return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
  }, [baseQuote, mult]);

  const selectedPackage = packages.find(p => p.id === packageId);
  const packagePrice = selectedPackage ? Math.round(selectedPackage.price * mult) : 0;
  const finalTotal = selectedPackage ? packagePrice : quote.total;

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !user) {
      toast.error("Veuillez vous connecter pour réserver");
      navigate({ to: "/connexion" });
      return;
    }
    if (!selectedPackage && (!routeId || !vehicleId)) {
      toast.error("Sélectionnez itinéraire et véhicule");
      return;
    }
    if (finalTotal <= 0) { toast.error("Devis invalide"); return; }
    const ageNum = Number(childAge);
    if (showActivities && activityIds.length > 0) {
      if (!childLastName.trim() || !childFirstName.trim()) {
        toast.error("Nom et prénom de l'enfant obligatoires");
        return;
      }
      if (!childAge || Number.isNaN(ageNum) || ageNum < 1 || ageNum > 25) {
        toast.error("Âge de l'enfant invalide");
        return;
      }
    }

    setLoading(true);
    try {
      const route = data.routes.find(r => r.id === (selectedPackage?.route_id ?? routeId));
      const vehicle = data.vehicles.find(v => v.id === vehicleId);
      const selectedActivities = data.activities.filter(a => activityIds.includes(a.id));
      const { error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: serviceType,
        reservation_date: date || new Date().toISOString().split("T")[0],
        total_amount: finalTotal,
        paid_amount: 0,
        details: {
          category: categorySlug,
          route_id: route?.id,
          route: route?.name,
          pickup: route?.origin,
          destination: route?.destination,
          vehicle_id: vehicle?.id,
          vehicle: vehicle?.name,
          service_type: svc,
          trip_type: trip,
          children_count: children,
          activity_ids: activityIds,
          activities: selectedActivities.map(a => ({
            id: a.id,
            name: a.name,
            price: a.price,
            registration_fee: Number(a.registration_fee ?? 0),
            partner: data.partners.find(p => p.id === a.partner_id)?.name ?? null,
          })),
          registration_fees_total: selectedActivities.reduce((s, a) => s + Number(a.registration_fee ?? 0), 0),
          ...(activityIds.length > 0
            ? {
                child_last_name: childLastName.trim(),
                child_first_name: childFirstName.trim(),
                child_age: ageNum,
              }
            : {}),
          package_id: packageId || undefined,
          ...(showAcOption ? { bus_type: acType, ac_multiplier: mult } : {}),
          quote: selectedPackage
            ? [{ label: selectedPackage.name + (isAc ? " (Climatisée)" : ""), amount: packagePrice }]
            : quote.lines,
        },
      });
      if (error) throw error;
      toast.success("Réservation créée ! Procédez au paiement.");
      navigate({ to: "/mes-reservations" });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réservation");
    } finally {
      setLoading(false);
    }
  };

  if (data.loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {showAcOption && (
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
            <Snowflake className="h-4 w-4 text-primary" /> Type de bus
            <span className="ml-auto text-xs font-normal text-muted-foreground">Climatisée : +80% premium</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["classique", "climatisee"] as const).map(t => (
              <button
                key={t} type="button" onClick={() => setAcType(t)}
                className={`rounded-xl border px-3 py-3 text-xs font-semibold transition-colors ${
                  acType === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                }`}
              >
                {t === "climatisee" ? "❄️ Climatisée" : "Classique"}
                <div className="mt-0.5 text-[10px] font-normal opacity-75">
                  {t === "climatisee" ? "×1.8" : "tarif standard"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showPackages && packages.length > 0 && (
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" /> Forfait packagé (optionnel)
          </label>
          <select
            value={packageId}
            onChange={e => setPackageId(e.target.value)}
            className="w-full rounded-xl border bg-card px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">-- Construire à la carte --</option>
            {packages.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} — {fmt(p.price)} FCFA{showAcOption ? ` | Clim. ${fmt(Math.round(p.price * AC_MULTIPLIER))} FCFA` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {!packageId && (
        <>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-primary" /> Itinéraire
            </label>
            <select
              value={routeId}
              onChange={e => setRouteId(e.target.value)}
              className="w-full rounded-xl border bg-card px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required={!packageId}
            >
              <option value="">Sélectionnez un itinéraire</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {routes.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Aucun itinéraire pour cette catégorie. Demandez à l'admin d'en ajouter.</p>}
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
              <BusIcon className="h-4 w-4 text-primary" /> Véhicule
            </label>
            <div className="grid grid-cols-3 gap-2">
              {vehicles.map(v => (
                <button
                  key={v.id} type="button"
                  onClick={() => setVehicleId(v.id)}
                  className={`rounded-xl border px-3 py-3 text-xs font-semibold transition-colors ${
                    vehicleId === v.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <div className="font-bold">{v.capacity}</div>
                  <div>places</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" /> Service
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["standard", "vip"] as const).map(s => (
                  <button key={s} type="button" onClick={() => setSvc(s)}
                    className={`rounded-xl border px-3 py-3 text-xs font-semibold transition-colors ${
                      svc === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                    }`}>
                    {s === "vip" ? "VIP ⭐" : "Standard"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <Repeat className="h-4 w-4 text-primary" /> Trajet
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["aller_simple", "aller_retour"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setTrip(t)}
                    className={`rounded-xl border px-3 py-3 text-xs font-semibold transition-colors ${
                      trip === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                    }`}>
                    {t === "aller_retour" ? "Aller-Retour" : "Aller simple"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {showChildren && (
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-primary" /> Nombre d'enfants
              </label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setChildren(Math.max(0, children - 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card text-lg font-bold">−</button>
                <span className="min-w-[3rem] text-center text-lg font-bold">{children}</span>
                <button type="button" onClick={() => setChildren(children + 1)} className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card text-lg font-bold">+</button>
              </div>
            </div>
          )}

          {showActivities && data.activities.length > 0 && (
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" /> Activités éducatives à la carte
              </label>
              <div className="space-y-2">
                {data.activities.filter(a => a.is_active).map(a => {
                  const checked = activityIds.includes(a.id);
                  const partner = data.partners.find(p => p.id === a.partner_id);
                  return (
                    <label key={a.id} className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${checked ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                      <div className="flex flex-1 items-start gap-2">
                        <input type="checkbox" className="mt-1" checked={checked} onChange={() => {
                          setActivityIds(checked ? activityIds.filter(x => x !== a.id) : [...activityIds, a.id]);
                        }} />
                        {a.image_url && (
                          <img src={a.image_url} alt={a.name} loading="lazy" className="h-10 w-10 rounded-lg object-cover" />
                        )}
                        <div className="min-w-0">
                          <span className="font-medium">{a.name}</span>{" "}
                          <span className="text-xs text-muted-foreground">({a.duration_hours}h)</span>
                          {a.description && (
                            <p className="text-[11px] leading-snug text-muted-foreground">{a.description}</p>
                          )}
                          {partner && (
                            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                              {partner.logo_url && (
                                <img src={partner.logo_url} alt={partner.name} className="h-4 w-4 rounded object-contain" />
                              )}
                              Partenaire : {partner.name}
                            </p>
                          )}
                          {Number(a.registration_fee) > 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              + Frais d'inscription {fmt(Number(a.registration_fee))} FCFA
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 font-semibold">{fmt(a.price)} FCFA</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {showActivities && activityIds.length > 0 && (
            <div className="rounded-xl border bg-card p-3">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-primary" /> Informations de l'enfant
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  value={childLastName}
                  onChange={e => setChildLastName(e.target.value)}
                  placeholder="Nom *"
                  maxLength={80}
                  className="rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  value={childFirstName}
                  onChange={e => setChildFirstName(e.target.value)}
                  placeholder="Prénom *"
                  maxLength={80}
                  className="rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={childAge}
                  onChange={e => setChildAge(e.target.value)}
                  placeholder="Âge *"
                  className="rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4 text-primary" /> Date souhaitée
        </label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          min={new Date(Date.now() + 48 * 3600 * 1000).toISOString().split("T")[0]}
          className="w-full rounded-xl border bg-card px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {selectedPackage ? (
        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5">
          <h3 className="font-bold text-primary">
            Forfait : {selectedPackage.name}{isAc && " — Climatisée"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{selectedPackage.description}</p>
          <p className="mt-3 text-2xl font-extrabold text-primary">{fmt(packagePrice)} FCFA</p>
          {showAcOption && (
            <p className="mt-1 text-xs text-muted-foreground">
              Classique : {fmt(selectedPackage.price)} FCFA · Climatisée : {fmt(Math.round(selectedPackage.price * AC_MULTIPLIER))} FCFA
            </p>
          )}
        </div>
      ) : (
        <>
          <TransportQuote quote={quote} />
          {showAcOption && baseQuote.total > 0 && (
            <div className="rounded-xl border bg-muted/30 p-3 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Classique</span><span className="font-semibold">{fmt(baseQuote.total)} FCFA</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Climatisée (+80%)</span><span className="font-semibold text-primary">{fmt(Math.round(baseQuote.total * AC_MULTIPLIER))} FCFA</span></div>
            </div>
          )}
        </>
      )}

      <button
        type="submit"
        disabled={loading || finalTotal <= 0}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Création..." : "Confirmer et réserver"}
      </button>
    </form>
  );
}
