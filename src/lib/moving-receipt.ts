import { jsPDF } from "jspdf";
import { WINA_LOGO_DATA_URL } from "./wina-logo";

export type MovingDocData = {
  reference: string;
  clientName: string;
  phone: string;
  email?: string | null;
  fromAddress: string;
  toAddress: string;
  serviceLabel: string;
  housingLabel: string;
  volumeLabel: string;
  moversCount: number;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  amount: number;
  paidAt: string;
  details?: string | null;
  conditions?: string | null;
};

const money = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

function header(doc: jsPDF, title: string) {
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  doc.setFillColor(21, 94, 117);
  doc.rect(0, 0, W, 110, "F");
  try {
    doc.addImage(WINA_LOGO_DATA_URL, "JPEG", M, 18, 74, 74);
  } catch {
    /* logo optionnel */
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("WINA TOUR", M + 90, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(title, M + 90, 76);
  doc.setTextColor(20, 20, 20);
}

function buildDoc(data: MovingDocData, title: string, docLabel: string): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  header(doc, title);

  let y = 150;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`${docLabel} n° ${data.reference}`, M, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const rows: [string, string][] = [
    ["Client", data.clientName],
    ["Téléphone", data.phone],
    ...(data.email ? ([["Email", data.email]] as [string, string][]) : []),
    ["Adresse de départ", data.fromAddress],
    ["Adresse d'arrivée", data.toAddress],
    ["Prestation", data.serviceLabel],
    ["Type de logement", data.housingLabel],
    ["Volume", data.volumeLabel],
    ["Déménageurs", data.moversCount > 0 ? `${data.moversCount}` : "Aucun"],
    [
      "Date planifiée",
      [data.scheduledDate ?? "À confirmer", data.scheduledTime ?? ""].filter(Boolean).join(" à "),
    ],
    ["Payé le", new Date(data.paidAt).toLocaleString("fr-FR")],
  ];

  for (const [label, value] of rows) {
    doc.setTextColor(110, 110, 110);
    doc.text(label, M, y);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(String(value), W - M - 210);
    doc.text(lines, M + 160, y);
    y += 16 * lines.length;
  }

  y += 10;
  doc.setDrawColor(220, 220, 220);
  doc.line(M, y, W - M, y);
  y += 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Montant total", M, y);
  doc.text(money(data.amount), W - M, y, { align: "right" });
  y += 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (data.details) {
    doc.setTextColor(110, 110, 110);
    doc.text("Détails de la prestation", M, y);
    y += 14;
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(data.details, W - 2 * M);
    doc.text(lines, M, y);
    y += 14 * lines.length + 10;
  }
  if (data.conditions) {
    doc.setTextColor(110, 110, 110);
    doc.text("Conditions", M, y);
    y += 14;
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(data.conditions, W - 2 * M);
    doc.text(lines, M, y);
    y += 14 * lines.length;
  }

  doc.setTextColor(130, 130, 130);
  doc.setFontSize(9);
  doc.text(
    "WINA TOUR — Merci de votre confiance. Document généré automatiquement.",
    M,
    doc.internal.pageSize.getHeight() - 40,
  );
  return doc;
}

export function buildMovingReceipt(data: MovingDocData): jsPDF {
  return buildDoc(data, "Reçu de paiement — Déménagement", "Reçu");
}

export function buildMovingInvoice(data: MovingDocData): jsPDF {
  return buildDoc(data, "Facture — Déménagement", "Facture");
}
