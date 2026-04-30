import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  GraduationCap,
  Bus,
  Sparkles,
  ArrowRight,
  Loader2,
  Calendar,
  MapPin,
} from "lucide-react";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/destinations";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/reserver-transport")({
  head: () => ({
    meta: [
      { title: "Réserver un transport — Agence Wina" },
      {
        name: "description",
        content:
          "Réservez transport scolaire, extra-scolaire avec activités, ou location de bus pour mariage et excursion.",
      },
    ],
  }),
  component: ReserverTransport,
});

// ─────────── Données catalogue ───────────
const SCOLAIRE_ROUTES = ["Akanda → LBV", "Owendo → LBV", "LBV → Akanda", "LBV → Owendo"] as const;
const NIVEAUX = ["Maternelle", "Primaire", "Collège", "Lycée"] as const;
const SCOLAIRE_TARIFS = {
  standard: { mensuel_simple: 80_000, mensuel_ar: 120_000 },
  vip: { mensuel_simple: 150_000, mensuel_ar: 220_000 },
} as const;

const EXTRA_ACTIVITIES = [
  { id: "jardinage", emoji: "🌱", label: "Jardinage fruits & légumes", price: 15_000 },
  { id: "culinaire", emoji: "👨‍🍳", label: "Art culinaire", price: 18_000 },
  { id: "nutrition", emoji: "🥗", label: "Nutrition saine", price: 12_000 },
  { id: "nature", emoji: "🌳", label: "Nature & culture", price: 20_000 },
  { id: "natation", emoji: "🏊", label: "Natation & danse", price: 25_000 },
];

const GROUP_BUS_TRIPS = [
  {
    id: "parc-akanda",
    title: "Trajet Parc d’Akanda",
    gathering: "Parking SANgel",
    note: "Aller et retour facturés séparément pour les déplacements en groupe.",
    destinations: ["Cap Santa-Clara", "Cap Estérias", "Cap des Pères", "Cap Caravane", "Boulokoboué", "Malibé 1", "Malibé 2", "Ndossi village", "Akouago-village"],
    pricing: { type: "direction", aller: 20_000, retour: 20_000 },
  },
  {
    id: "ntoum-donguila",
    title: "Trajet Ntoum-Meyan & Donguila",
    gathering: "ABC Mall des Charbonnages",
    destinations: ["LBV - Donguila", "LBV - Meyang"],
    pricing: { type: "daily", byCapacity: { 16: 100_000, 32: 200_000 } },
  },
  {
    id: "cocobeach",
    title: "Trajet LBV - Cocobeach",
    gathering: "ABC Mall des Charbonnages",
    destinations: ["LBV - Cocobeach"],
    pricing: { type: "daily", byCapacity: { 16: 192_000, 32: 384_000 } },
  },
] as const;

function ReserverTransport() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("scolaire");
  const [submitting, setSubmitting] = useState(false);

  const ensureAuth = () => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver");
      navigate({ to: "/connexion" });
      return false;
    }
    return true;
  };

  // ─────────── Form Scolaire ───────────
  const [scoRoute, setScoRoute] = useState<string>(SCOLAIRE_ROUTES[0]);
  const [scoNiveau, setScoNiveau] = useState<string>(NIVEAUX[1]);
  const [scoEnfants, setScoEnfants] = useState(1);
  const [scoFormule, setScoFormule] = useState<"simple" | "ar">("simple");
  const [scoVip, setScoVip] = useState(false);
  const [scoDate, setScoDate] = useState("");

  const scoUnit = scoVip
    ? scoFormule === "simple"
      ? SCOLAIRE_TARIFS.vip.mensuel_simple
      : SCOLAIRE_TARIFS.vip.mensuel_ar
    : scoFormule === "simple"
      ? SCOLAIRE_TARIFS.standard.mensuel_simple
      : SCOLAIRE_TARIFS.standard.mensuel_ar;
  const scoTotal = scoUnit * scoEnfants;

  const submitScolaire = async () => {
    if (!ensureAuth()) return;
    if (!scoDate) {
      toast.error("Choisissez une date de début");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("reservations").insert({
        user_id: user!.id,
        service_type: "TRANSPORT_SCOLAIRE" as const,
        reservation_date: scoDate,
        total_amount: scoTotal,
        paid_amount: 0,
        details: {
          itineraire: scoRoute,
          niveau: scoNiveau,
          nb_enfants: scoEnfants,
          formule: scoFormule === "simple" ? "Aller simple mensuel" : "Aller-Retour mensuel",
          standing: scoVip ? "VIP" : "Standard",
        },
      });
      if (error) throw error;
      toast.success("Réservation scolaire créée 🎒");
      navigate({ to: "/mes-reservations" });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────── Form Extra-scolaire ───────────
  const [extraSelected, setExtraSelected] = useState<string[]>([]);
  const [extraEnfants, setExtraEnfants] = useState(1);
  const [extraDate, setExtraDate] = useState("");
  const TRANSPORT_FEE = 10_000;
  const extraActivitiesTotal = EXTRA_ACTIVITIES.filter((a) =>
    extraSelected.includes(a.id),
  ).reduce((sum, a) => sum + a.price, 0);
  const extraTotal = (extraActivitiesTotal + TRANSPORT_FEE) * extraEnfants;

  const toggleExtra = (id: string) =>
    setExtraSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submitExtra = async () => {
    if (!ensureAuth()) return;
    if (extraSelected.length === 0) {
      toast.error("Choisissez au moins une activité");
      return;
    }
    if (!extraDate) {
      toast.error("Choisissez une date");
      return;
    }
    setSubmitting(true);
    try {
      const labels = EXTRA_ACTIVITIES.filter((a) => extraSelected.includes(a.id)).map(
        (a) => a.label,
      );
      const { error } = await supabase.from("reservations").insert({
        user_id: user!.id,
        service_type: "TRANSPORT_SCOLAIRE" as const,
        reservation_date: extraDate,
        total_amount: extraTotal,
        paid_amount: 0,
        details: {
          formule: "Extra-scolaire",
          activites: labels,
          nb_enfants: extraEnfants,
          frais_transport: TRANSPORT_FEE,
        },
      });
      if (error) throw error;
      toast.success("Réservation extra-scolaire créée 🌱");
      navigate({ to: "/mes-reservations" });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────── Form Bus ───────────
  const [busTripId, setBusTripId] = useState<string>(GROUP_BUS_TRIPS[0].id);
  const [busDirection, setBusDirection] = useState<"aller" | "retour" | "aller_retour">("aller");
  const [busCapacity, setBusCapacity] = useState<16 | 32>(16);
  const [busDate, setBusDate] = useState("");
  const [busDays, setBusDays] = useState(1);

  const selectedBusTrip = GROUP_BUS_TRIPS.find((trip) => trip.id === busTripId)!;
  const isDirectionalBusTrip = selectedBusTrip.pricing.type === "direction";
  const busUnit = isDirectionalBusTrip
    ? busDirection === "aller_retour"
      ? selectedBusTrip.pricing.aller + selectedBusTrip.pricing.retour
      : selectedBusTrip.pricing[busDirection]
    : selectedBusTrip.pricing.byCapacity[busCapacity];
  const busTotal = isDirectionalBusTrip ? busUnit : busUnit * busDays;

  const submitBus = async () => {
    if (!ensureAuth()) return;
    if (!busDate) {
      toast.error("Choisissez une date");
      return;
    }
    setSubmitting(true);
    try {
      const reservationDetails = {
        trajet_groupe: selectedBusTrip.title,
        lieu_rassemblement: selectedBusTrip.gathering,
        destinations: [...selectedBusTrip.destinations],
        formule: isDirectionalBusTrip
          ? busDirection === "aller_retour" ? "Aller + retour" : busDirection === "aller" ? "Aller" : "Retour"
          : `${busCapacity} places`,
        ...(isDirectionalBusTrip ? {} : { jours: busDays }),
        tarif_unitaire: busUnit,
      };

      const { error } = await supabase.from("reservations").insert({
        user_id: user!.id,
        service_type: "LOCATION_BUS" as const,
        reservation_date: busDate,
        total_amount: busTotal,
        paid_amount: 0,
        details: reservationDetails,
      });
      if (error) throw error;
      toast.success("Réservation bus créée 🚌");
      navigate({ to: "/mes-reservations" });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="hero-gradient px-5 pb-6 pt-8">
        <h1 className="text-xl font-bold text-primary-foreground">🚌 Réserver un transport</h1>
        <p className="mt-1 text-sm text-primary-foreground/70">
          Scolaire, extra-scolaire ou location de bus
        </p>
      </div>

      <div className="px-5 pt-5">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            <TabsTrigger value="scolaire" className="flex-col gap-0.5 py-2 text-[11px]">
              <GraduationCap className="h-4 w-4" /> Scolaire
            </TabsTrigger>
            <TabsTrigger value="extra" className="flex-col gap-0.5 py-2 text-[11px]">
              <Sparkles className="h-4 w-4" /> Extra
            </TabsTrigger>
            <TabsTrigger value="bus" className="flex-col gap-0.5 py-2 text-[11px]">
              <Bus className="h-4 w-4" /> Bus
            </TabsTrigger>
          </TabsList>

          {/* ─── SCOLAIRE ─── */}
          <TabsContent value="scolaire" className="mt-5 space-y-4">
            <Field label="Itinéraire">
              <select
                value={scoRoute}
                onChange={(e) => setScoRoute(e.target.value)}
                className="input-base"
              >
                {SCOLAIRE_ROUTES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Niveau">
                <select
                  value={scoNiveau}
                  onChange={(e) => setScoNiveau(e.target.value)}
                  className="input-base"
                >
                  {NIVEAUX.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </Field>
              <Field label="Nombre d'enfants">
                <NumberStepper value={scoEnfants} onChange={setScoEnfants} />
              </Field>
            </div>

            <Field label="Formule abonnement mensuel">
              <div className="grid grid-cols-2 gap-2">
                {(["simple", "ar"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setScoFormule(f)}
                    className={pillCls(scoFormule === f)}
                  >
                    {f === "simple" ? "Aller simple" : "Aller-Retour"}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Standing">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setScoVip(false)} className={pillCls(!scoVip)}>
                  Standard · {formatFCFA(scoFormule === "simple" ? SCOLAIRE_TARIFS.standard.mensuel_simple : SCOLAIRE_TARIFS.standard.mensuel_ar)}
                </button>
                <button type="button" onClick={() => setScoVip(true)} className={pillCls(scoVip)}>
                  VIP · {formatFCFA(scoFormule === "simple" ? SCOLAIRE_TARIFS.vip.mensuel_simple : SCOLAIRE_TARIFS.vip.mensuel_ar)}
                </button>
              </div>
            </Field>

            <Field label="Date de début" icon={<Calendar className="h-4 w-4 text-primary" />}>
              <input
                type="date"
                value={scoDate}
                onChange={(e) => setScoDate(e.target.value)}
                className="input-base"
              />
            </Field>

            <PriceCard total={scoTotal} subtitle={`${scoEnfants} enfant(s) · ${scoVip ? "VIP" : "Standard"} mensuel`} />

            <SubmitBtn loading={submitting} onClick={submitScolaire} label="Réserver Scolaire" />
          </TabsContent>

          {/* ─── EXTRA-SCOLAIRE ─── */}
          <TabsContent value="extra" className="mt-5 space-y-4">
            <p className="text-xs text-muted-foreground">
              Transport ({formatFCFA(TRANSPORT_FEE)}) inclus. Choisissez les activités souhaitées.
            </p>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Activités</h3>
              <div className="space-y-2">
                {EXTRA_ACTIVITIES.map((a) => {
                  const sel = extraSelected.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleExtra(a.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${sel ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="text-xl">{a.emoji}</span> {a.label}
                      </span>
                      <span className="text-xs font-bold text-primary">{formatFCFA(a.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre d'enfants">
                <NumberStepper value={extraEnfants} onChange={setExtraEnfants} />
              </Field>
              <Field label="Date" icon={<Calendar className="h-4 w-4 text-primary" />}>
                <input
                  type="date"
                  value={extraDate}
                  onChange={(e) => setExtraDate(e.target.value)}
                  className="input-base"
                />
              </Field>
            </div>

            <PriceCard
              total={extraTotal}
              subtitle={`${extraSelected.length} activité(s) · ${extraEnfants} enfant(s)`}
            />
            <SubmitBtn loading={submitting} onClick={submitExtra} label="Réserver + Activité" />
          </TabsContent>

          {/* ─── BUS ─── */}
          <TabsContent value="bus" className="mt-5 space-y-4">
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-sm font-bold">Déplacements en groupe uniquement</p>
              <p className="mt-1 text-xs text-muted-foreground">Sélectionnez un trajet organisé, le lieu de rassemblement et la formule adaptée.</p>
            </div>

            <Field label="Trajet de groupe">
              <div className="space-y-2">
                {GROUP_BUS_TRIPS.map((trip) => {
                  const active = busTripId === trip.id;
                  return (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => setBusTripId(trip.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition-colors ${active ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                    >
                      <span className="block text-sm font-bold">{trip.title}</span>
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary" /> Rassemblement : {trip.gathering}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="rounded-2xl border bg-secondary/40 p-4">
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Itinéraire</p>
              <div className="flex flex-wrap gap-2">
                {selectedBusTrip.destinations.map((destination) => (
                  <span key={destination} className="rounded-full border bg-card px-3 py-1 text-xs font-semibold">
                    {destination}
                  </span>
                ))}
              </div>
            </div>

            {isDirectionalBusTrip ? (
              <Field label="Formule">
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setBusDirection("aller")} className={pillCls(busDirection === "aller")}>Aller · {formatFCFA(selectedBusTrip.pricing.aller)}</button>
                  <button type="button" onClick={() => setBusDirection("retour")} className={pillCls(busDirection === "retour")}>Retour · {formatFCFA(selectedBusTrip.pricing.retour)}</button>
                  <button type="button" onClick={() => setBusDirection("aller_retour")} className={pillCls(busDirection === "aller_retour")}>A/R · {formatFCFA(selectedBusTrip.pricing.aller + selectedBusTrip.pricing.retour)}</button>
                </div>
              </Field>
            ) : (
              <Field label="Capacité du bus">
                <div className="grid grid-cols-2 gap-2">
                  {selectedBusTrip.pricing.type === "daily" &&
                    ([16, 32] as const).map((capacity) => (
                      <button key={capacity} type="button" onClick={() => setBusCapacity(capacity)} className={pillCls(busCapacity === capacity)}>
                        Bus {capacity} places · {formatFCFA(selectedBusTrip.pricing.byCapacity[capacity])}/journée
                      </button>
                    ))}
                </div>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" icon={<Calendar className="h-4 w-4 text-primary" />}>
                <input
                  type="date"
                  value={busDate}
                  onChange={(e) => setBusDate(e.target.value)}
                  className="input-base"
                />
              </Field>
              {!isDirectionalBusTrip && (
                <Field label="Nombre de jours">
                  <NumberStepper value={busDays} onChange={setBusDays} />
                </Field>
              )}
            </div>

            <PriceCard total={busTotal} subtitle={`${selectedBusTrip.title} · ${isDirectionalBusTrip ? "forfait trajet" : `${busCapacity} places · ${busDays} jour(s)`}`} />
            <SubmitBtn loading={submitting} onClick={submitBus} label="Réserver Bus" />
          </TabsContent>
        </Tabs>
      </div>

      <ClientNav />

      <style>{`
        .input-base {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          padding: 0.75rem;
          font-size: 0.875rem;
        }
        .input-base:focus { outline: none; box-shadow: 0 0 0 2px hsl(var(--primary) / 0.4); }
      `}</style>
    </div>
  );
}

// ─────────── UI helpers ───────────
function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
        {icon} {label}
      </label>
      {children}
    </div>
  );
}

function NumberStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-lg font-bold"
      >
        −
      </button>
      <span className="min-w-[2.5rem] text-center text-base font-bold">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-lg font-bold"
      >
        +
      </button>
    </div>
  );
}

function pillCls(active: boolean) {
  return `rounded-xl border px-3 py-3 text-xs font-semibold transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`;
}

function PriceCard({ total, subtitle }: { total: number; subtitle: string }) {
  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 text-center">
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <p className="mt-1 text-2xl font-extrabold text-primary">{formatFCFA(total)}</p>
    </div>
  );
}

function SubmitBtn({ loading, onClick, label }: { loading: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
      {loading ? "Réservation..." : label}
    </button>
  );
}

function dateToDateTimeLocal(date: string) {
  if (date) return `${date}T08:00`;
  const next = new Date(Date.now() + 48 * 3600 * 1000);
  next.setHours(8, 0, 0, 0);
  const offsetMs = next.getTimezoneOffset() * 60000;
  return new Date(next.getTime() - offsetMs).toISOString().slice(0, 16);
}
