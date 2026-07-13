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
  is_active: boolean;
  sort_order: number;
};

export function publicUrl(path: string): string {
  const { data } = supabase.storage.from("catalog-vehicles").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadCatalogImage(file: File, folder: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("catalog-vehicles")
    .upload(key, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return publicUrl(key);
}
