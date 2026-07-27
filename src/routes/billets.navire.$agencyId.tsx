import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Ship, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  fetchBoatRoutes, fetchVessels, fetchVesselServices, fetchSailings,
  computeBoatQuote, baggageIncluded, effectivePrices, formatDuration, PASSENGER_LABEL,
  type BoatRoute, type Vessel, type VesselService, type BoatSailing,
  type BoatPassengerInput, type PassengerCategory,
} from "@/lib/boat";

export const Route = createFileRoute("/billets/navire/$agencyId")({
  head: () => ({
    meta: [
      { title: "Réservation billet navire — WINA TOUR" },
      { name: "description", content: "Réservez votre traversée en navire au Gabon en quelques étapes." },
      { property: "og:title", content: "Réservation billet navire — WINA TOUR" },
      { property: "og:description", content: "Trajet, date, navire, passagers et paiement en ligne." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BoatBookingWizard,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
const card = "rounded-2xl border bg-card p-4 shadow-sm";
const labelCls = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

const STEPS = ["Trajet", "Dates", "Voyageurs", "Navire", "Passagers", "Bagages", "Récapitulatif"];

function BoatBookingWizard() {
  const { agencyId } = Route.useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);

  const [agencyName, setAgencyName] = useState("");
  const [routes, setRoutes] = useState<BoatRoute[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [services, setServices] = useState<VesselService[]>([]);
  const [sailings, setSailings] = useState<BoatSailing[]>([]);
  const [loadingSailings, setLoadingSailings] = useState(false);

  const [routeId, setRouteId] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [roundTrip, setRoundTrip] = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [sailingId, setSailingId] = useState("");
  const [passengers, setPassengers] = useState<BoatPassengerInput[]>([]);
  const [baggageKg, setBaggageKg] = useState("0");
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: ag } = await supabase
        .from("partner_agencies_public" as any)
        .select("name")
        .eq("id", agencyId)
        .maybeSingle();
      setAgencyName((ag as any)?.name ?? "Agence maritime");
      const [r, v] = await Promise.all([fetchBoatRoutes(agencyId), fetchVessels(agencyId)]);
      setRoutes(r.filter((x) => x.is_active));
      setVessels(v.filter((x) => x.is_active));
      setServices(await fetchVesselServices(v.map((x) => x.id)));
      setLoading(false);
    })();
  }, [agencyId]);

  // Départs disponibles pour le trajet + la date
  useEffect(() => {
    if (!routeId || !departureDate) { setSailings([]); return; }
    (async () => {
      setLoadingSailings(true);
      const list = await fetchSailings({ routeId, date: departureDate, vesselIds: vessels.map((v) => v.id) });
      setSailings(list.filter((s) => s.status !== "cancelled"));
      setLoadingSailings(false);
    })();
  }, [routeId, departureDate, vessels]);

  const totalTravellers = adults + children + infants;

  // Synchronise la liste des passagers avec les compteurs
  useEffect(() => {
    const build = (cat: PassengerCategory, count: number, existing: BoatPassengerInput[]) => {
      const same = existing.filter((p) => p.category === cat);
      return Array.from({ length: count }, (_, i) => same[i] ?? {
        category: cat, last_name: "", first_name: "", email: "", phone: "", id_document: "",
      });
    };
    setPassengers((prev) => [
      ...build("adult", adults, prev),
      ...build("child", children, prev),
      ...build("infant", infants, prev),
    ]);
  }, [adults, children, infants]);

  const route = routes.find((r) => r.id === routeId) ?? null;
  const sailing = sailings.find((s) => s.id === sailingId) ?? null;
  const vessel = vessels.find((v) => v.id === sailing?.vessel_id) ?? null;
  const vesselServices = useMemo(
    () => services.filter((s) => s.vessel_id === vessel?.id && s.is_active),
    [services, vessel?.id],
  );
  const selectedServices = vesselServices.filter((s) => serviceIds.includes(s.id));

  const included = baggageIncluded(vessel, adults, children);
  const declaredBags = Math.max(0, Number(baggageKg) || 0);
  const extraBags = Math.max(0, declaredBags - included);
  const prices = effectivePrices(vessel, sailing);

  const quote = useMemo(() => computeBoatQuote({
    sailing, vessel, adults, children, infants, extraBaggage: extraBags,
    feePerExtraBaggage: vessel?.baggage_fee_per_extra ?? 0,
    services: selectedServices, roundTrip,
  }), [sailing, vessel, adults, children, infants, extraBags, selectedServices, roundTrip]);

  const baggageFee = extraBags * (vessel?.baggage_fee_per_extra ?? 0);
  const total = quote.total;

  const next = () => {
    if (step === 0 && !routeId) return toast.error("Sélectionnez un trajet");
    if (step === 1 && !departureDate) return toast.error("Date de départ requise");
    if (step === 1 && roundTrip && !returnDate) return toast.error("Date de retour requise");
    if (step === 2 && totalTravellers < 1) return toast.error("Au moins un voyageur");
    if (step === 2 && adults < 1) return toast.error("Au moins un adulte accompagnant");
    if (step === 3 && !sailingId) return toast.error("Sélectionnez un navire");
    if (step === 4) {
      const invalid = passengers.some((p) => !p.last_name.trim() || !p.first_name.trim());
      if (invalid) return toast.error("Nom et prénom obligatoires pour chaque passager");
      if (!passengers[0]?.phone.trim()) return toast.error("Téléphone du voyageur principal requis");
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver");
      navigate({ to: "/connexion" });
      return;
    }
    if (!sailing || !route || total <= 0) return toast.error("Réservation incomplète");
    if (sailing.seats_available < totalTravellers) return toast.error("Plus assez de places sur ce départ");

    setSubmitting(true);
    try {
      const main = passengers[0];
      const reference_code = `BT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const passengerName = `${main.first_name.trim()} ${main.last_name.trim()}`.trim();

      const details = {
        mode: "bateau",
        reference_code,
        agency: agencyName,
        agency_id: agencyId,
        vessel: vessel?.name ?? null,
        vessel_id: vessel?.id ?? null,
        sailing_id: sailing.id,
        route_id: route.id,
        origin: route.origin,
        destination: route.destination,
        departure_date: departureDate,
        departure_time: sailing.departure_time,
        return_date: roundTrip ? returnDate : null,
        round_trip: roundTrip,
        adults, children, infants,
        passenger_name: passengerName,
        passenger_phone: main.phone.trim(),
        passenger_email: main.email.trim() || null,
        passengers: passengers.map((p) => ({
          name: `${p.first_name.trim()} ${p.last_name.trim()}`.trim(),
          category: PASSENGER_LABEL[p.category],
        })),
        baggage_kg: declaredKg,
        baggage_allowance_kg: allowance,
        baggage_extra_kg: extraKg,
        baggage_fee: baggageFee,
        services: selectedServices.map((s) => ({ label: s.name, amount: s.price })),
        quote: quote.lines,
      };

      const bookingRes = await supabase.from("partner_bookings" as any).insert({
        agency_id: agencyId,
        user_id: user.id,
        sailing_id: sailing.id,
        passenger_name: passengerName,
        passenger_phone: main.phone.trim(),
        passenger_email: main.email.trim() || null,
        seats: totalTravellers,
        total_amount: total,
        status: "pending",
        reference_code,
        departure_date: sailing.departure_date,
        baggage_count: declaredKg,
        baggage_fee: baggageFee,
        details,
      }).select("id").single();
      if (bookingRes.error) throw bookingRes.error;
      const partnerBookingId = (bookingRes.data as any).id;

      const passRes = await supabase.from("boat_passengers" as any).insert(
        passengers.map((p) => ({
          booking_id: partnerBookingId,
          category: p.category,
          last_name: p.last_name.trim(),
          first_name: p.first_name.trim(),
          email: p.email.trim() || null,
          phone: p.phone.trim() || null,
          id_document: p.id_document.trim() || null,
        })),
      );
      if (passRes.error) throw passRes.error;

      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "BILLET",
        reservation_date: sailing.departure_date,
        total_amount: total,
        paid_amount: 0,
        details: { ...details, partner_booking_id: partnerBookingId },
      }).select("id").single();
      if (error) throw error;

      toast.success("Réservation créée ! Procédez au paiement.");
      navigate({ to: "/paiement/$reservationId", params: { reservationId: data.id } });
    } catch (err: any) {
      toast.error(err.message === "INSUFFICIENT_SEATS" ? "Plus assez de places disponibles" : (err.message || "Erreur lors de la réservation"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const Counter = ({ label, hint, value, set, min = 0 }: { label: string; hint: string; value: number; set: (n: number) => void; min?: number }) => (
    <div className="flex items-center justify-between rounded-xl border px-3 py-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => set(Math.max(min, value - 1))} className="h-9 w-9 rounded-lg border text-lg font-bold">−</button>
        <span className="w-6 text-center font-bold">{value}</span>
        <button type="button" onClick={() => set(value + 1)} className="h-9 w-9 rounded-lg border text-lg font-bold">+</button>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-background pb-28">
      <div className="mx-auto max-w-2xl px-5 py-6">
        <Link to="/billets/categorie/$slug" params={{ slug: "bateau" }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          <ArrowLeft className="h-4 w-4" /> Retour aux agences
        </Link>

        <header className="mt-5">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Ship className="h-5 w-5 text-primary" /> Réservation navire
          </h1>
          <p className="text-sm text-muted-foreground">{agencyName}</p>
        </header>

        <div className="mt-5 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
              <p className={`mt-1 truncate text-[10px] ${i === step ? "font-bold text-primary" : "text-muted-foreground"}`}>{s}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          {/* 1 — Trajet */}
          {step === 0 && (
            <div className={card}>
              <h2 className="text-sm font-bold">Étape 1 — Choisir le trajet</h2>
              <div className="mt-4 grid gap-2">
                {routes.map((r) => (
                  <button key={r.id} type="button" onClick={() => { setRouteId(r.id); setSailingId(""); }}
                    className={`rounded-xl border px-3 py-3 text-left text-sm ${routeId === r.id ? "border-primary bg-primary/5 font-semibold" : ""}`}>
                    <span className="block">{r.origin} → {r.destination}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.distance_km ? `${r.distance_km} km · ` : ""}{formatDuration(r.duration_minutes)}
                    </span>
                  </button>
                ))}
                {routes.length === 0 && <p className="text-sm text-muted-foreground">Aucun trajet maritime disponible pour cette agence.</p>}
              </div>
            </div>
          )}

          {/* 2 — Dates */}
          {step === 1 && (
            <div className={card}>
              <h2 className="text-sm font-bold">Étape 2 — Choisir la date</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <span className={labelCls}>Date de départ *</span>
                  <Input type="date" className="mt-1" value={departureDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => { setDepartureDate(e.target.value); setSailingId(""); }} />
                </div>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} />
                  Aller-retour
                </label>
                {roundTrip && (
                  <div>
                    <span className={labelCls}>Date de retour *</span>
                    <Input type="date" className="mt-1" value={returnDate} min={departureDate}
                      onChange={(e) => setReturnDate(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3 — Voyageurs */}
          {step === 2 && (
            <div className={card}>
              <h2 className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4 text-primary" /> Étape 3 — Voyageurs</h2>
              <div className="mt-4 space-y-2">
                <Counter label="Adultes" hint="Plus de 12 ans" value={adults} set={setAdults} min={1} />
                <Counter label="Enfants" hint="2 à 12 ans" value={children} set={setChildren} />
                <Counter label="Bébés" hint="Moins de 2 ans" value={infants} set={setInfants} />
              </div>
            </div>
          )}

          {/* 4 — Navire */}
          {step === 3 && (
            <div className={card}>
              <h2 className="text-sm font-bold">Étape 4 — Choisir le navire</h2>
              {loadingSailings ? (
                <p className="mt-4 text-sm text-muted-foreground">Recherche des départs…</p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {sailings.map((s) => {
                    const v = vessels.find((x) => x.id === s.vessel_id);
                    const svc = services.filter((x) => x.vessel_id === s.vessel_id && x.is_active);
                    const disabled = s.seats_available < totalTravellers || s.status === "full";
                    return (
                      <button key={s.id} type="button" disabled={disabled}
                        onClick={() => { setSailingId(s.id); setServiceIds([]); }}
                        className={`rounded-2xl border p-3 text-left ${sailingId === s.id ? "border-primary bg-primary/5" : ""} ${disabled ? "opacity-50" : ""}`}>
                        <div className="flex gap-3">
                          {v?.photo_url && <img src={v.photo_url} alt={v.name} loading="lazy" className="h-16 w-20 rounded-xl object-cover" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold">{v?.name ?? "Navire"}</p>
                            <p className="text-xs text-muted-foreground">
                              Départ {s.departure_time?.slice(0, 5)} · {disabled ? "Complet" : `${s.seats_available} place(s) restante(s)`}
                            </p>
                            {svc.length > 0 && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {svc.map((x) => x.name + (x.price > 0 ? ` (${fmt(x.price)})` : "")).join(" · ")}
                              </p>
                            )}
                            <p className="mt-1 text-xs font-semibold text-primary">
                              Adulte {fmt(s.price_adult)} · Enfant {fmt(s.price_child)} · Bébé {fmt(s.price_infant)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {sailings.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucun départ programmé pour ce trajet à cette date.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 5 — Passagers */}
          {step === 4 && (
            <div className={card}>
              <h2 className="text-sm font-bold">Étape 5 — Informations passagers</h2>
              <div className="mt-4 space-y-4">
                {passengers.map((p, i) => (
                  <div key={i} className="rounded-xl border p-3">
                    <p className="text-xs font-semibold uppercase text-primary">
                      Passager {i + 1} — {PASSENGER_LABEL[p.category]}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {([
                        ["last_name", "Nom *"], ["first_name", "Prénom *"],
                        ["email", i === 0 ? "Email" : "Email (optionnel)"],
                        ["phone", i === 0 ? "Téléphone *" : "Téléphone (optionnel)"],
                        ["id_document", "Pièce d'identité (optionnel)"],
                      ] as const).map(([field, label]) => (
                        <Input key={field} placeholder={label} value={p[field]}
                          onChange={(e) => setPassengers(passengers.map((x, j) => j === i ? { ...x, [field]: e.target.value } : x))} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6 — Bagages & services */}
          {step === 5 && (
            <div className={card}>
              <h2 className="text-sm font-bold">Étape 6 — Bagages & services</h2>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                  Franchise incluse pour ce navire : <strong>{allowance} kg</strong>
                  {vessel?.fee_per_extra_kg ? ` · ${fmt(vessel.fee_per_extra_kg)} par kg supplémentaire` : ""}
                  {vessel?.baggage_conditions ? <span className="mt-1 block">{vessel.baggage_conditions}</span> : null}
                </div>
                <div>
                  <span className={labelCls}>Poids total de vos bagages (kg)</span>
                  <Input type="number" min={0} className="mt-1" value={baggageKg} onChange={(e) => setBaggageKg(e.target.value)} />
                  {extraKg > 0 && (
                    <p className="mt-1 text-xs font-semibold text-amber-600">
                      {extraKg} kg au-delà de la franchise → supplément {fmt(baggageFee)}
                    </p>
                  )}
                </div>
                {vesselServices.filter((s) => s.price > 0).length > 0 && (
                  <div>
                    <span className={labelCls}>Services additionnels</span>
                    <div className="mt-1 grid gap-2">
                      {vesselServices.filter((s) => s.price > 0).map((s) => (
                        <label key={s.id} className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 text-sm ${serviceIds.includes(s.id) ? "border-primary bg-primary/5" : ""}`}>
                          <span className="flex items-center gap-2">
                            <input type="checkbox" checked={serviceIds.includes(s.id)}
                              onChange={() => setServiceIds(serviceIds.includes(s.id) ? serviceIds.filter((x) => x !== s.id) : [...serviceIds, s.id])} />
                            {s.name}
                          </span>
                          <span className="font-semibold">{fmt(s.price)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {vesselServices.filter((s) => s.price === 0).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Inclus : {vesselServices.filter((s) => s.price === 0).map((s) => s.name).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 7 — Récapitulatif */}
          {step === 6 && (
            <div className={card}>
              <h2 className="text-sm font-bold">Étape 7 — Récapitulatif</h2>
              <dl className="mt-4 space-y-1.5 text-sm">
                {[
                  ["Agence", agencyName],
                  ["Trajet", route ? `${route.origin} → ${route.destination}` : "—"],
                  ["Navire", vessel?.name ?? "—"],
                  ["Date", `${new Date(departureDate).toLocaleDateString("fr-FR")}${sailing ? ` à ${sailing.departure_time?.slice(0, 5)}` : ""}`],
                  ...(roundTrip ? [["Retour", new Date(returnDate).toLocaleDateString("fr-FR")]] : []),
                  ["Voyageurs", `${adults} adulte(s), ${children} enfant(s), ${infants} bébé(s)`],
                  ["Voyageur principal", passengers[0] ? `${passengers[0].first_name} ${passengers[0].last_name}` : "—"],
                  ["Bagages", `${declaredKg} kg (franchise ${allowance} kg)`],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-3 border-b pb-1.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 space-y-1.5 rounded-xl border-2 border-primary/20 bg-primary/5 p-3 text-sm">
                {quote.lines.map((l, i) => (
                  <div key={i} className="flex justify-between"><span className="text-muted-foreground">{l.label}</span><span>{fmt(l.amount)}</span></div>
                ))}
                <div className="flex justify-between border-t pt-1.5 text-base font-extrabold text-primary">
                  <span>Montant total</span><span>{fmt(total)}</span>
                </div>
              </div>
              <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs font-medium text-amber-700">
                Après paiement, votre billet est traité sous 24 h. Un reçu PDF WINA TOUR vous est remis immédiatement.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting}
            className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-40">
            Retour
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
              Continuer <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={submitting || total <= 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Payer {fmt(total)}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
