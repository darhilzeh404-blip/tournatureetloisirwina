// Génère un srcset HD via l'API de transformation d'images Supabase Storage.
// Fonctionne pour toute URL publique `/storage/v1/object/public/...`.
// Si l'URL n'est pas une image Supabase, on retourne l'URL d'origine.

const RENDER = "/storage/v1/render/image/public/";
const OBJECT = "/storage/v1/object/public/";

function toRender(url: string, width: number, quality = 80): string {
  if (!url || !url.includes(OBJECT)) return url;
  const [base, path] = url.split(OBJECT);
  return `${base}${RENDER}${path}?width=${width}&quality=${quality}&resize=contain`;
}

/** Renvoie un objet { src, srcSet, sizes } prêt à passer à <img>. */
export function hdImg(url: string | null | undefined, sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw") {
  if (!url) return { src: "", srcSet: undefined, sizes: undefined };
  if (!url.includes(OBJECT)) {
    // URL externe : on renvoie tel quel (pas de dégradation).
    return { src: url, srcSet: undefined, sizes: undefined };
  }
  const widths = [480, 800, 1200, 1600, 2000];
  const srcSet = widths.map((w) => `${toRender(url, w)} ${w}w`).join(", ");
  return { src: toRender(url, 1200), srcSet, sizes };
}
