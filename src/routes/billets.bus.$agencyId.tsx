import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, Bus, CalendarDays, CheckCircle2, Loader2, Minus, Package, Plus, ShieldCheck, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AgencyLogo } from "@/components/AgencyLogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  computeCounterTotal, createBusReservationRequest, fetchBusTrips, fmtXAF, formatDateFR,
  toISODate, tripDateOptions, uploadBusDocument, type BusTrip,
} from "@/lib/bus";

export const Route = createFileRoute("/billets/bus/$agencyId")({
  head: () => ({
    meta: [
      { title: "Réserver un billet de bus — Wina Tour" },
      { name: "description", content: "Choisissez votre voyage, votre date de départ et envoyez votre demande de réservation de bus au Gabon." },
      { property: "og:title", content: "Réserver un billet de bus — Wina Tour" },
      { property: "og:description", content: "Voyages programmés, tarifs par tranche d'âge et bagages : réservez votre bus en quelques minutes." },
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

  const [trip, setTrip] = useState<BusTrip | null>(null);
  const [travelDate, setTravelDate] = useState("");
  const [adults, setAdults] = useState(1);
  const children = 0;
  const [infants, setInfants] = useState(0);
  const [baggageCount, setBaggageCount] = useState(0);
  const [baggageNotes, setBaggageNotes] = useState("");
  const [bookerName, setBookerName] = useState("");
  const [bookerPhone, setBookerPhone] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: ag }, tr] = await Promise.all([
          supabase.from("partner_agencies_public" as any)
            .select("id, name, logo_url, description, is_verified, accepts_parcel, accepts_funeral")
            .eq("id", agencyId).maybeSingle(),
          fetchBusTrips(agencyId),
        ]);
        setAgency((ag as any) ?? null);
        const today = toISODate(new Date());
        setTrips(tr.filter((t) => t.status === "available" && t.seats_available > 0 && (t.date_end ?? t.departure_date) >= today));
      } catch {
        toast.error("Impossible de charger les voyages de cette agence.");
      } finally {
        setLoading(false);
      }
    })();
  }, [agencyId]);

  const dateOptions = useMemo(() => (trip ? tripDateOptions(trip) : []), [trip]);
  const totals = useMemo(
    () => computeCounterTotal(trip, { adults, children, infants }, baggageCount),
    [trip, adults, children, infants, baggageCount],
  );
  const seats = adults + children;

  const selectTrip = (t: BusTrip) => {
    setTrip(t);
    const opts = tripDateOptions(t);
    setTravelDate(opts[0] ?? "");
  };

  const submit = async () => {
    if (!trip) return;
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver");
      navigate({ to: "/connexion" });
      return;
    }
    if (!travelDate) return toast.error("Choisissez votre date de voyage");
    if (seats < 1) return toast.error("Au moins un voyageur (adulte ou enfant) est requis");
    if (seats > trip.seats_available) return toast.error("Places insuffisantes sur ce voyage");
    if (!bookerName.trim()) return toast.error("Nom complet du réservant requis");
    if (!bookerPhone.trim()) return toast.error("Numéro de téléphone requis");
    if (!idFile) return toast.error("La pièce d'identité est obligatoire");

    setSubmitting(true);
    try {
      const path = await uploadBusDocument(user.id, idFile);
      const res = await createBusReservationRequest({
        tripId: trip.id,
        travelDate,
        adults,
        children,
        infants,
        baggageCount,
        baggageNotes: baggageNotes.trim(),
        bookerName: bookerName.trim(),
        bookerPhone: bookerPhone.trim(),
        idDocumentUrl: path,
      });
      toast.success(`Demande envoyée — référence ${res.reference_code}`);
      navigate({ to: "/mes-reservations" });
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible d'envoyer la demande");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 pb-28 sm:px-5">
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
            <p className="text-sm text-muted-foreground">{trips.length} voyage(s) programmé(s)</p>
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
        ) : trips.length === 0 ? (
          <div className="mt-8 rounded-2xl border bg-card p-10 text-center">
            <Bus className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">Aucun voyage programmé pour le moment chez cette agence.</p>
          </div>
        ) : (
          <>
            {/* Étape 1 — voyage */}
            <section className="mt-6 rounded-2xl border bg-card p-4 sm:p-5">
              <h2 className="text-sm font-bold">1. Choisissez votre voyage</h2>
              <div className="mt-3 grid gap-2">
                {trips.map((t) => (
                  <button key={t.id} type="button" onClick={() => selectTrip(t)}
                    className={`rounded-xl border p-3 text-left transition ${trip?.id === t.id ? "border-primary bg-primary/5" : "hover:bg-secondary/50"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                        <Bus className="h-4 w-4 text-primary" /> {t.origin} → {t.destination}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">{t.seats_available} place(s)</span>
                    </div>
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Du {formatDateFR(t.date_start ?? t.departure_date)} au {formatDateFR(t.date_end ?? t.departure_date)}
                      {t.bus_type ? ` · ${t.bus_type}` : ""}
                    </p>
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <span>Adulte (6 ans et +) : <b className="text-foreground">{fmtXAF(t.price_adult)}</b></span>
                      <span>Bébé 0–5 : <b className="text-foreground">{fmtXAF(t.price_child_0_6)}</b></span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {trip && (
              <>
                {/* Étape 2 — date */}
                <section className="mt-4 rounded-2xl border bg-card p-4 sm:p-5">
                  <h2 className="text-sm font-bold">2. Votre date de voyage</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Choisissez n'importe quel jour de la période programmée par l'agence.</p>
                  <select value={travelDate} onChange={(e) => setTravelDate(e.target.value)}
                    className="mt-3 h-11 w-full rounded-xl border bg-background px-3 text-sm">
                    {dateOptions.length === 0 && <option value="">Aucune date disponible</option>}
                    {dateOptions.map((d) => <option key={d} value={d}>{formatDateFR(d)}</option>)}
                  </select>
                </section>

                {/* Étape 3 — voyageurs */}
                <section className="mt-4 rounded-2xl border bg-card p-4 sm:p-5">
                  <h2 className="inline-flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4" /> 3. Voyageurs</h2>
                  <div className="mt-3 space-y-2">
                    <Counter label="Adultes" hint="6 ans et +" value={adults} min={0} onChange={setAdults} />
                    <Counter label="Bébés" hint="0 à 5 ans" value={infants} min={0} onChange={setInfants} />
                  </div>
                </section>

                {/* Étape 4 — bagages */}
                <section className="mt-4 rounded-2xl border bg-card p-4 sm:p-5">
                  <h2 className="text-sm font-bold">4. Bagages</h2>
                  <div className="mt-3">
                    <Counter label="Nombre de bagages" hint={`${trip.baggage_included_kg} kg inclus par voyageur`} value={baggageCount} min={0} onChange={setBaggageCount} />
                  </div>
                  <Input className="mt-3" placeholder="Précisions sur vos bagages (facultatif)" value={baggageNotes}
                    onChange={(e) => setBaggageNotes(e.target.value.slice(0, 300))} />
                  {trip.baggage_conditions && (
                    <div className="mt-3 whitespace-pre-line rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
                      <b className="text-foreground">Conditions de bagages : </b>{trip.baggage_conditions}
                    </div>
                  )}
                </section>

                {/* Étape 5 — réservant */}
                <section className="mt-4 rounded-2xl border bg-card p-4 sm:p-5">
                  <h2 className="text-sm font-bold">5. Informations du réservant</h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Input placeholder="Nom complet" value={bookerName} onChange={(e) => setBookerName(e.target.value.slice(0, 120))} />
                    <Input placeholder="Numéro de téléphone" value={bookerPhone} onChange={(e) => setBookerPhone(e.target.value.slice(0, 30))} />
                  </div>
                  <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3 text-sm">
                    <Upload className="h-4 w-4 text-primary" />
                    <span className="flex-1 truncate">{idFile ? idFile.name : "Pièce d'identité (obligatoire) — photo ou PDF"}</span>
                    <input type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
                    <span className="rounded-lg border px-2 py-1 text-xs font-semibold">Choisir</span>
                  </label>
                </section>

                {/* Étape 6 — récapitulatif */}
                <section className="mt-4 rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 sm:p-5">
                  <h2 className="text-sm font-bold">6. Récapitulatif</h2>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <Row label="Agence" value={agency?.name ?? "—"} />
                    <Row label="Trajet" value={`${trip.origin} → ${trip.destination}`} />
                    <Row label="Date de voyage" value={travelDate ? formatDateFR(travelDate) : "—"} />
                    <Row label="Voyageurs" value={`${adults} adulte(s) · ${children} enfant(s) · ${infants} bébé(s)`} />
                    <Row label="Bagages" value={`${baggageCount}`} />
                    <div className="my-2 border-t" />
                    <Row label="Total des billets" value={fmtXAF(totals.ticketsTotal)} />
                    <Row
                      label="Supplément bagages"
                      value={totals.extraBags > 0 ? `${totals.extraBags} bagage(s) — confirmé par l'agence` : "Inclus"}
                    />

                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="font-bold">Total estimé</span>
                      <span className="text-lg font-bold text-primary">{fmtXAF(totals.total)}</span>
                    </div>
                  </div>
                  <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700">
                    Votre demande sera <b>en attente</b> jusqu'à validation par l'administration. Le billet définitif (heure de départ,
                    convocation, sièges) sera ensuite disponible dans « Mes réservations ».
                  </p>
                  <Button className="mt-4 h-12 w-full" disabled={submitting} onClick={() => void submit()}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Envoyer ma demande de réservation
                  </Button>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Counter({ label, hint, value, min, onChange }: { label: string; hint?: string; value: number; min: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Retirer ${label}`} onClick={() => onChange(Math.max(value - 1, min))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border"><Minus className="h-4 w-4" /></button>
        <span className="w-6 text-center text-sm font-bold">{value}</span>
        <button type="button" aria-label={`Ajouter ${label}`} onClick={() => onChange(Math.min(value + 1, 30))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
