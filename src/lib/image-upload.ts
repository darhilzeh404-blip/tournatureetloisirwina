// Utilitaires de préparation d'image pour upload de preuves de paiement
// - Convertit HEIC/HEIF (iOS) → JPEG
// - Compresse < 2 Mo
// - Renvoie un File JPEG prêt à uploader

import imageCompression from "browser-image-compression";

const HEIC_MIME = ["image/heic", "image/heif"];

function isHeic(file: File) {
  if (HEIC_MIME.includes(file.type.toLowerCase())) return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

export async function prepareReceiptImage(input: File): Promise<File> {
  let working: Blob = input;
  let outName = input.name.replace(/\.(heic|heif)$/i, ".jpg");

  // 1. HEIC → JPEG (iOS Safari renvoie souvent du HEIC depuis la galerie)
  if (isHeic(input)) {
    try {
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({
        blob: input,
        toType: "image/jpeg",
        quality: 0.9,
      });
      working = Array.isArray(converted) ? converted[0] : converted;
      if (!outName.toLowerCase().endsWith(".jpg")) outName = `${outName}.jpg`;
    } catch (err) {
      console.warn("[prepareReceiptImage] HEIC conversion failed, fallback to original", err);
    }
  }

  // 2. Compression < 2 Mo, max 1920px
  const asFile =
    working instanceof File
      ? working
      : new File([working], outName, { type: "image/jpeg" });

  try {
    const compressed = await imageCompression(asFile, {
      maxSizeMB: 1.8,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: "image/jpeg",
      initialQuality: 0.85,
    });
    return new File([compressed], outName.endsWith(".jpg") ? outName : `${outName}.jpg`, {
      type: "image/jpeg",
    });
  } catch (err) {
    console.warn("[prepareReceiptImage] compression failed, fallback to converted file", err);
    return asFile;
  }
}

export function buildWhatsappLink(adminNumber: string, message: string) {
  const cleaned = adminNumber.replace(/[^\d]/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}
