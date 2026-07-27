import { jsPDF } from "jspdf";

export type TrainReceiptData = {
  reference: string;
  agency: string;
  trainType: string;
  travelClass: string;
  departureDate: string;
  origin: string;
  destination: string;
  passenger: string;
  passengerPhone?: string | null;
  passengerEmail?: string | null;
  idDocument?: string | null;
  children?: { name: string; age: number }[];
  baggageCount?: number;
  baggageFee?: number;
  grossTotal?: number;
  discountLines?: { label: string; amount: number }[];
  amountPaid: number;
  paidAt: string;
  statusLabel?: string;
};

const money = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

/** Reçu PDF WINA TOUR — le billet définitif est délivré séparément par l'agence. */
export function buildTrainReceipt(data: TrainReceiptData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = 56;

  // En-tête / logo textuel
  doc.setFillColor(21, 94, 117);
  doc.rect(0, 0, W, 96, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("WINA TOUR", M, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Reçu de réservation — Billet de train", M, 70);

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

  section("Voyage");
  line("Agence", data.agency);
  line("Type de train", data.trainType);
  line("Classe", data.travelClass);
  line("Date de départ", data.departureDate);
  line("Gare de départ", data.origin);
  line("Gare d'arrivée", data.destination);

  section("Voyageur");
  line("Nom complet", data.passenger);
  if (data.passengerPhone) line("Téléphone", data.passengerPhone);
  if (data.passengerEmail) line("Email", data.passengerEmail);
  if (data.idDocument) line("Pièce d'identité", data.idDocument);
  if (data.children && data.children.length > 0) {
    data.children.forEach((c, i) => line(`Enfant ${i + 1}`, `${c.name} — ${c.age} ans`));
  }
  if (data.baggageCount !== undefined) {
    line("Bagages", data.baggageCount > 0 ? `${data.baggageCount}` : "Aucun");
    if (data.baggageFee) line("Frais de bagages", money(data.baggageFee));
  }

  section("Paiement");
  if (data.grossTotal !== undefined) line("Prix normal", money(data.grossTotal));
  (data.discountLines ?? []).forEach((d) => line(d.label, `− ${money(d.amount)}`));
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
    "Votre paiement a bien été reçu. Veuillez patienter jusqu'à 24 heures pour recevoir votre billet physique.",
    M + 14,
    y + 22,
  );

  doc.setTextColor(140, 140, 140);
  doc.setFontSize(8);
  doc.text("WINA TOUR — Gabon · Ce reçu ne remplace pas le billet de transport.", M, doc.internal.pageSize.getHeight() - 40);

  return doc;
}

export function downloadTrainReceipt(data: TrainReceiptData) {
  buildTrainReceipt(data).save(`recu-wina-${data.reference}.pdf`);
}
