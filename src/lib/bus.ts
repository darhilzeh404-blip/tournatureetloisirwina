import { supabase } from "@/integrations/supabase/client";

export const BUS_CATEGORY_SLUG = "bus";

export type BusTrip = {
  id: string;
  agency_id: string;

  origin: string;
  destination: string;
  departure_date: string;

  seats_total: number;
  seats_available: number;

  status: "available" | "full" | "cancelled";

  price_adult: number;
  price_child_7_11: number;
  price_child_0_6: number;

  baggage_included_kg: number;
  baggage_extra_price_per_kg: number;
  baggage_conditions: string;

  notes: string;

  partner_agencies?: {
    name: string;
    logo_url: string | null;
  };

  created_at?: string;
};

export type BusBooking = {
  id: string;
  trip_id: string;
  user_id: string;
  reference_code: string;
  booker_name: string;
  booker_phone: string;
  id_document_url: string;
  passengers_count: number;
  tickets_total: number;
  baggage_total: number;
  total_amount: number;
  status: "pending" | "paid" | "ticket_sent" | "cancelled";
  reservation_id: string | null;
  admin_comment: string | null;
  created_at: string;
};

export type BusBookingPassenger = {
  id: string;
  booking_id: string;
  full_name: string;
  age: number;
  baggage_kg: number;
  fare_category: FareCategory;
  fare_amount: number;
  extra_kg: number;
  baggage_fee: number;
  seat_number: string | null;
};

export type BusFinalTicket = {
  id: string;
  booking_id: string;
  ticket_number: string;
  departure_time: string;
  boarding_time: string;
  seat_numbers: string;
  extra_info: string;
  issued_at: string;
};

export type FareCategory = "adult" | "child_7_11" | "child_0_6";

export const FARE_LABEL: Record<FareCategory, string> = {
  adult: "Adulte (12 ans et +)",
  child_7_11: "Enfant (7 à 11 ans)",
  child_0_6: "Enfant (0 à 6 ans)",
};

export const TRIP_STATUS_LABEL: Record<BusTrip["status"], string> = {
  available: "Disponible",
  full: "Complet",
  cancelled: "Annulé",
};

export const BOOKING_STATUS_LABEL: Record<BusBooking["status"], string> = {
  pending: "En attente de paiement",
  paid: "Payée — billet en préparation",
  ticket_sent: "Billet définitif envoyé",
  cancelled: "Annulée",
};

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  pending: "En attente de devis",
  quoted: "Devis reçu",
  accepted: "Devis accepté",
  refused: "Devis refusé",
  paid: "Payé",
  cancelled: "Annulé",
};

export type BusPassengerInput = {
  full_name: string;
  age: string;
  baggage_kg: string;
};

export const fmtXAF = (n: number) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

/** Catégorie tarifaire déduite automatiquement de l'âge. */
export function fareCategoryForAge(age: number): FareCategory {
  if (age >= 12) return "adult";
  if (age >= 7) return "child_7_11";
  return "child_0_6";
}

export function fareForAge(trip: BusTrip, age: number): number {
  const cat = fareCategoryForAge(age);
  if (cat === "adult") return trip.price_adult;
  if (cat === "child_7_11") return trip.price_child_7_11;
  return trip.price_child_0_6;
}

export type BusQuoteLine = {
  index: number;
  name: string;
  age: number;
  category: FareCategory;
  fare: number;
  baggageKg: number;
  extraKg: number;
  baggageFee: number;
};

export type BusQuote = {
  lines: BusQuoteLine[];
  ticketsTotal: number;
  baggageTotal: number;
  total: number;
};

/** Aperçu client du calcul (le montant définitif est recalculé côté serveur). */
export function computeBusQuote(trip: BusTrip | null, passengers: BusPassengerInput[]): BusQuote {
  if (!trip) return { lines: [], ticketsTotal: 0, baggageTotal: 0, total: 0 };
  const lines = passengers.map((p, index) => {
    const age = Math.max(Number(p.age) || 0, 0);
    const baggageKg = Math.max(Number(p.baggage_kg) || 0, 0);
    const extraKg = Math.max(baggageKg - trip.baggage_included_kg, 0);
    return {
      index,
      name: p.full_name,
      age,
      category: fareCategoryForAge(age),
      fare: fareForAge(trip, age),
      baggageKg,
      extraKg,
      baggageFee: extraKg * trip.baggage_extra_price_per_kg,
    };
  });
  const ticketsTotal = lines.reduce((s, l) => s + l.fare, 0);
  const baggageTotal = lines.reduce((s, l) => s + l.baggageFee, 0);
  return { lines, ticketsTotal, baggageTotal, total: ticketsTotal + baggageTotal };
}

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const formatDateFR = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

export async function fetchBusTrips(agencyId?: string): Promise<BusTrip[]> {
  let q = supabase.from("bus_trips" as any).select(`
 id,
 agency_id,
 origin,
 destination,
 departure_date,
 seats_total,
 seats_available,
 status,
 price_adult,
 price_child_7_11,
 price_child_0_6,
 baggage_included_kg,
 baggage_extra_price_per_kg,
 baggage_conditions,
 notes,
 partner_agencies(
   name,
   logo_url
 )
`).order("departure_date", { ascending: true });
  if (agencyId) q = q.eq("agency_id", agencyId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data as any) ?? []) as BusTrip[];
}

export async function createBusBooking(params: {
  tripId: string;
  bookerName: string;
  bookerPhone: string;
  idDocumentUrl: string;
  passengers: { full_name: string; age: number; baggage_kg: number }[];
}) {
  const { data, error } = await supabase.rpc("create_bus_booking" as any, {
    _trip_id: params.tripId,
    _booker_name: params.bookerName,
    _booker_phone: params.bookerPhone,
    _id_document_url: params.idDocumentUrl,
    _passengers: params.passengers as any,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { booking_id: string; reservation_id: string; total: number };
  return row;
}

export async function respondBusQuote(kind: "parcel" | "funeral", requestId: string, accept: boolean) {
  const { data, error } = await supabase.rpc("respond_bus_quote" as any, {
    _kind: kind,
    _request_id: requestId,
    _accept: accept,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Téléverse une pièce d'identité dans l'espace privé du client. */
export async function uploadBusDocument(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from("bus-documents").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function signedBusDocumentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("bus-documents").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
