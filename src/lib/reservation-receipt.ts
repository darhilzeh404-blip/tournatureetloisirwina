import { jsPDF } from "jspdf";
import { WINA_LOGO_DATA_URL } from "./wina-logo";

const money = (n: number) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

export type ReservationReceiptData = {
  reference: string;
  serviceLabel: string;
  status: string;
  issuedAt?: string | null;
  rows: Array<[string, string]>;
  totalAmount: number;
  paidAmount?: number | null;
  note?: string;
};

/** Reçu PDF générique WINA TOUR pour une réservation confirmée. */
export function buildReservationReceipt(data: ReservationReceiptData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;

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
  doc.text(`Reçu de réservation — ${data.serviceLabel}`, 138, 76);

  let y = 150;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Réservation N° ${data.reference}`, M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `Émis le ${new Date(data.issuedAt ?? Date.now()).toLocaleString("fr-FR")}`,
    M,
    y,
  );

  const section = (title: string) => {
    if (y > H - 120) {
      doc.addPage();
      y = 60;
    }
    y += 30;
    doc.setDrawColor(226, 232, 240);
    doc.line(M, y - 12, W - M, y - 12);
    doc.setTextColor(21, 94, 117);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), M, y);
  };

  const line = (label: string, value: string) => {
    if (y > H - 80) {
      doc.addPage();
      y = 60;
    }
    y += 20;
    doc.setTextColor(90, 90, 90);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(label, M, y);
    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "bold");
    const lines = doc.splitTextToSize(value || "—", W - M * 2 - 200);
    doc.text(lines, M + 200, y);
    y += (lines.length - 1) * 12;
  };

  section("Détails de la réservation");
  data.rows.forEach(([k, v]) => line(k, v));

  section("Montants");
  line("Montant total", money(data.totalAmount));
  if (data.paidAmount != null) line("Montant réglé", money(data.paidAmount));
  line("Statut", data.status);

  y += 30;
  if (y > H - 120) {
    doc.addPage();
    y = 120;
  }
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(M, y - 16, W - M * 2, 46, 8, 8, "F");
  doc.setTextColor(22, 101, 52);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Réservation confirmée", M + 14, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    data.note ?? "Présentez ce reçu à nos équipes le jour de votre voyage.",
    M + 14,
    y + 20,
  );

  doc.setTextColor(140, 140, 140);
  doc.setFontSize(8);
  doc.text("WINA TOUR — Gabon · Reçu généré automatiquement.", M, H - 40);
  return doc;
}

export function downloadReservationReceipt(data: ReservationReceiptData) {
  buildReservationReceipt(data).save(`recu-wina-${data.reference}.pdf`);
}
