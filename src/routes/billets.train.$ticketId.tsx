import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Calendar, Check, Loader2, MapPin, Plus, TrainFront, Upload, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { randomId } from "@/lib/random-id";
import {
  fetchTrainReference, fetchTicketClassPrices, fetchTrainRoutes, computeTrainQuote,
  stationsForTrainType, baggageRuleForType, computeBaggageFee,
  ID_DOCUMENT_TYPES, CHILD_MIN_AGE, CHILD_MAX_AGE,
  type TrainType, type TrainStation, type TrainClass, type TrainDiscountRule,
  type TrainTicketClass, type TrainRoute, type TrainRouteStation, type TrainBaggageRule,
} from "@/lib/train";

export const Route = createFileRoute("/billets/train/$ticketId")({
  head: () => ({
    meta: [
      { title: "Réservation billet de train — WINA TOUR" },
      { name: "description", content: "Réservez votre billet de train au Gabon en quelques étapes." },
    ],
  }),
  component: TrainBookingWizard,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

const STEPS = [
  "Voyage", "Gares", "Voyageur", "Bagages", "Enfants", "Réduction", "Récapitulatif",
];

type Ticket = {
  id: string;
  agency_id: string;
  title: string;
  price: number;
  train_type_id: string | null;
  description: string | null;
};

type Child = { first_name: string; last_name: string; age: string };

function TrainBookingWizard() {
  const { ticketId } = Route.useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [types, setTypes] = useState<TrainType[]>([]);
  const [stations, setStations] = useState<TrainStation[]>([]);
  const [classes, setClasses] = useState<TrainClass[]>([]);
  const [discounts, setDiscounts] = useState<TrainDiscountRule[]>([]);
  const [classPrices, setClassPrices] = useState<TrainTicketClass[]>([]);
  const [routes, setRoutes] = useState<TrainRoute[]>([]);
  const [routeStations, setRouteStations] = useState<TrainRouteStation[]>([]);
  const [baggageRules, setBaggageRules] = useState<TrainBaggageRule[]>([]);

  // Étape 1
  const [classId, setClassId] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  // Étape 2
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  // Étape 3
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [docType, setDocType] = useState<string>(ID_DOCUMENT_TYPES[0].value);
  const [docNumber, setDocNumber] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  // Étape 4
  const [hasBaggage, setHasBaggage] = useState(false);
  const [baggageCount, setBaggageCount] = useState("1");
  // Étape 5
  const [hasChildren, setHasChildren] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  // Étape 6
  const [mainAge, setMainAge] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: t } = await supabase
        .from("partner_tickets" as any)
        .select("id, agency_id, title, price, train_type_id, description")
        .eq("id", ticketId)
        .maybeSingle();
      const tk = (t as any) as Ticket | null;
      setTicket(tk);
      if (tk) {
        const { data: ag } = await supabase
          .from("partner_agencies_public" as any)
          .select("name")
          .eq("id", tk.agency_id)
          .maybeSingle();
        setAgencyName((ag as any)?.name ?? "");
        setClassPrices(await fetchTicketClassPrices([tk.id]));
      }
      const ref = await fetchTrainReference();
      setTypes(ref.types);
      setStations(ref.stations);
      setClasses(ref.classes.filter((c) => c.is_active));
      setDiscounts(ref.discounts.filter((d) => d.is_active));
      const r = await fetchTrainRoutes();
      setRoutes(r.routes);
      setRouteStations(r.routeStations);
      setBaggageRules(r.baggageRules);
      setLoading(false);
    })();
  }, [ticketId]);

  const trainType = useMemo(
    () => types.find((t) => t.id === ticket?.train_type_id),
    [types, ticket],
  );

  const availableClasses = useMemo(() => {
    if (!ticket) return [] as { id: string; name: string; price: number }[];
    return classes
      .map((c) => ({
        id: c.id,
        name: c.name,
        price: classPrices.find((p) => p.ticket_id === ticket.id && p.class_id === c.id)?.price ?? ticket.price,
      }))
      .filter((c) => c.price > 0);
  }, [ticket, classes, classPrices]);

  const servedStations = useMemo(
    () => stationsForTrainType(trainType, stations, routes, routeStations),
    [trainType, stations, routes, routeStations],
  );

  const baggageRule = useMemo(() => baggageRuleForType(trainType, baggageRules), [trainType, baggageRules]);
  const baggageNum = hasBaggage ? Math.max(0, Number(baggageCount) || 0) : 0;
  const baggageFee = useMemo(() => computeBaggageFee(baggageRule, baggageNum), [baggageRule, baggageNum]);

  const unitPrice = availableClasses.find((c) => c.id === classId)?.price ?? ticket?.price ?? 0;
  const childAges = children.map((c) => Number(c.age)).filter((n) => !Number.isNaN(n));
  const quote = useMemo(
    () => computeTrainQuote(unitPrice, mainAge === "" ? null : Number(mainAge), childAges, discounts),
    [unitPrice, mainAge, children, discounts],
  );
  const total = quote.total + baggageFee;

  const stationName = (id: string) => stations.find((s) => s.id === id)?.name ?? "—";
  const className = availableClasses.find((c) => c.id === classId)?.name ?? "";
  const docLabel = ID_DOCUMENT_TYPES.find((d) => d.value === docType)?.label ?? "";

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!classId) return "Sélectionnez une classe de voyage";
      if (!departureDate) return "Sélectionnez la date de départ";
    }
    if (s === 1) {
      if (!fromId) return "Sélectionnez la gare de départ";
      if (!toId) return "Sélectionnez la gare d'arrivée";
      if (fromId === toId) return "Les gares de départ et d'arrivée doivent être différentes";
    }
    if (s === 2) {
      if (!lastName.trim()) return "Nom requis";
      if (!firstName.trim()) return "Prénom requis";
      if (!phone.trim()) return "Téléphone requis";
      if (!email.trim()) return "Email requis";
      if (!docFile) return "Téléversez votre pièce d'identification";
    }
    if (s === 3 && hasBaggage) {
      if (baggageNum < 1) return "Indiquez le nombre de bagages";
      if (baggageRule && baggageNum > baggageRule.max_count) return `Maximum ${baggageRule.max_count} bagages`;
    }
    if (s === 4 && hasChildren) {
      if (children.length === 0) return "Ajoutez au moins un enfant";
      for (const c of children) {
        if (!c.last_name.trim() || !c.first_name.trim()) return "Nom et prénom requis pour chaque enfant";
        const age = Number(c.age);
        if (Number.isNaN(age) || age < CHILD_MIN_AGE || age > CHILD_MAX_AGE)
          return `La tranche d'âge enfant est limitée à ${CHILD_MIN_AGE} – ${CHILD_MAX_AGE} ans`;
      }
    }
    if (s === 5 && mainAge === "") return "Indiquez l'âge du voyageur principal";
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) return toast.error(err);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = async () => {
    if (!ticket) return;
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver");
      navigate({ to: "/connexion" });
      return;
    }
    for (let s = 0; s < 6; s++) {
      const err = validateStep(s);
      if (err) { setStep(s); return toast.error(err); }
    }
    setSubmitting(true);
    try {
      // 1) Pièce d'identité (bucket privé)
      let docPath: string | null = null;
      if (docFile) {
        const ext = docFile.name.split(".").pop() || "jpg";
        docPath = `${user.id}/${randomId("doc")}.${ext}`;
        const up = await supabase.storage.from("train-documents").upload(docPath, docFile, { upsert: false });
        if (up.error) throw up.error;
      }

      const reference_code = `TR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const passengerName = `${firstName.trim()} ${lastName.trim()}`;
      const trainDetails = {
        train_booking: true,
        train_type: trainType?.name ?? "",
        travel_class: className,
        travel_class_id: classId,
        departure_date: departureDate,
        station_from: stationName(fromId),
        station_to: stationName(toId),
        id_document_type: docType,
        id_document_label: docLabel,
        id_document_number: docNumber.trim() || null,
        id_document_path: docPath,
        baggage_count: baggageNum,
        baggage_fee: baggageFee,
        children: children.map((c) => ({ name: `${c.first_name.trim()} ${c.last_name.trim()}`, age: Number(c.age) })),
        main_traveller_age: Number(mainAge),
        gross_total: quote.grossTotal,
        discount_total: quote.discountTotal,
        discounts: quote.discountLines,
        agency: agencyName,
      };

      const bookingRes = await supabase.from("partner_bookings" as any).insert({
        agency_id: ticket.agency_id,
        ticket_id: ticket.id,
        user_id: user.id,
        passenger_name: passengerName,
        passenger_phone: phone.trim(),
        passenger_email: email.trim(),
        seats: quote.travellers,
        total_amount: total,
        status: "pending",
        reference_code,
        departure_date: departureDate,
        station_from_id: fromId,
        station_to_id: toId,
        travel_class_id: classId,
        baggage_count: baggageNum,
        baggage_fee: baggageFee,
        details: { title: ticket.title, unit_price: unitPrice, ...trainDetails },
      }).select("id").single();
      if (bookingRes.error) throw bookingRes.error;
      const bookingId = (bookingRes.data as any).id;

      await supabase.from("train_passengers" as any).insert({
        booking_id: bookingId,
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        age: Number(mainAge),
        id_document_type: docType,
        id_document_number: docNumber.trim() || null,
        id_document_url: docPath,
      });

      if (children.length > 0) {
        await supabase.from("train_children" as any).insert(
          children.map((c) => ({
            booking_id: bookingId,
            last_name: c.last_name.trim(),
            first_name: c.first_name.trim(),
            age: Number(c.age),
          })),
        );
      }

      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "BILLET",
        reservation_date: departureDate,
        total_amount: total,
        paid_amount: 0,
        details: {
          partner_ticket_id: ticket.id,
          partner_booking_id: bookingId,
          reference_code,
          title: ticket.title,
          agency_id: ticket.agency_id,
          passenger_name: passengerName,
          passenger_phone: phone.trim(),
          passenger_email: email.trim(),
          origin: stationName(fromId),
          destination: stationName(toId),
          unit_price: unitPrice,
          quantity: quote.travellers,
          ...trainDetails,
          quote: [
            { label: `${ticket.title} — ${className} × ${quote.travellers}`, amount: quote.grossTotal },
            ...quote.discountLines.map((l) => ({ label: l.label, amount: -l.amount })),
            ...(baggageFee > 0 ? [{ label: `Bagages (${baggageNum})`, amount: baggageFee }] : []),
          ],
        },
      }).select("id").single();
      if (error) throw error;

      toast.success("Réservation enregistrée — procédez au paiement.");
      navigate({ to: "/paiement/$reservationId", params: { reservationId: data.id } });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="min-h-screen bg-background"><p className="p-10 text-center text-sm text-muted-foreground">Chargement…</p></main>;
  }

  if (!ticket) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">Billet introuvable.</p>
          <Link to="/billets" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            <ArrowLeft className="h-4 w-4" /> Retour aux billets
          </Link>
        </div>
      </main>
    );
  }

  const card = "rounded-3xl border bg-card p-5 shadow-sm";
  const labelCls = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  const selectCls = "mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";

  return (
    <main className="min-h-screen bg-background pb-28">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <Link
          to="/billets/agence/$agencyId"
          params={{ agencyId: ticket.agency_id }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Retour aux billets
        </Link>

        <header className="mt-5">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <TrainFront className="h-5 w-5 text-primary" /> {ticket.title}
          </h1>
          <p className="text-sm text-muted-foreground">{agencyName} · {trainType?.name ?? "Train"}</p>
        </header>

        {/* Progression */}
        <div className="mt-5 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
              <p className={`mt-1 truncate text-[10px] ${i === step ? "font-bold text-primary" : "text-muted-foreground"}`}>{s}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          {/* Étape 1 */}
          {step === 0 && (
            <div className={card}>
              <h2 className="text-sm font-bold">Étape 1 — Votre voyage</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <span className={labelCls}>Agence</span>
                  <p className="mt-1 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm font-semibold">{agencyName}</p>
                </div>
                <div>
                  <span className={labelCls}>Type de train</span>
                  <p className="mt-1 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm font-semibold">{trainType?.name ?? "—"}</p>
                </div>
                <div>
                  <span className={labelCls}>Classe *</span>
                  <div className="mt-1 grid gap-2">
                    {availableClasses.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setClassId(c.id)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm ${classId === c.id ? "border-primary bg-primary/5 font-semibold" : ""}`}
                      >
                        <span>{c.name}</span>
                        <span className="font-bold text-primary">{fmt(c.price)}</span>
                      </button>
                    ))}
                    {availableClasses.length === 0 && (
                      <p className="text-xs text-muted-foreground">Aucune classe configurée pour ce billet.</p>
                    )}
                  </div>
                </div>
                <div>
                  <span className={labelCls}>Date de départ *</span>
                  <Input
                    type="date"
                    className="mt-1"
                    min={new Date().toISOString().slice(0, 10)}
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Les horaires de départ sont fixés par l'agence.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Étape 2 */}
          {step === 1 && (
            <div className={card}>
              <h2 className="text-sm font-bold">Étape 2 — Gares</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Seules les gares desservies par « {trainType?.name ?? "ce train"} » sont proposées.
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <span className={labelCls}>Gare de départ *</span>
                  <select className={selectCls} value={fromId} onChange={(e) => setFromId(e.target.value)}>
                    <option value="">Sélectionner…</option>
                    {servedStations.map((s) => <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <span className={labelCls}>Gare d'arrivée *</span>
                  <select className={selectCls} value={toId} onChange={(e) => setToId(e.target.value)}>
                    <option value="">Sélectionner…</option>
                    {servedStations.filter((s) => s.id !== fromId).map((s) => <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ""}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Étape 3 */}
          {step === 2 && (
            <div className={card}>
              <h2 className="text-sm font-bold">Étape 3 — Informations du voyageur</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <span className={labelCls}>Nom *</span>
                  <Input className="mt-1" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div>
                  <span className={labelCls}>Prénom *</span>
                  <Input className="mt-1" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <span className={labelCls}>Téléphone *</span>
                  <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+241…" />
                </div>
                <div>
                  <span className={labelCls}>Email *</span>
                  <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <span className={labelCls}>Pièce d'identification *</span>
                  <select className={selectCls} value={docType} onChange={(e) => setDocType(e.target.value)}>
                    {ID_DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <span className={labelCls}>Numéro du document</span>
                  <Input className="mt-1" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <span className={labelCls}>Document téléversé *</span>
                  <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm">
                    <Upload className="h-4 w-4 text-primary" />
                    <span className="truncate">{docFile ? docFile.name : "Choisir une photo ou un PDF"}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <p className="mt-1 text-[11px] text-muted-foreground">Document confidentiel, visible uniquement par vous et l'administration.</p>
                </div>
              </div>
            </div>
          )}

          {/* Étape 4 */}
          {step === 3 && (
            <div className={card}>
              <h2 className="text-sm font-bold">Étape 4 — Bagages</h2>
              <div className="mt-3 flex gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setHasBaggage(v)}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm ${hasBaggage === v ? "border-primary bg-primary/5 font-semibold" : ""}`}
                  >
                    {v ? "Oui" : "Non"}
                  </button>
                ))}
              </div>
              {hasBaggage && (
                <div className="mt-4 space-y-3">
                  <div>
                    <span className={labelCls}>Nombre de bagages *</span>
                    <Input type="number" min={1} max={baggageRule?.max_count ?? 10} className="mt-1"
                      value={baggageCount} onChange={(e) => setBaggageCount(e.target.value)} />
                  </div>
                  {baggageRule ? (
                    <div className="rounded-xl border bg-muted/40 p-3 text-xs">
                      <p className="font-semibold">{baggageRule.label}</p>
                      {baggageRule.conditions && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{baggageRule.conditions}</p>}
                      <p className="mt-2 text-muted-foreground">
                        {baggageRule.free_count} bagage(s) inclus · {fmt(baggageRule.fee_per_extra)} par bagage supplémentaire
                      </p>
                      <p className="mt-1 font-bold text-primary">Frais supplémentaires : {fmt(baggageFee)}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucune règle de bagages définie — aucun frais appliqué.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Étape 5 */}
          {step === 4 && (
            <div className={card}>
              <h2 className="text-sm font-bold">Étape 5 — Enfants</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">Voyagez-vous avec des enfants ({CHILD_MIN_AGE} à {CHILD_MAX_AGE} ans) ?</p>
              <div className="mt-3 flex gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => { setHasChildren(v); if (v && children.length === 0) setChildren([{ first_name: "", last_name: "", age: "" }]); if (!v) setChildren([]); }}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm ${hasChildren === v ? "border-primary bg-primary/5 font-semibold" : ""}`}
                  >
                    {v ? "Oui" : "Non"}
                  </button>
                ))}
              </div>
              {hasChildren && (
                <div className="mt-4 space-y-3">
                  {children.map((c, i) => (
                    <div key={i} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold">Enfant {i + 1}</p>
                        <button type="button" onClick={() => setChildren(children.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <Input placeholder="Nom" value={c.last_name}
                          onChange={(e) => setChildren(children.map((x, j) => j === i ? { ...x, last_name: e.target.value } : x))} />
                        <Input placeholder="Prénom" value={c.first_name}
                          onChange={(e) => setChildren(children.map((x, j) => j === i ? { ...x, first_name: e.target.value } : x))} />
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={c.age}
                          onChange={(e) => setChildren(children.map((x, j) => j === i ? { ...x, age: e.target.value } : x))}
                        >
                          <option value="">Tranche d'âge</option>
                          {Array.from({ length: CHILD_MAX_AGE - CHILD_MIN_AGE + 1 }, (_, k) => CHILD_MIN_AGE + k).map((a) => (
                            <option key={a} value={a}>{a} ans</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setChildren([...children, { first_name: "", last_name: "", age: "" }])}
                    className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold">
                    <Plus className="h-3.5 w-3.5" /> Ajouter un enfant
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Étape 6 */}
          {step === 5 && (
            <div className={card}>
              <h2 className="text-sm font-bold">Étape 6 — Réduction</h2>
              <div className="mt-3">
                <span className={labelCls}>Âge du voyageur principal *</span>
                <Input type="number" min={0} className="mt-1" value={mainAge} onChange={(e) => setMainAge(e.target.value)} placeholder="ex : 57" />
              </div>
              <div className="mt-4 space-y-1.5 rounded-xl border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Prix normal</span><span>{fmt(quote.grossTotal)}</span></div>
                {quote.discountLines.map((d, i) => (
                  <div key={i} className="flex justify-between text-primary"><span>{d.label}</span><span>− {fmt(d.amount)}</span></div>
                ))}
                {baggageFee > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Bagages</span><span>{fmt(baggageFee)}</span></div>
                )}
                <div className="flex justify-between border-t pt-1.5 font-extrabold text-primary"><span>Prix final</span><span>{fmt(total)}</span></div>
              </div>
            </div>
          )}

          {/* Étape 7 */}
          {step === 6 && (
            <div className={card}>
              <h2 className="text-sm font-bold">Étape 7 — Récapitulatif</h2>
              <dl className="mt-4 space-y-2 text-sm">
                {[
                  ["Agence", agencyName],
                  ["Train", trainType?.name ?? "—"],
                  ["Classe", className],
                  ["Date", departureDate ? new Date(departureDate).toLocaleDateString("fr-FR") : "—"],
                  ["Départ", stationName(fromId)],
                  ["Arrivée", stationName(toId)],
                  ["Voyageur", `${firstName} ${lastName} · ${mainAge} ans`],
                  ["Contact", `${phone}${email ? ` · ${email}` : ""}`],
                  ["Pièce d'identité", docLabel],
                  ["Enfants", children.length ? children.map((c) => `${c.first_name} ${c.last_name} (${c.age} ans)`).join(", ") : "Aucun"],
                  ["Bagages", hasBaggage ? `${baggageNum} · ${fmt(baggageFee)}` : "Aucun"],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-3 border-b pb-1.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v as string}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 space-y-1.5 rounded-xl border-2 border-primary/20 bg-primary/5 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Prix normal</span><span>{fmt(quote.grossTotal)}</span></div>
                {quote.discountLines.map((d, i) => (
                  <div key={i} className="flex justify-between text-primary"><span>{d.label}</span><span>− {fmt(d.amount)}</span></div>
                ))}
                {baggageFee > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Frais de bagages</span><span>{fmt(baggageFee)}</span></div>
                )}
                <div className="flex justify-between border-t pt-1.5 text-base font-extrabold text-primary">
                  <span>Montant total</span><span>{fmt(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || submitting}
            className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-40"
          >
            Retour
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
              Continuer <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={submitting}
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
