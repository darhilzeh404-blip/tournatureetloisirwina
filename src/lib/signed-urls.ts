import { supabase } from "@/integrations/supabase/client";

/**
 * Signe plusieurs fichiers d'un bucket en UN seul appel réseau.
 *
 * Auparavant les écrans admin appelaient `createSignedUrl()` par ligne dans un
 * `Promise.all(rows.map(...))` : sur une liste de 100 paiements cela déclenchait
 * 100 requêtes HTTP simultanées, rejouées à chaque événement temps réel — la
 * WebView Android saturait et l'interface semblait figée.
 */
export async function createSignedUrlMap(
  bucket: string,
  paths: (string | null | undefined)[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => Boolean(p))));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, expiresIn);
  if (error || !data) return map;

  data.forEach((item) => {
    const path = (item as { path?: string | null }).path;
    if (path && item.signedUrl) map.set(path, item.signedUrl);
  });
  return map;
}
