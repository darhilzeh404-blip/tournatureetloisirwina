import { jsPDF } from "jspdf";
import { WINA_LOGO_DATA_URL } from "./wina-logo";
import { FARE_LABEL, type BusBookingPassenger, type BusFinalTicket } from "./bus";

const money = (n: number) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

export type BusReceiptData = {
  reference: string;
  agency: string;
  origin: string;
  destination: string;
  departureDate: string;
  bookerName: string;
  bookerPhone: string;
  passengers: Pick<BusBookingPassenger, "full_name" | "age" | "fare_category" | "fare_amount" | "baggage_kg" | "extra_kg" | "baggage_fee">[];
  ticketsTotal: number;
  baggageTotal: number;
  total: number;
  paidAt?: string | null;
  baggageConditions?: string;
  finalTicket?: BusFinalTicket | null;
};

function header(doc: jsPDF, subtitle: string) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(21, 94, 117);
  doc.rect(0, 0, W, 110, "F");
  try {
    doc.addImage(WINA_LOGO_DATA_URL, "JPEG", 48, 18, 74, 74);
  } catch {
    /* logo optionnel */
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("WINA TOUR", 138, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(subtitle, 138, 76);
}

function makeWriter(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const state = { y: 132 };

  const line = (label: string, value: string) => {
    if (state.y > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      state.y = 60;
    }
    state.y += 20;
    doc.setTextColor(90, 90, 90);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(label, M, state.y);
    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "bold");
    doc.text(value || "—", M + 200, state.y);
  };

  const section = (title: string) => {
    if (state.y > doc.internal.pageSize.getHeight() - 110) {
      doc.addPage();
      state.y = 60;
    }
    state.y += 30;
    doc.setDrawColor(226, 232, 240);
    doc.line(M, state.y - 12, W - M, state.y - 12);
    doc.setTextColor(21, 94, 117);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), M, state.y);
  };

  const paragraph = (text: string) => {
    state.y += 18;
    doc.setTextColor(90, 90, 90);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(text, W - M * 2);
    doc.text(lines, M, state.y);
    state.y += lines.length * 12;
  };

  return { M, W, state, line, section, paragraph };
}

/** Reçu de réservation bus — le billet définitif est envoyé ensuite par l'agence. */
export function buildBusReceipt(data: BusReceiptData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(doc, "Reçu de réservation — Billet de bus");
  const { M, W, state, line, section, paragraph } = makeWriter(doc);

  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Réservation N° ${data.reference}`, M, state.y);
  state.y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Émis le ${new Date().toLocaleString("fr-FR")}`, M, state.y);

  section("Voyage");
  line("Agence partenaire", data.agency);
  line("Ville de départ", data.origin);
  line("Ville d'arrivée", data.destination);
  line("Date de départ", data.departureDate);

  section("Réservant");
  line("Nom complet", data.bookerName);
  line("Téléphone", data.bookerPhone);

  section("Passagers");
  data.passengers.forEach((p, i) => {
    line(
      `Passager ${i + 1}`,
      `${p.full_name} — ${p.age} ans (${FARE_LABEL[p.fare_category]}) · ${money(p.fare_amount)}`,
    );
    line(
      `  Bagage`,
      `${p.baggage_kg} kg${p.extra_kg > 0 ? ` · ${p.extra_kg} kg suppl. = ${money(p.baggage_fee)}` : " · inclus"}`,
    );
  });

  section("Montants");
  line("Total des billets", money(data.ticketsTotal));
  line("Supplément bagages", money(data.baggageTotal));
  line("Total général", money(data.total));
  if (data.paidAt) line("Date de paiement", data.paidAt);

  if (data.baggageConditions) {
    section("Conditions de bagages");
    paragraph(data.baggageConditions);
  }

  state.y += 30;
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(M, state.y - 16, W - M * 2, 52, 8, 8, "F");
  doc.setTextColor(146, 64, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Statut : billet définitif en cours de traitement", M + 14, state.y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    "L'heure de départ, l'heure de convocation et votre numéro de siège vous seront communiqués par l'agence.",
    M + 14,
    state.y + 22,
  );

  doc.setTextColor(140, 140, 140);
  doc.setFontSize(8);
  doc.text("WINA TOUR — Gabon · Ce reçu ne remplace pas le billet de transport.", M, doc.internal.pageSize.getHeight() - 40);
  return doc;
}

export function downloadBusReceipt(data: BusReceiptData) {
  buildBusReceipt(data).save(`recu-bus-wina-${data.reference}.pdf`);
}

/** Billet définitif émis par l'administration. */
export function buildBusTicket(data: BusReceiptData): jsPDF {
  const t = data.finalTicket!;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(doc, "Billet de bus définitif");
  const { M, W, state, line, section, paragraph } = makeWriter(doc);

  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`Billet N° ${t.ticket_number}`, M, state.y);
  state.y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Réservation ${data.reference} · émis le ${new Date(t.issued_at).toLocaleString("fr-FR")}`, M, state.y);

  section("Voyage");
  line("Agence partenaire", data.agency);
  line("Trajet", `${data.origin} → ${data.destination}`);
  line("Date de départ", data.departureDate);
  line("Heure de départ", t.departure_time);
  if (t.boarding_time) line("Heure de convocation", t.boarding_time);
  if (t.seat_numbers) line("Numéro(s) de siège", t.seat_numbers);

  section("Voyageurs");
  line("Réservant", `${data.bookerName} · ${data.bookerPhone}`);
  data.passengers.forEach((p, i) => {
    line(`Passager ${i + 1}`, `${p.full_name} — ${p.age} ans (${FARE_LABEL[p.fare_category]})`);
  });

  section("Montant réglé");
  line("Total des billets", money(data.ticketsTotal));
  line("Supplément bagages", money(data.baggageTotal));
  line("Total payé", money(data.total));

  if (t.extra_info) {
    section("Informations de l'agence");
    paragraph(t.extra_info);
  }
  if (data.baggageConditions) {
    section("Conditions de bagages");
    paragraph(data.baggageConditions);
  }

  doc.setTextColor(140, 140, 140);
  doc.setFontSize(8);
  doc.text("WINA TOUR — Gabon · Présentez ce billet et une pièce d'identité à l'embarquement.", M, doc.internal.pageSize.getHeight() - 40);
  return doc;
}

export function downloadBusTicket(data: BusReceiptData) {
  buildBusTicket(data).save(`billet-bus-wina-${data.finalTicket?.ticket_number ?? data.reference}.pdf`);
}
