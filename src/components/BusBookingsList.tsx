import { useEffect, useState } from "react";
import { Bus, CalendarDays, Download, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { downloadBusRequestTicket } from "@/lib/bus-receipt";
import {
  BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE, fetchMyBusBookings, fmtXAF, formatDateFR,
  type BusBookingWithTrip,
} from "@/lib/bus";

/** Section « Mes réservations bus » de l'espace client. */
export function BusBookingsList({ userId }: { userId: string }) {
  const [bookings, setBookings] = useState<BusBookingWithTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchMyBusBookings(userId);
        if (!cancelled) setBookings(rows);
      } catch {
        /* silencieux : la section reste masquée */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const channel = supabase
      .channel(`bus-bookings-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bus_bookings", filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="mt-8 flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (bookings.length === 0) return null;

  const download = async (b: BusBookingWithTrip) => {
    const ticket = b.bus_final_tickets?.[0];
    if (!ticket) return;
    try {
      await downloadBusRequestTicket({
        reference: b.reference_code,
        agency: b.bus_trips?.partner_agencies?.name ?? "Agence partenaire",
        origin: b.bus_trips?.origin ?? "—",
        destination: b.bus_trips?.destination ?? "—",
        travelDate: b.travel_date ? formatDateFR(b.travel_date) : "—",
        busType: b.bus_trips?.bus_type ?? "",
        bookerName: b.booker_name,
        bookerPhone: b.booker_phone,
        adults: b.adults_count ?? 0,
        children: b.children_count ?? 0,
        infants: b.infants_count ?? 0,
        baggageCount: b.baggage_count ?? 0,
        baggageNotes: b.baggage_notes ?? "",
        baggageConditions: b.bus_trips?.baggage_conditions ?? "",
        ticketsTotal: b.tickets_total ?? 0,
        baggageTotal: b.baggage_total ?? 0,
        total: b.total_amount ?? 0,
        finalTicket: ticket,
      });
    } catch {
      toast.error("Impossible de générer le billet.");
    }
  };

  return (
    <div className="mt-8 space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Bus className="h-5 w-5 text-primary" />
        Mes réservations bus
        <span className="ml-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {bookings.length}
        </span>
      </h2>

      {bookings.map((b) => {
        const ticket = b.bus_final_tickets?.[0];
        return (
          <div key={b.id} className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold">
                  {b.bus_trips?.origin ?? "—"} → {b.bus_trips?.destination ?? "—"}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {b.travel_date ? formatDateFR(b.travel_date) : "Date à confirmer"} · Réf. {b.reference_code}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {b.adults_count} adulte(s) · {b.children_count} enfant(s) · {b.infants_count} bébé(s) · {b.baggage_count} bagage(s)
                </p>
              </div>
              <div className="text-right">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${BOOKING_STATUS_TONE[b.status]}`}>
                  {BOOKING_STATUS_LABEL[b.status]}
                </span>
                <p className="mt-1 text-sm font-bold text-primary">{fmtXAF(b.total_amount)}</p>
              </div>
            </div>

            {b.admin_comment && (
              <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">{b.admin_comment}</p>
            )}

            {ticket ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Ticket className="h-3.5 w-3.5 text-primary" />
                  Billet {ticket.ticket_number} · départ {ticket.departure_time}
                  {ticket.seat_numbers ? ` · siège(s) ${ticket.seat_numbers}` : ""}
                </p>
                <Button size="sm" onClick={() => void download(b)}>
                  <Download className="h-4 w-4" /> Télécharger le billet
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                {b.status === "refused"
                  ? "Demande refusée par l'administration."
                  : "Votre billet définitif sera disponible ici dès son émission par l'administration."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
