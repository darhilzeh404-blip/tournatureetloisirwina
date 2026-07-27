import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, Calendar, MapPin, Minus, Plus, Loader2, TrainFront, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { AgencyLogo } from "@/components/AgencyLogo";
import {
  fetchTrainReference, fetchTicketClassPrices, computeTrainQuote,
  type TrainClass, type TrainDiscountRule, type TrainType, type TrainTicketClass,
} from "@/lib/train";

export const Route = createFileRoute("/billets/agence/$agencyId")({
  component: AgencyTicketsPage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

type Agency = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  category: string | null;
  is_verified: boolean;
};

type Ticket = {
  id: string;
  title: string;
  origin: string | null;
  destination: string | null;
  departure_at: string | null;
  price: number;
  description: string;
  image_url: string | null;
  train_type_id: string | null;
};

function AgencyTicketsPage() {
  const { agencyId } = Route.useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [booking, setBooking] = useState<Ticket | null>(null);
  const [qty, setQty] = useState(1);
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [passengerEmail, setPassengerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Train
  const [trainTypes, setTrainTypes] = useState<TrainType[]>([]);
  const [trainClasses, setTrainClasses] = useState<TrainClass[]>([]);
  const [discountRules, setDiscountRules] = useState<TrainDiscountRule[]>([]);
  const [classPrices, setClassPrices] = useState<TrainTicketClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [mainAge, setMainAge] = useState<string>("");
  const [childrenAges, setChildrenAges] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const aRes = await supabase
        .from("partner_agencies_public" as any)
        .select("id, name, logo_url, description, category, is_verified")
        .eq("id", agencyId)
        .maybeSingle();
      const ag: Agency | null = (aRes.data as any) ?? null;
      setAgency(ag);

      const tRes = await supabase
        .from("partner_tickets" as any)
        .select("id, title, origin, destination, departure_at, price, description, image_url, train_type_id")
        .eq("agency_id", agencyId)
        .eq("is_active", true)
        .order("departure_at", { ascending: true, nullsFirst: false });
      const list = ((tRes.data as any) ?? []) as Ticket[];
      setTickets(list);

      const ref = await fetchTrainReference();
      setTrainTypes(ref.types);
      setTrainClasses(ref.classes.filter((c) => c.is_active));
      setDiscountRules(ref.discounts.filter((d) => d.is_active));
      setClassPrices(await fetchTicketClassPrices(list.map((t) => t.id)));

      setLoading(false);
    })();
  }, [agencyId]);

  const filtered = useMemo(() => tickets.filter((t) => {
    if (minPrice && t.price < Number(minPrice)) return false;
    if (maxPrice && t.price > Number(maxPrice)) return false;
    if (dateFilter && t.departure_at) {
      const d = new Date(t.departure_at).toISOString().slice(0, 10);
      if (d !== dateFilter) return false;
    }
    return true;
  }), [tickets, minPrice, maxPrice, dateFilter]);

  const isTrainTicket = (t: Ticket | null) => !!t?.train_type_id;
  const trainTypeName = (id: string | null) => trainTypes.find((x) => x.id === id)?.name ?? "";

  const bookingClasses = useMemo(() => {
    if (!booking) return [] as { id: string; name: string; price: number }[];
    return trainClasses
      .map((c) => {
        const row = classPrices.find((p) => p.ticket_id === booking.id && p.class_id === c.id);
        return { id: c.id, name: c.name, price: row?.price ?? booking.price };
      })
      .filter((c) => c.price > 0);
  }, [booking, trainClasses, classPrices]);

  const unitPrice = useMemo(() => {
    if (!booking) return 0;
    if (!isTrainTicket(booking)) return booking.price;
    const sel = bookingClasses.find((c) => c.id === selectedClassId);
    return sel?.price ?? booking.price;
  }, [booking, bookingClasses, selectedClassId]);

  const trainQuote = useMemo(() => computeTrainQuote(
    unitPrice,
    mainAge === "" ? null : Number(mainAge),
    childrenAges.filter((a) => a !== "").map((a) => Number(a)),
    discountRules,
  ), [unitPrice, mainAge, childrenAges, discountRules]);

  const total = booking && isTrainTicket(booking) ? trainQuote.total : unitPrice * qty;
  const seats = booking && isTrainTicket(booking) ? trainQuote.travellers : qty;

  const openBooking = (t: Ticket) => {
    // Les billets de train suivent le parcours dédié en 7 étapes
    if (t.train_type_id) {
      navigate({ to: "/billets/train/$ticketId", params: { ticketId: t.id } });
      return;
    }
    setBooking(t);
    setQty(1);
    setMainAge("");
    setChildrenAges([]);
    const first = trainClasses
      .map((c) => ({ id: c.id, price: classPrices.find((p) => p.ticket_id === t.id && p.class_id === c.id)?.price ?? t.price }))
      .find((c) => c.price > 0);
    setSelectedClassId(first?.id ?? "");
  };


  const confirmBooking = async () => {
    if (!booking) return;
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver un billet");
      navigate({ to: "/connexion" });
      return;
    }
    if (!passengerName.trim()) return toast.error("Nom du passager requis");
    if (!passengerPhone.trim()) return toast.error("Téléphone requis");
    const train = isTrainTicket(booking);
    if (train && !selectedClassId) return toast.error("Classe de voyage requise");
    if (train && mainAge === "") return toast.error("Âge du voyageur principal requis");
    if (train && childrenAges.some((a) => a === "")) return toast.error("Âge de chaque enfant requis");

    setSubmitting(true);
    try {
      const reference_code = `BK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const className = bookingClasses.find((c) => c.id === selectedClassId)?.name ?? null;
      const quoteLines = train
        ? [
            { label: `${booking.title} — ${className} × ${trainQuote.travellers}`, amount: trainQuote.grossTotal },
            ...trainQuote.discountLines.map((l) => ({ label: l.label, amount: -l.amount })),
          ]
        : [{ label: `${booking.title} × ${qty}`, amount: total }];

      const trainDetails = train
        ? {
            train_type: trainTypeName(booking.train_type_id),
            travel_class: className,
            travel_class_id: selectedClassId,
            main_traveller_age: Number(mainAge),
            children_ages: childrenAges.map((a) => Number(a)),
            gross_total: trainQuote.grossTotal,
            discount_total: trainQuote.discountTotal,
            discounts: trainQuote.discountLines,
          }
        : {};

      // 1) Enregistrement métier dans partner_bookings (visible côté admin)
      const bookingRes = await supabase.from("partner_bookings" as any).insert({
        agency_id: agencyId,
        ticket_id: booking.id,
        user_id: user.id,
        passenger_name: passengerName.trim(),
        passenger_phone: passengerPhone.trim(),
        passenger_email: passengerEmail.trim() || null,
        seats,
        total_amount: total,
        status: "pending",
        reference_code,
        details: {
          title: booking.title,
          origin: booking.origin,
          destination: booking.destination,
          departure_at: booking.departure_at,
          unit_price: unitPrice,
          ...trainDetails,
        },
      }).select("id").single();
      if (bookingRes.error) throw bookingRes.error;
      const partnerBookingId = (bookingRes.data as any).id;

      // 2) Réservation liée au flux paiement existant
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "BILLET",
        reservation_date: new Date().toISOString().split("T")[0],
        total_amount: total,
        paid_amount: 0,
        details: {
          partner_ticket_id: booking.id,
          partner_booking_id: partnerBookingId,
          reference_code,
          title: booking.title,
          agency: agency?.name ?? null,
          agency_id: agencyId,
          passenger_name: passengerName.trim(),
          passenger_phone: passengerPhone.trim(),
          passenger_email: passengerEmail.trim() || null,
          origin: booking.origin,
          destination: booking.destination,
          departure_at: booking.departure_at,
          unit_price: unitPrice,
          quantity: seats,
          ...trainDetails,
          quote: quoteLines,
        },
      }).select("id").single();
      if (error) throw error;
      toast.success("Billet réservé ! Procédez au paiement.");
      navigate({ to: "/paiement/$reservationId", params: { reservationId: data.id } });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  const backTo = agency?.category ? `/billets/categorie/${agency.category}` : "/billets";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <Link to={backTo as any} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour aux agences
        </Link>

        <header className="mt-6 flex items-center gap-3">
          <AgencyLogo src={agency?.logo_url} alt={agency?.name ?? ""} size={56} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold">{agency?.name ?? "Agence"}</h1>
              {agency?.is_verified && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  <BadgeCheck className="h-3 w-3" /> Vérifiée
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {filtered.length} billet{filtered.length > 1 ? "s" : ""} disponible{filtered.length > 1 ? "s" : ""}
            </p>
          </div>
        </header>

        {agency?.description && (
          <p className="mt-3 text-sm text-muted-foreground">{agency.description}</p>
        )}

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Input type="number" placeholder="Prix min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          <Input type="number" placeholder="Prix max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>

        {loading ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Aucun billet disponible pour cette agence.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {filtered.map((t) => (
              <article key={t.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                {t.image_url && (
                  <div className="h-36 w-full overflow-hidden bg-muted">
                    <img src={t.image_url} alt={t.title} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="space-y-2 p-4">
                  <h2 className="text-base font-bold">{t.title}</h2>
                  {t.train_type_id && (
                    <p className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      <TrainFront className="h-3 w-3" /> {trainTypeName(t.train_type_id)}
                    </p>
                  )}
                  {(t.origin || t.destination) && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {t.origin ?? "—"} → {t.destination ?? "—"}
                    </p>
                  )}
                  {t.departure_at && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" /> {new Date(t.departure_at).toLocaleString("fr-FR")}
                    </p>
                  )}
                  {t.description && <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-sm font-extrabold text-primary">{fmt(t.price)}</span>
                    <button
                      type="button"
                      onClick={() => openBooking(t)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      Réserver
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !submitting && setBooking(null)}>
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{booking.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{agency?.name ?? "Agence"}</p>
            {(booking.origin || booking.destination) && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {booking.origin ?? "—"} → {booking.destination ?? "—"}
              </p>
            )}
            {booking.departure_at && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" /> {new Date(booking.departure_at).toLocaleString("fr-FR")}
              </p>
            )}

            {isTrainTicket(booking) ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground">Classe de voyage *</label>
                  <div className="mt-1 grid gap-2">
                    {bookingClasses.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedClassId(c.id)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${selectedClassId === c.id ? "border-primary bg-primary/5 font-semibold" : ""}`}
                      >
                        <span>{c.name}</span>
                        <span className="font-bold text-primary">{fmt(c.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground">Âge du voyageur principal *</label>
                  <Input type="number" min={0} value={mainAge} onChange={(e) => setMainAge(e.target.value)} placeholder="ex: 34" />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-muted-foreground">Enfants accompagnants</label>
                    <button type="button" onClick={() => setChildrenAges([...childrenAges, ""])}
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold">
                      <Plus className="h-3 w-3" /> Ajouter
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {childrenAges.map((age, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input type="number" min={0} value={age} placeholder={`Âge enfant ${i + 1}`}
                          onChange={(e) => setChildrenAges(childrenAges.map((a, j) => (j === i ? e.target.value : a)))} />
                        <button type="button" onClick={() => setChildrenAges(childrenAges.filter((_, j) => j !== i))}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border bg-background p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prix normal ({trainQuote.travellers} voyageur{trainQuote.travellers > 1 ? "s" : ""})</span>
                    <span>{fmt(trainQuote.grossTotal)}</span>
                  </div>
                  {trainQuote.discountLines.map((l, i) => (
                    <div key={i} className="mt-1 flex justify-between text-xs text-green-600">
                      <span>{l.label}</span>
                      <span>− {fmt(l.amount)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between border-t pt-2">
                    <span className="font-semibold">Montant final à payer</span>
                    <span className="text-base font-extrabold text-primary">{fmt(trainQuote.total)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border bg-background p-3">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-semibold text-muted-foreground">Quantité</span>
                  <div className="ml-auto flex items-center gap-3">
                    <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border" disabled={qty <= 1}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-lg font-extrabold">{qty}</span>
                    <button type="button" onClick={() => setQty(qty + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-base font-extrabold text-primary">{fmt(booking.price * qty)}</span>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Nom du passager *</label>
                <Input value={passengerName} onChange={(e) => setPassengerName(e.target.value)} placeholder="Nom complet" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground">Téléphone *</label>
                  <Input type="tel" value={passengerPhone} onChange={(e) => setPassengerPhone(e.target.value)} placeholder="+241 …" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground">Email</label>
                  <Input type="email" value={passengerEmail} onChange={(e) => setPassengerEmail(e.target.value)} placeholder="(optionnel)" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setBooking(null)} disabled={submitting} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold">
                Annuler
              </button>
              <button type="button" onClick={confirmBooking} disabled={submitting} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Payer {fmt(total)}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
