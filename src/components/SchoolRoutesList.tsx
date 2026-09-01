import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Bus, Clock, Loader2, MapPin, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NumericTextField } from "@/components/ui/numeric-text-field";
import {
  calculateSchoolTransportAmount,
  schoolPricingDetails,
  schoolUnitPrice,
} from "@/lib/school-pricing";

type SchoolLevel = "maternelle" | "primaire" | "college" | "lycee";

const LEVEL_LABELS: Record<SchoolLevel, string> = {
  maternelle: "Maternelle",
  primaire: "Primaire",
  college: "Collège",
  lycee: "Lycée",
};

type School = {
  id: string;
  name: string;
  address: string | null;
  level: SchoolLevel;
};
type SchoolRoute = {
  id: string;
  school_id: string;
  name: string;
  departure_point: string;
  arrival_point: string;
  departure_time: string | null;
  return_time: string | null;
  monthly_price: number;
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

type TripType = "aller_retour" | "aller_simple" | "retour_simple";

const TRIP_TYPES: { value: TripType; label: string; hint: string }[] = [
  { value: "aller_retour", label: "Aller-Retour", hint: "Tarif plein" },
  { value: "aller_simple", label: "Aller simple", hint: "Moitié + 10 000 F" },
  { value: "retour_simple", label: "Retour simple", hint: "Moitié + 10 000 F" },
];

/** Tarif mensuel par enfant selon le type de trajet (identique au calcul serveur). */
const unitPrice = (monthly: number, trip: TripType) => schoolUnitPrice(monthly, trip);


export function SchoolRoutesList() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [schools, setSchools] = useState<School[]>([]);
  const [routes, setRoutes] = useState<SchoolRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState<SchoolLevel | null>(null);

  const [selected, setSelected] = useState<{ route: SchoolRoute; school?: School } | null>(null);
  const [childLastName, setChildLastName] = useState("");
  const [childFirstName, setChildFirstName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [children, setChildren] = useState(1);
  const [months, setMonths] = useState(1);
  const [tripType, setTripType] = useState<TripType>("aller_retour");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    (async () => {
      const [{ data: s, error: se }, { data: r, error: re }] = await Promise.all([
        supabase.from("schools").select("id,name,address,level").eq("is_active", true).order("name"),
        supabase.from("school_routes").select("*").eq("is_active", true).order("name"),
      ]);
      if (se || re) toast.error("Impossible de charger les établissements");
      setSchools((s ?? []) as School[]);
      setRoutes((r ?? []) as SchoolRoute[]);
      setLoading(false);
    })();
  }, []);

  const total = useMemo(
    () => (selected ? unitPrice(Number(selected.route.monthly_price), tripType) * months * children : 0),
    [selected, months, children, tripType],
  );


  const openBooking = (route: SchoolRoute) => {
    if (!isAuthenticated) {
      toast.error("Veuillez vous connecter pour réserver");
      navigate({ to: "/connexion" });
      return;
    }
    setSelected({ route, school: schools.find((s) => s.id === route.school_id) });
    setChildLastName("");
    setChildFirstName("");
    setChildAge("");
    setChildren(1);
    setMonths(1);
    setTripType("aller_retour");
    setStartDate("");

  };

  const submit = async () => {
    if (!selected || !user) return;
    const age = Number(childAge);
    if (!childLastName.trim() || !childFirstName.trim()) {
      toast.error("Nom et prénom de l'enfant obligatoires");
      return;
    }
    if (!childAge || Number.isNaN(age) || age < 2 || age > 25) {
      toast.error("Âge de l'enfant invalide");
      return;
    }
    if (!startDate) {
      toast.error("Choisissez une date de début");
      return;
    }
    const min = new Date();
    min.setDate(min.getDate() + 2);
    if (new Date(startDate) < new Date(min.toISOString().split("T")[0])) {
      toast.error("Réservation possible 48h à l'avance minimum");
      return;
    }

    setSaving(true);
    try {
      const { route, school } = selected;
      const { error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "TRANSPORT_SCOLAIRE",
        reservation_date: startDate,
        total_amount: total,
        paid_amount: 0,
        details: {
          category: "scolaire",
          school_route_id: route.id,
          school_id: route.school_id,
          school: school?.name,
          route: route.name,
          pickup: route.departure_point,
          destination: route.arrival_point,
          departure_time: route.departure_time,
          return_time: route.return_time,
          months,
          children_count: children,
          trip_type: tripType,
          trip_type_label: TRIP_TYPES.find((t) => t.value === tripType)?.label,
          child_last_name: childLastName.trim(),
          child_first_name: childFirstName.trim(),
          child_age: age,
          quote: [
            {
              label: `${route.name} — ${TRIP_TYPES.find((t) => t.value === tripType)?.label} — ${months} mois × ${children} enfant(s)`,
              amount: total,
            },
          ],

        },
      });
      if (error) throw error;
      toast.success("Réservation créée ! Procédez au paiement.");
      setSelected(null);
      navigate({ to: "/mes-reservations" });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réservation");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement des itinéraires…</p>;
  }

  if (schools.length === 0) {
    return (
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-semibold">Établissements & itinéraires desservis</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aucun établissement disponible pour le moment. Revenez bientôt.
        </p>
      </section>
    );
  }

  const levels = (Object.keys(LEVEL_LABELS) as SchoolLevel[]).filter((lvl) =>
    schools.some((s) => (s.level ?? "primaire") === lvl),
  );
  const visibleSchools = activeLevel
    ? schools.filter((s) => (s.level ?? "primaire") === activeLevel)
    : [];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Établissements & itinéraires desservis</h2>

      <div>
        <Label htmlFor="sr-level" className="mb-1.5 block text-sm font-medium">
          Choisissez une catégorie d'établissement
        </Label>
        <select
          id="sr-level"
          value={activeLevel ?? ""}
          onChange={(e) => setActiveLevel((e.target.value || null) as SchoolLevel | null)}
          className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        >
          <option value="" disabled>
            — Sélectionner une catégorie —
          </option>
          {levels.map((lvl) => {
            const count = schools.filter((s) => (s.level ?? "primaire") === lvl).length;
            return (
              <option key={lvl} value={lvl}>
                {LEVEL_LABELS[lvl]} ({count})
              </option>
            );
          })}
        </select>
      </div>

      {!activeLevel && (
        <p className="text-sm text-muted-foreground">
          Sélectionnez une catégorie pour afficher les établissements correspondants.
        </p>
      )}

      {activeLevel && visibleSchools.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucun établissement dans cette catégorie.
        </p>
      )}

      <div className="space-y-4">
        {visibleSchools.map((school) => (
          <div key={school.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <Bus className="h-4 w-4 text-primary" />
              <p className="font-semibold">{school.name}</p>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {LEVEL_LABELS[school.level] ?? "Primaire"}
              </span>
            </div>
            {school.address && (
              <p className="mt-0.5 text-xs text-muted-foreground">{school.address}</p>
            )}
            {routes.filter((r) => r.school_id === school.id).length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Itinéraires en cours de préparation pour cet établissement.
              </p>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {routes
                .filter((r) => r.school_id === school.id)
                .map((r) => (
                  <div key={r.id} className="flex flex-col rounded-xl border bg-background p-3">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {r.departure_point} → {r.arrival_point}
                    </p>
                    {(r.departure_time || r.return_time) && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {r.departure_time && `Départ ${r.departure_time}`}
                        {r.departure_time && r.return_time && " • "}
                        {r.return_time && `Retour ${r.return_time}`}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-bold text-primary">
                      {fmt(Number(r.monthly_price))} FCFA / mois
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => openBooking(r)}
                    >
                      Réserver cet itinéraire
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>


      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Réserver — {selected?.route.name}</DialogTitle>
            <DialogDescription>
              {selected?.school?.name} • {selected?.route.departure_point} →{" "}
              {selected?.route.arrival_point}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sr-last">Nom de l'enfant</Label>
                <Input
                  id="sr-last"
                  value={childLastName}
                  onChange={(e) => setChildLastName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="sr-first">Prénom de l'enfant</Label>
                <Input
                  id="sr-first"
                  value={childFirstName}
                  onChange={(e) => setChildFirstName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Type de trajet</Label>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                {TRIP_TYPES.map((t) => {
                  const active = tripType === t.value;
                  const price = selected ? unitPrice(Number(selected.route.monthly_price), t.value) : 0;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTripType(t.value)}
                      className={`rounded-xl border p-3 text-left transition ${
                        active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{t.label}</span>
                      <span className="block text-xs text-muted-foreground">{t.hint}</span>
                      <span className="mt-1 block text-sm font-bold text-primary">{fmt(price)} F / mois</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sr-age">Âge</Label>
                <NumericTextField
                  id="sr-age"
                  value={childAge}
                  onChange={setChildAge}
                />
              </div>
              <div />
            </div>

            <div>
              <Label>Nombre de mois</Label>
              <div className="mt-1.5 flex items-center justify-between rounded-xl border p-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Retirer un mois"
                  onClick={() => setMonths((m) => Math.max(1, m - 1))}
                  disabled={months <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-lg font-bold">
                  {months} mois
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Ajouter un mois"
                  onClick={() => setMonths((m) => Math.min(24, m + 1))}
                  disabled={months >= 24}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>


            <div>
              <Label>Nombre d'enfants</Label>
              <div className="mt-1.5 flex items-center justify-between rounded-xl border p-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Retirer un enfant"
                  onClick={() => setChildren((c) => Math.max(1, c - 1))}
                  disabled={children <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-lg font-bold">{children}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Ajouter un enfant"
                  onClick={() => setChildren((c) => Math.min(10, c + 1))}
                  disabled={children >= 10}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="sr-date">Date de début</Label>
              <Input
                id="sr-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted p-3">
              <span className="text-sm font-medium">Total à payer</span>
              <span className="text-lg font-bold text-primary">{fmt(total)} FCFA</span>
            </div>

          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelected(null)}>
              Annuler
            </Button>
            <Button type="button" onClick={submit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer la réservation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
