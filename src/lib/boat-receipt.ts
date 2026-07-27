import { jsPDF } from "jspdf";

export type BoatReceiptData = {
  reference: string;
  agency: string;
  vessel: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime?: string | null;
  returnDate?: string | null;
  passenger: string;
  passengerPhone?: string | null;
  passengerEmail?: string | null;
  adults: number;
  children: number;
  infants: number;
  passengers?: { name: string; category: string }[];
  baggageKg?: number;
  baggageFee?: number;
  services?: { label: string; amount: number }[];
  amountPaid: number;
  paidAt: string;
  statusLabel?: string;
};

const money = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

/** Reçu PDF WINA TOUR — billet navire/bateau (le billet définitif est délivré sous 24 h). */
export function buildBoatReceipt(data: BoatReceiptData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = 56;

  doc.setFillColor(21, 94, 117);
  doc.rect(0, 0, W, 96, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("WINA TOUR", M, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Reçu de réservation — Billet navire", M, 70);

  y = 132;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Réservation N° ${data.reference}`, M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Émis le ${new Date().toLocaleString("fr-FR")}`, M, y);

  const line = (label: string, value: string) => {
    y += 20;
    doc.setTextColor(90, 90, 90);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(label, M, y);
    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "bold");
    doc.text(value || "—", M + 190, y);
  };

  const section = (title: string) => {
    y += 30;
    doc.setDrawColor(226, 232, 240);
    doc.line(M, y - 12, W - M, y - 12);
    doc.setTextColor(21, 94, 117);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), M, y);
  };

  section("Traversée");
  line("Agence", data.agency);
  line("Navire", data.vessel);
  line("Départ", data.origin);
  line("Arrivée", data.destination);
  line("Date de départ", data.departureDate + (data.departureTime ? ` à ${data.departureTime}` : ""));
  if (data.returnDate) line("Date de retour", data.returnDate);

  section("Voyageurs");
  line("Réservé par", data.passenger);
  if (data.passengerPhone) line("Téléphone", data.passengerPhone);
  if (data.passengerEmail) line("Email", data.passengerEmail);
  line("Répartition", `${data.adults} adulte(s), ${data.children} enfant(s), ${data.infants} bébé(s)`);
  (data.passengers ?? []).forEach((p, i) => line(`Passager ${i + 1}`, `${p.name} — ${p.category}`));

  if (data.baggageKg) {
    section("Bagages & services");
    line("Bagages déclarés", `${data.baggageKg} kg`);
    if (data.baggageFee) line("Supplément bagages", money(data.baggageFee));
  }
  (data.services ?? []).forEach((s) => line(s.label, money(s.amount)));

  section("Paiement");
  line("Montant payé", money(data.amountPaid));
  line("Date de paiement", data.paidAt);

  y += 34;
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(M, y - 16, W - M * 2, 52, 8, 8, "F");
  doc.setTextColor(146, 64, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Statut : ${data.statusLabel ?? "Billet en cours de traitement"}`, M + 14, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    "Votre paiement a bien été reçu. Veuillez patienter jusqu'à 24 heures pour récupérer votre billet.",
    M + 14,
    y + 22,
  );

  doc.setTextColor(140, 140, 140);
  doc.setFontSize(8);
  doc.text("WINA TOUR — Gabon · Ce reçu ne remplace pas le billet de transport.", M, doc.internal.pageSize.getHeight() - 40);

  return doc;
}

export function downloadBoatReceipt(data: BoatReceiptData) {
  buildBoatReceipt(data).save(`recu-wina-navire-${data.reference}.pdf`);
}
