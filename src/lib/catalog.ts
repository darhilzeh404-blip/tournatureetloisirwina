import { supabase } from "@/integrations/supabase/client";

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export type CatalogVehicle = {
  id: string;
  category_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  seats: number | null;
  description: string | null;
  gallery: string[];
  daily_rate: number | null;
  is_active: boolean;
  sort_order: number;
};

export async function uploadCatalogImage(file: File, folder = "catalogue"): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

const path = `${folder}/${uuid}.${ext}`;

  console.log("📷 Fichier sélectionné :", file.name);
  console.log("📦 Taille :", file.size);
  console.log("📍 Chemin :", path);

  const { data, error: uploadError } = await supabase.storage
    .from("catalogue-images")
    .upload(path, file, {
      contentType: file.type || `image/${ext}`,
      upsert: false,
    });

  console.log("📤 Résultat Supabase :", data);
  console.log("❌ Erreur Supabase :", uploadError);

  if (uploadError) throw uploadError;

  // Bucket privé : générer une URL signée longue durée (10 ans)
  const { data: signed, error: signedError } = await supabase.storage
    .from("catalogue-images")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

  if (signedError || !signed?.signedUrl) {
    throw signedError ?? new Error("Impossible de générer l'URL de l'image");
  }

  console.log("🔗 URL signée :", signed.signedUrl);
  return signed.signedUrl;
}