import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { toast } from "sonner";
import { Bus, CalendarDays, Loader2, Package, Pencil, Plus, Ticket, Trash2, Flower2 } from "lucide-react";

import {
  adminDecideBusBooking, adminIssueBusTicket, fmtXAF, formatDateFR, toISODate,
  TRIP_STATUS_LABEL, BOOKING_STATUS_LABEL, QUOTE_STATUS_LABEL,
} from "@/lib/bus";
import { NumericField } from "@/components/ui/numeric-field";
import { NumericTextField } from "@/components/ui/numeric-text-field";


export const Route = createFileRoute("/admin/bus-billetterie")({
  head: () => ({
    meta: [
      { title: "Billetterie Bus — Administration Wina Tour" },
      { name: "description", content: "Créez les départs de bus, traitez les réservations et envoyez les billets définitifs." },
    ],
  }),
  component: BusBilletterieAdmin,
});

type Agency = { id: string; name: string; category: string | null; is_active: boolean };

type Trip = {
  id: string;
  agency_id: string;
  origin: string;
  destination: string;
  departure_date: string;
  date_start: string;
  date_end: string;
  bus_type: string;
  seats_total: number;
  seats_available: number;
  price_adult: number;
  price_child_7_11: number;
  price_child_0_6: number;
  baggage_included_kg: number;
  baggage_extra_price_per_kg: number;
  baggage_conditions: string;
  status: "available" | "full" | "cancelled";
};

type Booking = {
  id: string;
  trip_id: string;
  reference_code: string;
  booker_name: string;
  booker_phone: string;
  id_document_url: string | null;
  passengers_count: number;
  adults_count: number;
  children_count: number;
  infants_count: number;
  baggage_count: number;
  baggage_notes: string | null;
  travel_date: string | null;
  total_amount: number;
  status: string;
  admin_comment: string | null;
  created_at: string;
};

type QuoteRow = Record<string, any>;

/** Période par défaut : 1 mois complet à partir d'aujourd'hui. */
const addMonths = (iso: string, months: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return toISODate(d);
};

const emptyForm = {
  agency_id: "",
  origin: "",
  destination: "",
  bus_type: "",
  date_start: toISODate(new Date()),
  date_end: addMonths(toISODate(new Date()), 1),
  seats_total: 50,
  price_adult: 0,
  price_child_7_11: 0,
  price_child_0_6: 0,
  baggage_included_kg: 20,
  baggage_extra_price_per_kg: 1000,
  baggage_conditions: "",
};


type Tab = "trips" | "bookings" | "parcel" | "funeral";

function BusBilletterieAdmin() {
  const [tab, setTab] = useState<Tab>("trips");

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [parcels, setParcels] = useState<QuoteRow[]>([]);
  const [funerals, setFunerals] = useState<QuoteRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState<string | null>(null);
  const [decisionComment, setDecisionComment] = useState<Record<string, string>>({});


  const agencyName = useMemo(() => {
    const map: Record<string, string> = {};
    agencies.forEach((a) => (map[a.id] = a.name));
    return map;
  }, [agencies]);

  const tripLabel = useMemo(() => {
    const map: Record<string, string> = {};
    trips.forEach(
      (t) => (map[t.id] = `${t.origin} → ${t.destination} · ${t.date_start ?? t.departure_date} → ${t.date_end ?? t.departure_date}`),
    );
    return map;
  }, [trips]);


  const loadAll = async () => {
    setLoading(true);
    const [ag, tr, bk, pc, fn] = await Promise.all([
      supabase.rpc("get_all_partner_agencies_admin"),
      supabase.from("bus_trips" as any).select("*").order("departure_date"),
      supabase.from("bus_bookings" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("bus_parcel_requests" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("bus_funeral_requests" as any).select("*").order("created_at", { ascending: false }),
    ]);

    if (ag.error) toast.error(ag.error.message);
    if (tr.error) toast.error(tr.error.message);

    const allAgencies = ((ag.data as any[]) ?? []) as Agency[];
    setAgencies(allAgencies.filter((a) => a.category === "bus" && a.is_active !== false));
    setTrips(((tr.data as any[]) ?? []) as Trip[]);
    setBookings(((bk.data as any[]) ?? []) as Booking[]);
    setParcels(((pc.data as any[]) ?? []) as QuoteRow[]);
    setFunerals(((fn.data as any[]) ?? []) as QuoteRow[]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  /* ---------------- Voyages ---------------- */

  const startEdit = (t: Trip) => {
    setEditId(t.id);
    setForm({
      agency_id: t.agency_id,
      origin: t.origin ?? "",
      destination: t.destination ?? "",
      bus_type: t.bus_type ?? "",
      date_start: t.date_start ?? t.departure_date,
      date_end: t.date_end ?? t.departure_date,
      seats_total: t.seats_total ?? 0,
      price_adult: t.price_adult ?? 0,
      price_child_7_11: t.price_adult ?? 0,
      price_child_0_6: t.price_child_0_6 ?? 0,
      baggage_included_kg: t.baggage_included_kg ?? 0,
      baggage_extra_price_per_kg: t.baggage_extra_price_per_kg ?? 0,
      baggage_conditions: t.baggage_conditions ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm({ ...emptyForm });
  };

  const createTrips = async () => {
    if (!form.agency_id) return toast.error("Choisissez une agence partenaire");
    if (!form.origin.trim()) return toast.error("Ville de départ obligatoire");
    if (!form.destination.trim()) return toast.error("Ville d'arrivée obligatoire");
    if (!form.date_start || !form.date_end) return toast.error("Renseignez la période (date de début et de fin)");
    if (form.date_end < form.date_start) return toast.error("La date de fin doit suivre la date de début");
    if (!form.seats_total || form.seats_total < 1) return toast.error("Nombre de places invalide");
    if (form.price_adult <= 0) return toast.error("Le tarif adulte est obligatoire");

    setSaving(true);
    try {
      const row: Record<string, unknown> = {
        agency_id: form.agency_id,
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        bus_type: form.bus_type.trim(),
        departure_date: form.date_start,
        date_start: form.date_start,
        date_end: form.date_end,
        seats_total: form.seats_total,
        seats_available: form.seats_total,
        price_adult: form.price_adult,
        price_child_7_11: form.price_adult,
        price_child_0_6: form.price_child_0_6,
        baggage_included_kg: form.baggage_included_kg,
        baggage_extra_price_per_kg: form.baggage_extra_price_per_kg,
        baggage_conditions: form.baggage_conditions,
      };

      if (editId) {
        const current = trips.find((t) => t.id === editId);
        const booked = Math.max((current?.seats_total ?? 0) - (current?.seats_available ?? 0), 0);
        row.seats_available = Math.max(form.seats_total - booked, 0);
        const { error } = await supabase.from("bus_trips" as any).update(row as any).eq("id", editId);
        if (error) throw error;
        toast.success("Départ programmé mis à jour");
        setEditId(null);
      } else {
        row.status = "available";
        const { error } = await supabase.from("bus_trips" as any).insert(row as any);
        if (error) throw error;
        toast.success("Voyage programmé sur la période choisie");
      }

      setForm({ ...emptyForm });
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };


  const openDocument = async (path: string) => {
    const { data, error } = await supabase.storage.from("bus-documents").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return toast.error("Document introuvable");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const decide = async (b: Booking, approve: boolean) => {
    setSaving(true);
    try {
      await adminDecideBusBooking(b.id, approve, (decisionComment[b.id] ?? "").trim());
      toast.success(approve ? "Demande validée" : "Demande refusée");
      setDecisionComment((d) => ({ ...d, [b.id]: "" }));
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la décision");
    } finally {
      setSaving(false);
    }
  };


  const updateTrip = async (id: string, patch: Partial<Trip>) => {
    const { error } = await supabase.from("bus_trips" as any).update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Voyage mis à jour");
    loadAll();
  };

  const deleteTrip = async (t: Trip) => {
    if (!confirm(`Supprimer le départ ${t.origin} → ${t.destination} du ${t.date_start ?? t.departure_date} au ${t.date_end ?? t.departure_date} ?`)) return;
    const { error } = await supabase.from("bus_trips" as any).delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Départ supprimé");
    loadAll();
  };

  /* ---------------- Billet définitif ---------------- */

  const [ticketFor, setTicketFor] = useState<string | null>(null);
  const [ticketForm, setTicketForm] = useState({
    ticket_number: "",
    departure_time: "",
    boarding_time: "",
    seat_numbers: "",
    extra_info: "",
  });

  const issueTicket = async (booking: Booking) => {
    if (!ticketForm.departure_time.trim()) return toast.error("Heure de départ obligatoire");
    setSaving(true);
    try {
      const number = await adminIssueBusTicket({
        bookingId: booking.id,
        departureTime: ticketForm.departure_time.trim(),
        boardingTime: ticketForm.boarding_time.trim(),
        seatNumbers: ticketForm.seat_numbers.trim(),
        extraInfo: ticketForm.extra_info.trim(),
      });
      toast.success(`Billet ${number} disponible pour le client`);
      setTicketFor(null);
      setTicketForm({ ticket_number: "", departure_time: "", boarding_time: "", seat_numbers: "", extra_info: "" });
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur d'envoi du billet");
    } finally {
      setSaving(false);
    }
  };


  /* ---------------- Devis ---------------- */

  const [quoteDraft, setQuoteDraft] = useState<Record<string, { price: string; a: string; b: string }>>({});

  const draft = (id: string) => quoteDraft[id] ?? { price: "", a: "", b: "" };
  const setDraft = (id: string, patch: Partial<{ price: string; a: string; b: string }>) =>
    setQuoteDraft((d) => ({ ...d, [id]: { ...draft(id), ...patch } }));

  const sendQuote = async (kind: "parcel" | "funeral", row: QuoteRow) => {
    const d = draft(row.id);
    const price = Number(d.price);
    if (!price || price <= 0) return toast.error("Renseignez un prix valide");
    setSaving(true);
    try {
      const table = kind === "parcel" ? "bus_parcel_requests" : "bus_funeral_requests";
      const patch: any =
        kind === "parcel"
          ? { quote_price: price, quote_delay: d.a, quote_comment: d.b, status: "quoted", quoted_at: new Date().toISOString() }
          : { quote_price: price, quote_available_date: d.a || null, quote_conditions: d.b, status: "quoted", quoted_at: new Date().toISOString() };
      const { error } = await supabase.from(table as any).update(patch).eq("id", row.id);
      if (error) throw error;
      toast.success("Devis envoyé au client");
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi du devis");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- Rendu ---------------- */

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Bus; count: number }[] = [
    { key: "trips", label: "Départs programmés", icon: CalendarDays, count: trips.length },
    { key: "bookings", label: "Réservations", icon: Ticket, count: bookings.filter((b) => b.status !== "cancelled").length },
    { key: "parcel", label: "Colis", icon: Package, count: parcels.filter((p) => p.status === "pending").length },
    { key: "funeral", label: "Funéraire", icon: Flower2, count: funerals.filter((p) => p.status === "pending").length },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5">
      <div>
        <h1 className="text-2xl font-bold">Billetterie Bus</h1>
        <p className="text-sm text-muted-foreground">
          Créez les départs, traitez les réservations et envoyez les billets définitifs.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
              <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-primary-foreground/20" : "bg-muted"}`}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {tab === "trips" && (
        <>
          <Card>
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-wrap items-center gap-2">
                {editId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                <h2 className="text-lg font-semibold">
                  {editId ? "Modifier le départ programmé" : "Nouvelle programmation de départs"}
                </h2>
                {editId && (
                  <Button variant="ghost" size="sm" className="ml-auto" onClick={cancelEdit}>Annuler</Button>
                )}
              </div>


              {agencies.length === 0 && (
                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  Aucune agence de catégorie « Bus » active. Créez-en une dans « Agences partenaires ».
                </p>
              )}

              <div>
                <label className="text-sm font-medium">Agence partenaire</label>
                <select
                  className="mt-1.5 h-11 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.agency_id}
                  onChange={(e) => setForm({ ...form, agency_id: e.target.value })}
                >
                  <option value="">Choisir une agence</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Ville de départ</label>
                  <Input className="mt-1.5" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="Libreville" />
                </div>
                <div>
                  <label className="text-sm font-medium">Ville d'arrivée</label>
                  <Input className="mt-1.5" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Franceville" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Date de début</label>
                  <Input className="mt-1.5" type="date" value={form.date_start}
                    onChange={(e) => setForm({ ...form, date_start: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Date de fin</label>
                  <Input className="mt-1.5" type="date" value={form.date_end}
                    onChange={(e) => setForm({ ...form, date_end: e.target.value })} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[1, 2, 3].map((m) => (
                      <button key={m} type="button"
                        onClick={() => setForm({ ...form, date_end: addMonths(form.date_start, m) })}
                        className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted">
                        {m} mois
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Type de bus</label>
                  <Input className="mt-1.5" value={form.bus_type} placeholder="Coaster 30 places"
                    onChange={(e) => setForm({ ...form, bus_type: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Le client pourra réserver n'importe quel jour compris dans cette période.
              </p>


              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Nombre total de places</label>
                  <NumericField className="mt-1.5" min={1} value={form.seats_total}
                    onChange={(v: number) => setForm({ ...form, seats_total: v })} />
                </div>
              </div>

              <h3 className="font-semibold">Tarifs par tranche d'âge</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">Adulte (6 ans et +)</label>
                  <NumericField min={0} value={form.price_adult} onChange={(v: number) => setForm({ ...form, price_adult: v })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Bébé 0 à 5 ans</label>
                  <NumericField min={0} value={form.price_child_0_6} onChange={(v: number) => setForm({ ...form, price_child_0_6: v })} />
                </div>
              </div>

              <h3 className="font-semibold">Bagages</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">Kg inclus</label>
                  <NumericField min={0} value={form.baggage_included_kg} onChange={(v: number) => setForm({ ...form, baggage_included_kg: v })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Prix du kg supplémentaire</label>
                  <NumericField min={0} value={form.baggage_extra_price_per_kg} onChange={(v: number) => setForm({ ...form, baggage_extra_price_per_kg: v })} />
                </div>
              </div>
              <Textarea
                placeholder="Conditions des bagages (visibles par le client avant paiement)"
                value={form.baggage_conditions}
                onChange={(e) => setForm({ ...form, baggage_conditions: e.target.value })}
              />

              <Button onClick={createTrips} disabled={saving} className="w-full">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editId ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {editId ? "Enregistrer les modifications" : "Créer les départs"}
              </Button>

            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="text-lg font-semibold">Départs programmés</h2>
              {trips.length === 0 && <p className="text-sm text-muted-foreground">Aucun départ créé.</p>}
              {trips.map((t) => (
                <div key={t.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{t.origin} → {t.destination}</p>
                      <p className="text-xs text-muted-foreground">{agencyName[t.agency_id] ?? "—"}</p>
                      <p className="mt-1 text-sm">Du {formatDateFR(t.date_start ?? t.departure_date)} au {formatDateFR(t.date_end ?? t.departure_date)}</p>{t.bus_type && <p className="text-xs text-muted-foreground">{t.bus_type}</p>}
                    </div>
                    <div className="text-sm">
                      <p>Places : <b>{t.seats_available}</b> / {t.seats_total}</p>
                      <p>Adulte : {fmtXAF(t.price_adult)}</p>
                      <p className="text-xs text-muted-foreground">
                        Bébé 0-5 : {fmtXAF(t.price_child_0_6)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                        value={t.status}
                        onChange={(e) => updateTrip(t.id, { status: e.target.value as Trip["status"] })}
                      >
                        {Object.entries(TRIP_STATUS_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <Button variant="outline" size="sm" onClick={() => startEdit(t)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Modifier
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteTrip(t)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {tab === "bookings" && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="text-lg font-semibold">Demandes de réservation</h2>
            {bookings.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande.</p>}
            {bookings.map((b) => (
              <div key={b.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{b.reference_code}</p>
                    <p className="text-sm">{tripLabel[b.trip_id] ?? "Voyage supprimé"}</p>
                    <p className="text-sm text-muted-foreground">
                      Date de voyage : <b className="text-foreground">{b.travel_date ? formatDateFR(b.travel_date) : "—"}</b>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.booker_name} · {b.booker_phone}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.adults_count ?? 0} adulte(s) · {b.children_count ?? 0} enfant(s) · {b.infants_count ?? 0} bébé(s) ·{" "}
                      {b.baggage_count ?? 0} bagage(s)
                      {b.baggage_notes ? ` — ${b.baggage_notes}` : ""}
                    </p>
                    {b.id_document_url && (
                      <button type="button" onClick={() => void openDocument(b.id_document_url!)}
                        className="mt-1 text-xs font-semibold text-primary underline">
                        Voir la pièce d'identité
                      </button>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{fmtXAF(b.total_amount)}</p>
                    <p className="text-xs text-muted-foreground">{BOOKING_STATUS_LABEL[b.status as keyof typeof BOOKING_STATUS_LABEL] ?? b.status}</p>
                  </div>
                </div>

                {b.admin_comment && (
                  <p className="mt-2 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">{b.admin_comment}</p>
                )}

                {b.status === "pending" && (
                  <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-3">
                    <Input placeholder="Commentaire pour le client (facultatif)"
                      value={decisionComment[b.id] ?? ""}
                      onChange={(e) => setDecisionComment((d) => ({ ...d, [b.id]: e.target.value.slice(0, 400) }))} />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={saving} onClick={() => void decide(b, true)}>Valider la demande</Button>
                      <Button size="sm" variant="destructive" disabled={saving} onClick={() => void decide(b, false)}>Refuser</Button>
                    </div>
                  </div>
                )}

                {(b.status === "validated" || b.status === "paid") && (
                  <div className="mt-3">
                    {ticketFor === b.id ? (
                      <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                        <div className="grid gap-2 md:grid-cols-2">
                          <Input placeholder="Heure de départ (ex. 07h30)" value={ticketForm.departure_time}
                            onChange={(e) => setTicketForm({ ...ticketForm, departure_time: e.target.value })} />
                          <Input placeholder="Heure de convocation (ex. 06h30)" value={ticketForm.boarding_time}
                            onChange={(e) => setTicketForm({ ...ticketForm, boarding_time: e.target.value })} />
                          <Input placeholder="Numéro(s) de siège (ex. 12, 13)" value={ticketForm.seat_numbers}
                            onChange={(e) => setTicketForm({ ...ticketForm, seat_numbers: e.target.value })} />
                        </div>
                        <Textarea placeholder="Informations complémentaires" value={ticketForm.extra_info}
                          onChange={(e) => setTicketForm({ ...ticketForm, extra_info: e.target.value })} />
                        <div className="flex gap-2">
                          <Button onClick={() => void issueTicket(b)} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Générer le billet (QR Code)
                          </Button>
                          <Button variant="ghost" onClick={() => setTicketFor(null)}>Annuler</Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => setTicketFor(b.id)}>
                        <Ticket className="mr-2 h-4 w-4" /> Émettre le billet définitif
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}


      {(tab === "parcel" || tab === "funeral") && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="text-lg font-semibold">
              {tab === "parcel" ? "Demandes d'expédition de colis" : "Demandes de transport funéraire"}
            </h2>
            {(tab === "parcel" ? parcels : funerals).length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune demande.</p>
            )}
            {(tab === "parcel" ? parcels : funerals).map((r) => {
              const d = draft(r.id);
              return (
                <div key={r.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{r.reference_code}</p>
                      <p className="text-sm">{r.origin} → {r.destination}</p>
                      <p className="text-xs text-muted-foreground">{agencyName[r.agency_id] ?? "—"}</p>
                      {tab === "parcel" ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.sender_name} ({r.sender_phone}) → {r.recipient_name} ({r.recipient_phone}) · {r.parcel_nature} · {r.weight_kg} kg
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.contact_name} ({r.contact_phone}) · Défunt : {r.deceased_name} · {r.transport_type}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                      {QUOTE_STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </div>

                  {r.status === "pending" ? (
                    <div className="mt-3 space-y-2 rounded-lg bg-muted/50 p-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <NumericTextField placeholder="Prix du devis (FCFA)" value={d.price}
                          onChange={(e) => setDraft(r.id, { price: e.target.value })} />
                        <Input
                          placeholder={tab === "parcel" ? "Délai de livraison" : "Date de disponibilité (AAAA-MM-JJ)"}
                          type={tab === "parcel" ? "text" : "date"}
                          value={d.a}
                          onChange={(e) => setDraft(r.id, { a: e.target.value })}
                        />
                      </div>
                      <Textarea placeholder={tab === "parcel" ? "Commentaire" : "Conditions"} value={d.b}
                        onChange={(e) => setDraft(r.id, { b: e.target.value })} />
                      <Button onClick={() => sendQuote(tab === "parcel" ? "parcel" : "funeral", r)} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Envoyer le devis
                      </Button>
                    </div>
                  ) : (
                    r.quote_price != null && (
                      <p className="mt-2 text-sm">
                        Devis : <b>{fmtXAF(Number(r.quote_price))}</b>
                        {tab === "parcel" ? (r.quote_delay ? ` · ${r.quote_delay}` : "") : (r.quote_available_date ? ` · ${r.quote_available_date}` : "")}
                      </p>
                    )
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
