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
  ChevronDown,
  Info,
  Users,
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
    id: "lbv-donguila",
    title: "LBV - Donguila",
    gathering: "ABC Mall des Charbonnages",
    destinations: ["LBV - Donguila"],
    pricing: { type: "daily", byCapacity: { 16: 100_000, 24: 150_000, 32: 200_000 } },
  },
  {
    id: "lbv-meyang",
    title: "LBV - Meyang",
    gathering: "ABC Mall des Charbonnages",
    destinations: ["LBV - Meyang"],
    pricing: { type: "daily", byCapacity: { 16: 100_000, 24: 150_000, 32: 200_000 } },
  },
  {
    id: "cocobeach",
    title: "LBV - Cocobeach",
    gathering: "ABC Mall des Charbonnages",
    destinations: ["LBV - Cocobeach"],
    pricing: { type: "daily", byCapacity: { 16: 192_000, 24: 288_000, 32: 384_000 } },
  },
] as const;

// Tarifs Location bus pour événements (urbain / mariage / excursion)
const EVENT_BUS_PRICING = {
  standard: { journee: 180_000, demi: 100_000 },
  vip: { journee: 250_000, demi: 130_000 },
} as const;
const EVENT_BUS_CAPACITIES = ["14 places", "16 places", "24 places", "32 places"] as const;

function ReserverTransport() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("scolaire");
  const [busSubTab, setBusSubTab] = useState<"groupe" | "evenement">("groupe");
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

  // ─────────── Form Bus événements ───────────
  const [evtFormule, setEvtFormule] = useState<"journee" | "demi">("journee");
  const [evtStanding, setEvtStanding] = useState<"standard" | "vip">("standard");
  const [evtCapacity, setEvtCapacity] = useState<14 | 16 | 24 | 32>(32);
  const [evtClim, setEvtClim] = useState<boolean>(true);
  const [evtDate, setEvtDate] = useState("");
  const [evtNom, setEvtNom] = useState("");
  const [evtTel, setEvtTel] = useState("");

  const evtUnit = EVENT_BUS_PRICING[evtStanding][evtFormule];
  // Tarifs publiés pour 32 places. Réduction proportionnelle indicative pour 14/16/24 places.
  const evtCapacityFactor = evtCapacity === 32 ? 1 : evtCapacity === 24 ? 0.85 : evtCapacity === 16 ? 0.7 : 0.6;
  const evtTotal = Math.round(evtUnit * evtCapacityFactor);

  const submitEvenement = async () => {
    if (!ensureAuth()) return;
    const nom = evtNom.trim();
    const tel = evtTel.trim();
    if (nom.length < 2 || nom.length > 100) {
      toast.error("Nom invalide (2 à 100 caractères)");
      return;
    }
    if (!/^[0-9+\s().-]{8,20}$/.test(tel)) {
      toast.error("Téléphone invalide");
      return;
    }
    if (!evtDate) {
      toast.error("Choisissez la date de l'événement");
      return;
    }
    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase.from("reservations").insert({
        user_id: user!.id,
        service_type: "LOCATION_BUS" as const,
        reservation_date: evtDate,
        total_amount: evtTotal,
        paid_amount: 0,
        details: {
          type_location: "Événementiel",
          formule: evtFormule === "journee" ? "Journée" : "Demi-journée",
          standing: evtStanding === "vip" ? "VIP" : "Standard",
          capacite: `${evtCapacity} places`,
          climatisation: evtClim,
          contact_nom: nom,
          contact_telephone: tel,
          tarif_unitaire_32_places: evtUnit,
          requires_admin_validation: true,
        },
      }).select("id").single();
      if (error) throw error;
      toast.success("Réservation créée 🎉 Versez 50% d'acompte pour la soumettre à validation.");
      navigate({ to: "/paiement/$reservationId", params: { reservationId: inserted!.id } });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────── Form Bus groupe ───────────
  const [busTripId, setBusTripId] = useState<string>(GROUP_BUS_TRIPS[0].id);
  const [busDirection, setBusDirection] = useState<"aller" | "retour" | "aller_retour">("aller");
  const [busCapacity, setBusCapacity] = useState<16 | 24 | 32>(16);
  const [busDepartureAt, setBusDepartureAt] = useState("");
  const [busReturnAt, setBusReturnAt] = useState("");
  const [busDays, setBusDays] = useState(1);
  const [busPersonnes, setBusPersonnes] = useState(1);
  const [busHasChildren, setBusHasChildren] = useState(false);
  const [busEnfants, setBusEnfants] = useState(0);
  const [busClim, setBusClim] = useState<boolean>(true);

  const selectedBusTrip = GROUP_BUS_TRIPS.find((trip) => trip.id === busTripId)!;
  const isDirectionalBusTrip = selectedBusTrip.pricing.type === "direction";
  const busUnit = isDirectionalBusTrip
    ? busDirection === "aller_retour"
      ? selectedBusTrip.pricing.aller + selectedBusTrip.pricing.retour
      : selectedBusTrip.pricing[busDirection]
    : selectedBusTrip.pricing.byCapacity[busCapacity];
  const busTotal = isDirectionalBusTrip ? busUnit : busUnit * busDays;
  const dailyBusPrices = selectedBusTrip.pricing.type === "daily" ? selectedBusTrip.pricing.byCapacity : null;

  const submitBus = async () => {
    if (!ensureAuth()) return;
    if (!busDepartureAt) {
      toast.error("Choisissez la date et l'heure de départ");
      return;
    }
    if (busReturnAt && busReturnAt < busDepartureAt) {
      toast.error("La date de retour doit être après le départ");
      return;
    }
    if (busPersonnes < 1) {
      toast.error("Indiquez au moins 1 personne");
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
        depart_prevu: busDepartureAt,
        heure_depart: busDepartureAt.split("T")[1] ?? "",
        retour_prevu: busReturnAt || null,
        nb_personnes: busPersonnes,
        avec_enfants: busHasChildren,
        nb_enfants: busHasChildren ? busEnfants : 0,
        climatisation: busClim,
        ...(isDirectionalBusTrip ? {} : { jours: busDays }),
        tarif_unitaire: busUnit,
      };

      const { error } = await supabase.from("reservations").insert({
        user_id: user!.id,
        service_type: "LOCATION_BUS" as const,
        reservation_date: busDepartureAt.split("T")[0],
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
            {/* Sous-onglets Bus */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setBusSubTab("groupe")}
                className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${busSubTab === "groupe" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <Users className="mx-auto mb-0.5 h-4 w-4" />
                Déplacement en groupe
              </button>
              <button
                type="button"
                onClick={() => setBusSubTab("evenement")}
                className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${busSubTab === "evenement" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <Sparkles className="mx-auto mb-0.5 h-4 w-4" />
                Location événements
              </button>
            </div>

            {busSubTab === "groupe" && (
              <div className="space-y-4">
                {/* Bandeau d'info clair */}
                <div className="overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-foreground">Déplacements en groupe</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Itinéraires organisés. Pour des courses individuelles avec chauffeur,
                        utilisez le service VTC depuis l'onglet dédié.
                      </p>
                    </div>
                  </div>
                </div>

            {/* Étape 1 — Choix du trajet */}
            <SectionCard step="1" title="Choisir un trajet" icon={<MapPin className="h-4 w-4" />}>
              <div className="space-y-2">
                {GROUP_BUS_TRIPS.map((trip) => {
                  const active = busTripId === trip.id;
                  const isDirectional = trip.pricing.type === "direction";
                  const priceHint = isDirectional
                    ? `Aller ${formatFCFA(trip.pricing.aller)} · Retour ${formatFCFA(trip.pricing.retour)}`
                    : `Dès ${formatFCFA(trip.pricing.byCapacity[16])}/jour`;
                  return (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => setBusTripId(trip.id)}
                      className={`relative w-full overflow-hidden rounded-2xl border-2 p-4 text-left transition-all ${active ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/40 hover:shadow-sm"}`}
                      aria-pressed={active}
                    >
                      {active && <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-primary" />}
                      <span className="block text-sm font-bold text-foreground">{trip.title}</span>
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0 text-primary" /> {trip.gathering}
                      </span>
                      <span className="mt-2 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                        {priceHint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* Étape 2 — Détails du trajet (dépliant) */}
            <CollapsibleCard
              step="2"
              title="Voir l'itinéraire complet"
              hint={`${selectedBusTrip.destinations.length} arrêt(s)`}
              icon={<Info className="h-4 w-4" />}
              defaultOpen={false}
            >
              <div className="space-y-3">
                <div className="rounded-xl border bg-secondary/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lieu de rassemblement</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> {selectedBusTrip.gathering}
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Destinations desservies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedBusTrip.destinations.map((destination) => (
                      <span key={destination} className="rounded-full border bg-card px-3 py-1 text-xs font-semibold text-foreground">
                        {destination}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CollapsibleCard>

            {/* Étape 3 — Formule */}
            <SectionCard step="3" title={isDirectionalBusTrip ? "Choisir le sens" : "Choisir la capacité"} icon={<Bus className="h-4 w-4" />}>
              {isDirectionalBusTrip ? (
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setBusDirection("aller")} className={pillCls(busDirection === "aller")}>
                    <span className="block text-[11px] uppercase">Aller</span>
                    <span className="mt-0.5 block text-xs font-extrabold">{formatFCFA(selectedBusTrip.pricing.aller)}</span>
                  </button>
                  <button type="button" onClick={() => setBusDirection("retour")} className={pillCls(busDirection === "retour")}>
                    <span className="block text-[11px] uppercase">Retour</span>
                    <span className="mt-0.5 block text-xs font-extrabold">{formatFCFA(selectedBusTrip.pricing.retour)}</span>
                  </button>
                  <button type="button" onClick={() => setBusDirection("aller_retour")} className={pillCls(busDirection === "aller_retour")}>
                    <span className="block text-[11px] uppercase">A/R</span>
                    <span className="mt-0.5 block text-xs font-extrabold">{formatFCFA(selectedBusTrip.pricing.aller + selectedBusTrip.pricing.retour)}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {dailyBusPrices &&
                    ([16, 24, 32] as const).map((capacity) => (
                      <button key={capacity} type="button" onClick={() => setBusCapacity(capacity)} className={pillCls(busCapacity === capacity)}>
                        <span className="block text-[11px] uppercase">{capacity} places</span>
                        <span className="mt-0.5 block text-xs font-extrabold">{formatFCFA(dailyBusPrices[capacity])}/jour</span>
                      </button>
                    ))}
                </div>
              )}
            </SectionCard>

            {/* Climatisation */}
            <SectionCard title="Climatisation" icon={<Sparkles className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setBusClim(true)} className={pillCls(busClim === true)}>
                  <span className="block text-xs font-extrabold">Climatisé ❄️</span>
                </button>
                <button type="button" onClick={() => setBusClim(false)} className={pillCls(busClim === false)}>
                  <span className="block text-xs font-extrabold">Non climatisé</span>
                </button>
              </div>
            </SectionCard>

            {/* Dates départ / retour */}
            <SectionCard title="Dates et heures" icon={<Calendar className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Date & heure de départ" icon={<Calendar className="h-4 w-4 text-primary" />}>
                  <input
                    type="datetime-local"
                    value={busDepartureAt}
                    onChange={(e) => setBusDepartureAt(e.target.value)}
                    className="input-base"
                  />
                </Field>
                <Field label="Date & heure de retour (optionnel)" icon={<Calendar className="h-4 w-4 text-primary" />}>
                  <input
                    type="datetime-local"
                    value={busReturnAt}
                    onChange={(e) => setBusReturnAt(e.target.value)}
                    min={busDepartureAt || undefined}
                    className="input-base"
                  />
                </Field>
                {!isDirectionalBusTrip && (
                  <Field label="Nombre de jours">
                    <NumberStepper value={busDays} onChange={setBusDays} />
                  </Field>
                )}
              </div>
            </SectionCard>

            {/* Voyageurs */}
            <SectionCard title="Voyageurs" icon={<Users className="h-4 w-4" />}>
              <div className="space-y-3">
                <Field label="Nombre de personnes" icon={<Users className="h-4 w-4 text-primary" />}>
                  <NumberStepper value={busPersonnes} onChange={setBusPersonnes} />
                </Field>
                <label className="flex cursor-pointer items-center justify-between rounded-xl border bg-card px-3 py-3 text-sm">
                  <span className="font-semibold text-foreground">Y aura-t-il des enfants ?</span>
                  <input
                    type="checkbox"
                    checked={busHasChildren}
                    onChange={(e) => setBusHasChildren(e.target.checked)}
                    className="h-5 w-5 accent-primary"
                  />
                </label>
                {busHasChildren && (
                  <Field label="Nombre d'enfants">
                    <NumberStepper value={busEnfants} onChange={(n) => setBusEnfants(Math.max(0, n))} />
                  </Field>
                )}
              </div>
            </SectionCard>

            {/* Récap premium */}
            <div className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
              <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Récapitulatif</p>
              </div>
              <div className="p-5 text-center">
                <p className="text-xs text-muted-foreground">{selectedBusTrip.title} · {isDirectionalBusTrip ? "forfait trajet" : `${busCapacity} places · ${busDays} jour(s)`}</p>
                <p className="mt-1 text-3xl font-extrabold text-primary">{formatFCFA(busTotal)}</p>
              </div>
            </div>

                <SubmitBtn loading={submitting} onClick={submitBus} label="Réserver le bus" />
              </div>
            )}

            {busSubTab === "evenement" && (
              <div className="space-y-4 pb-28">
                {/* Bandeau */}
                <div className="overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-foreground">Location bus pour événements</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Transport urbain · Mariage · Excursion
                      </p>
                    </div>
                  </div>
                </div>

                {/* Onglets Standard / VIP */}
                <Tabs value={evtStanding} onValueChange={(v) => setEvtStanding(v as "standard" | "vip")} className="w-full">
                  <TabsList className="grid h-12 w-full grid-cols-2 rounded-2xl bg-muted p-1">
                    <TabsTrigger value="standard" className="rounded-xl text-sm font-bold">Standard</TabsTrigger>
                    <TabsTrigger value="vip" className="rounded-xl text-sm font-bold">VIP ⭐</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Capacités */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Capacité</p>
                  <div className="grid grid-cols-4 gap-2">
                    {([14, 16, 24, 32] as const).map((c) => {
                      const active = evtCapacity === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEvtCapacity(c)}
                          className={`rounded-2xl border-2 p-3 text-center transition-all ${active ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/40"}`}
                          aria-pressed={active}
                        >
                          <p className="text-xl font-extrabold text-foreground">{c}</p>
                          <p className="text-[10px] font-semibold text-muted-foreground">places</p>
                        </button>
                      );
                    })}
                  </div>
                  {evtCapacity !== 32 && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Tarif officiel publié pour 32 places. Estimation indicative pour {evtCapacity} places.
                    </p>
                  )}
                </div>

                {/* Climatisation */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Climatisation</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEvtClim(true)}
                      className={`rounded-2xl border-2 p-3 text-center text-sm font-extrabold transition-all ${evtClim ? "border-primary bg-primary/5 shadow-md text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40"}`}
                      aria-pressed={evtClim}
                    >
                      Climatisé ❄️
                    </button>
                    <button
                      type="button"
                      onClick={() => setEvtClim(false)}
                      className={`rounded-2xl border-2 p-3 text-center text-sm font-extrabold transition-all ${!evtClim ? "border-primary bg-primary/5 shadow-md text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40"}`}
                      aria-pressed={!evtClim}
                    >
                      Non climatisé
                    </button>
                  </div>
                </div>

                {/* Durée */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Durée</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: "journee" as const, l: "Journée" },
                      { v: "demi" as const, l: "Demi-journée" },
                    ]).map((o) => {
                      const active = evtFormule === o.v;
                      const price = EVENT_BUS_PRICING[evtStanding][o.v];
                      return (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => setEvtFormule(o.v)}
                          className={`rounded-2xl border-2 p-4 text-left transition-all ${active ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/40"}`}
                          aria-pressed={active}
                        >
                          <p className="text-sm font-extrabold text-foreground">{o.l}</p>
                          <p className="mt-1 text-base font-extrabold text-primary">{formatFCFA(price)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Coordonnées (dépliantes) */}
                <CollapsibleCard title="Vos coordonnées et date" icon={<Calendar className="h-4 w-4" />} defaultOpen={true}>
                  <div className="space-y-3">
                    <Field label="Date de l'événement" icon={<Calendar className="h-4 w-4 text-primary" />}>
                      <input
                        type="date"
                        value={evtDate}
                        min={new Date(Date.now() + 48 * 3600 * 1000).toISOString().split("T")[0]}
                        onChange={(e) => setEvtDate(e.target.value)}
                        className="input-base"
                      />
                    </Field>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Nom complet" icon={<Users className="h-4 w-4 text-primary" />}>
                        <input type="text" value={evtNom} onChange={(e) => setEvtNom(e.target.value)} maxLength={100} placeholder="Votre nom" className="input-base" />
                      </Field>
                      <Field label="Téléphone">
                        <input type="tel" value={evtTel} onChange={(e) => setEvtTel(e.target.value)} maxLength={20} placeholder="+241 ..." className="input-base" />
                      </Field>
                    </div>
                  </div>
                </CollapsibleCard>

                {/* Barre récapitulative fixe */}
                <div className="fixed inset-x-0 bottom-16 z-40 border-t bg-card/95 px-4 py-3 shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.15)] backdrop-blur supports-[backdrop-filter]:bg-card/80">
                  <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {evtStanding === "vip" ? "VIP" : "Standard"} · {evtFormule === "journee" ? "Journée" : "Demi-journée"} · {evtCapacity} places
                      </p>
                      <p className="text-xl font-extrabold text-primary">{formatFCFA(evtTotal)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={submitEvenement}
                      className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      Réserver maintenant
                    </button>
                  </div>
                </div>
              </div>
            )}
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
  return `rounded-xl border-2 px-3 py-3 text-xs font-semibold transition-all ${active ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-border bg-card text-muted-foreground hover:border-primary/40"}`;
}

function SectionCard({ title, icon, children }: { step?: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center gap-2.5 border-b border-border/50 bg-secondary/40 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          {icon}
        </span>
        <h2 className="truncate text-sm font-extrabold text-foreground">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function CollapsibleCard({ title, hint, icon, children, defaultOpen = false }: { step?: string; title: string; hint?: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 border-b border-border/50 bg-secondary/40 px-4 py-3 text-left transition-colors hover:bg-secondary/60"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-extrabold text-foreground">
            {title}{hint ? <span className="ml-1.5 font-semibold text-muted-foreground">· {hint}</span> : null}
          </h2>
          <p className="truncate text-[11px] text-muted-foreground">{open ? "Toucher pour replier" : "Toucher pour déplier"}</p>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="p-4">{children}</div>}
    </section>
  );
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

function PriceLine({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className={`text-sm font-extrabold ${highlight ? "text-primary" : "text-foreground"}`}>{formatFCFA(value)}</span>
    </div>
  );
}

function dateToDateTimeLocal(date: string) {
  if (date) return `${date}T08:00`;
  const next = new Date(Date.now() + 48 * 3600 * 1000);
  next.setHours(8, 0, 0, 0);
  const offsetMs = next.getTimezoneOffset() * 60000;
  return new Date(next.getTime() - offsetMs).toISOString().slice(0, 16);
}
