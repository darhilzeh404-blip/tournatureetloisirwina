import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, Bus, Loader2, MapPin, Minus, Package, Plus, ShieldCheck, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AgencyLogo } from "@/components/AgencyLogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  computeBusQuote, createBusBooking, fmtXAF, formatDateFR, FARE_LABEL,
  toISODate, uploadBusDocument, type BusPassengerInput, type BusTrip,
} from "@/lib/bus";

export const Route = createFileRoute("/billets/bus/$agencyId")({
  head: () => ({
    meta: [
      { title: "Réserver un billet de bus — Wina Tour" },
      { name: "description", content: "Choisissez votre trajet, votre date de départ et réservez vos billets de bus au Gabon avec Wina Tour." },
      { property: "og:title", content: "Réserver un billet de bus — Wina Tour" },
      { property: "og:description", content: "Trajets, tarifs par tranche d'âge et bagages : réservez votre bus en quelques minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BusAgencyPage,
});

type Agency = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  is_verified: boolean;
  accepts_parcel?: boolean;
  accepts_funeral?: boolean;
};

function BusAgencyPage() {
  const { agencyId } = Route.useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [agency, setAgency] = useState<Agency | null>(null);
  const [trips, setTrips] = useState<BusTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [month, setMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [trip, setTrip] = useState<BusTrip | null>(null);

  const [passengers, setPassengers] = useState<BusPassengerInput[]>([{ full_name: "", age: "", baggage_kg: "0" }]);
  const [bookerName, setBookerName] = useState("");
  const [bookerPhone, setBookerPhone] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: ag }, { data: tr }] = await Promise.all([
        supabase.from("partner_agencies_public" as any)
          .select("id, name, logo_url, description, is_verified, accepts_parcel, accepts_funeral")
          .eq("id", agencyId).maybeSingle(),
        supabase.from("bus_trips" as any).select("*").eq("agency_id", agencyId)
          .eq("status", "available").gte("departure_date", toISODate(new Date()))
          .order("departure_date", { ascending: true }),
      ]);
      setAgency((ag as any) ?? null);
      setTrips(((tr as any) ?? []) as BusTrip[]);
      setLoading(false);
    })();
  }, [agencyId]);

  const origins = useMemo(() => Array.from(new Set(trips.map((t) => t.origin))).sort(), [trips]);
  const destinations = useMemo(
    () => Array.from(new Set(trips.filter((t) => !origin || t.origin === origin).map((t) => t.destination))).sort(),
    [trips, origin],
  );

  const matching = useMemo(
    () => trips.filter((t) => (!origin || t.origin === origin) && (!destination || t.destination === destination) && t.seats_available > 0),
    [trips, origin, destination],
  );

  const availableDates = useMemo(() => new Set(matching.map((t) => t.departure_date)), [matching]);
  const dayTrips = useMemo(
    () => (selectedDate ? matching.filter((t) => t.departure_date === toISODate(selectedDate)) : []),
    [matching, selectedDate],
  );

  const quote = useMemo(() => computeBusQuote(trip, passengers), [trip, passengers]);

  const setPassengerCount = (n: number) => {
    const count = Math.min(Math.max(n, 1), 20);
    setPassengers((prev) => {
      const next = [...prev];
      while (next.length < count) next.push({ full_name: "", age: "", baggage_kg: "0" });
      return next.slice(0, count);
    });
  };

  const updatePassenger = (i: number, patch: Partial<BusPassengerInput>) =>
    setPassengers((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const submit = async () => {
    if (!trip) return;
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver");
      navigate({ to: "/connexion" });
      return;
    }
    if (!bookerName.trim()) return toast.error("Nom complet du réservant requis");
    if (!bookerPhone.trim()) return toast.error("Numéro de téléphone requis");
    if (!idFile) return toast.error("La pièce d'identité est obligatoire");
    if (passengers.some((p) => !p.full_name.trim())) return toast.error("Nom complet requis pour chaque passager");
    if (passengers.some((p) => p.age === "" || Number(p.age) < 0)) return toast.error("Âge requis pour chaque passager");
    if (passengers.length > trip.seats_available) return toast.error("Places insuffisantes sur ce voyage");

    setSubmitting(true);
    try {
      const path = await uploadBusDocument(user.id, idFile);
      const res = await createBusBooking({
        tripId: trip.id,
        bookerName: bookerName.trim(),
        bookerPhone: bookerPhone.trim(),
        idDocumentUrl: path,
        passengers: passengers.map((p) => ({
          full_name: p.full_name.trim(),
          age: Number(p.age),
          baggage_kg: Number(p.baggage_kg) || 0,
        })),
      });
      toast.success("Réservation enregistrée — procédez au paiement");
      navigate({ to: "/paiement/$reservationId", params: { reservationId: res.reservation_id } });
    } catch (e: any) {
      toast.error(errorMessage(e?.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5">
        <Link to="/billets/categorie/$slug" params={{ slug: "bus" }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour aux agences
        </Link>

        <header className="mt-6 flex items-center gap-3">
          <AgencyLogo src={agency?.logo_url} alt={agency?.name ?? ""} size={56} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold">{agency?.name ?? "Agence"}</h1>
              {agency?.is_verified && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  <BadgeCheck className="h-3 w-3" /> Vérifiée
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{matching.length} départ(s) disponible(s)</p>
          </div>
        </header>

        {(agency?.accepts_parcel || agency?.accepts_funeral) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {agency?.accepts_parcel && (
              <Link to="/colis" className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                <Package className="h-3.5 w-3.5" /> Expédition de colis — demander un devis
              </Link>
            )}
            {agency?.accepts_funeral && (
              <Link to="/transport-funeraire" className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                <ShieldCheck className="h-3.5 w-3.5" /> Transport funéraire — demander un devis
              </Link>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Étape 1 — trajet */}
            <section className="mt-6 rounded-2xl border bg-card p-4 sm:p-5">
              <h2 className="text-sm font-bold">1. Votre trajet</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">Ville de départ</span>
                  <select value={origin} onChange={(e) => { setOrigin(e.target.value); setDestination(""); setTrip(null); }}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm">
                    <option value="">Toutes les villes</option>
                    {origins.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">Ville d'arrivée</span>
                  <select value={destination} onChange={(e) => { setDestination(e.target.value); setTrip(null); }}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm">
                    <option value="">Toutes les destinations</option>
                    {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              </div>
            </section>

            {/* Étape 2 — calendrier mensuel */}
            <section className="mt-4 rounded-2xl border bg-card p-4 sm:p-5">
              <h2 className="text-sm font-bold">2. Date de départ</h2>
              <p className="mt-1 text-xs text-muted-foreground">Seules les dates avec des départs disponibles sont sélectionnables.</p>
              <div className="mt-3 flex justify-center">
                <Calendar
                  mode="single"
                  month={month}
                  onMonthChange={setMonth}
                  selected={selectedDate}
                  onSelect={(d) => { setSelectedDate(d ?? undefined); setTrip(null); }}
                  disabled={(d) => !availableDates.has(toISODate(d))}
                  modifiers={{ hasTrip: (d) => availableDates.has(toISODate(d)) }}
                  modifiersClassNames={{ hasTrip: "bg-primary/10 font-bold text-primary rounded-md" }}
                  className="pointer-events-auto rounded-xl border p-3"
                />
              </div>
            </section>

            {/* Étape 3 — voyages du jour */}
            {selectedDate && (
              <section className="mt-4 rounded-2xl border bg-card p-4 sm:p-5">
                <h2 className="text-sm font-bold">3. Départs du {formatDateFR(toISODate(selectedDate))}</h2>
                {dayTrips.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">Aucun départ disponible à cette date.</p>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {dayTrips.map((t) => (
                      <button key={t.id} type="button" onClick={() => setTrip(t)}
                        className={`rounded-xl border p-3 text-left transition ${trip?.id === t.id ? "border-primary bg-primary/5" : "hover:bg-secondary/50"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                            <Bus className="h-4 w-4 text-primary" /> {t.origin} → {t.destination}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {t.seats_available} place(s) restante(s)
                          </span>
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                          <span>Adulte : <b className="text-foreground">{fmtXAF(t.price_adult)}</b></span>
                          <span>7–11 ans : <b className="text-foreground">{fmtXAF(t.price_child_7_11)}</b></span>
                          <span>0–6 ans : <b className="text-foreground">{fmtXAF(t.price_child_0_6)}</b></span>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Bagage inclus : {t.baggage_included_kg} kg · {fmtXAF(t.baggage_extra_price_per_kg)} / kg supplémentaire
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-muted-foreground">
                  L'heure de départ et l'heure de convocation vous seront communiquées par l'agence avec votre billet définitif.
                </p>
              </section>
            )}

            {/* Étape 4 — passagers */}
            {trip && (
              <section className="mt-4 rounded-2xl border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="inline-flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4" /> 4. Passagers</h2>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPassengerCount(passengers.length - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border"><Minus className="h-4 w-4" /></button>
                    <span className="w-6 text-center text-sm font-bold">{passengers.length}</span>
                    <button type="button" onClick={() => setPassengerCount(passengers.length + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  {passengers.map((p, i) => {
                    const l = quote.lines[i];
                    return (
                      <div key={i} className="rounded-xl border p-3">
                        <p className="text-[11px] font-bold text-muted-foreground">Passager {i + 1}</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <Input placeholder="Nom complet" value={p.full_name} onChange={(e) => updatePassenger(i, { full_name: e.target.value })} />
                          <Input type="number" min={0} placeholder="Âge" value={p.age} onChange={(e) => updatePassenger(i, { age: e.target.value })} />
                          <Input type="number" min={0} placeholder="Poids bagage (kg)" value={p.baggage_kg} onChange={(e) => updatePassenger(i, { baggage_kg: e.target.value })} />
                        </div>
                        {l && p.age !== "" && (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {FARE_LABEL[l.category]} · {fmtXAF(l.fare)}
                            {l.extraKg > 0 ? ` · +${l.extraKg} kg = ${fmtXAF(l.baggageFee)}` : " · bagage inclus"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {trip.baggage_conditions && (
                  <div className="mt-3 rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground whitespace-pre-line">
                    <b className="text-foreground">Conditions de bagages : </b>{trip.baggage_conditions}
                  </div>
                )}
              </section>
            )}

            {/* Étape 5 — réservant */}
            {trip && (
              <section className="mt-4 rounded-2xl border bg-card p-4 sm:p-5">
                <h2 className="text-sm font-bold">5. Informations du réservant</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Input placeholder="Nom complet" value={bookerName} onChange={(e) => setBookerName(e.target.value)} />
                  <Input placeholder="Numéro de téléphone" value={bookerPhone} onChange={(e) => setBookerPhone(e.target.value)} />
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3 text-sm">
                  <Upload className="h-4 w-4 text-primary" />
                  <span className="flex-1 truncate">{idFile ? idFile.name : "Pièce d'identité (obligatoire) — photo ou PDF"}</span>
                  <input type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
                  <span className="rounded-lg border px-2 py-1 text-xs font-semibold">Choisir</span>
                </label>
              </section>
            )}

            {/* Étape 6 — récapitulatif */}
            {trip && (
              <section className="mt-4 rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 sm:p-5">
                <h2 className="text-sm font-bold">6. Récapitulatif</h2>
                <div className="mt-3 space-y-1.5 text-sm">
                  <Row label="Agence" value={agency?.name ?? "—"} />
                  <Row label="Trajet" value={`${trip.origin} → ${trip.destination}`} />
                  <Row label="Date de départ" value={formatDateFR(trip.departure_date)} />
                  <Row label="Passagers" value={String(passengers.length)} />
                  <div className="my-2 border-t" />
                  <Row label="Total des billets" value={fmtXAF(quote.ticketsTotal)} />
                  <Row label="Supplément bagages" value={fmtXAF(quote.baggageTotal)} />
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-sm font-bold">Total général</span>
                    <span className="text-2xl font-extrabold text-primary">{fmtXAF(quote.total)}</span>
                  </div>
                </div>
                <Button className="mt-4 w-full" onClick={submit} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Valider et payer"}
                </Button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  <MapPin className="mr-1 inline h-3 w-3" />
                  Le billet définitif (heure de départ, convocation, siège) vous sera envoyé après traitement par l'agence.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function errorMessage(code?: string) {
  switch (code) {
    case "NOT_ENOUGH_SEATS": return "Il ne reste plus assez de places sur ce départ.";
    case "TRIP_NOT_AVAILABLE": return "Ce départ n'est plus disponible.";
    case "ID_DOCUMENT_REQUIRED": return "La pièce d'identité est obligatoire.";
    case "BOOKER_INFO_REQUIRED": return "Nom et téléphone du réservant requis.";
    default: return code || "Erreur lors de la réservation";
  }
}
