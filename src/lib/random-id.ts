/**
 * Génère un identifiant unique compatible navigateur (y compris contextes non sécurisés / WebView Android).
 * N'utilise PAS crypto.randomUUID qui peut échouer sur certains WebView.
 */
export function randomId(prefix = "id"): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const rand2 = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${Date.now()}-${rand}${rand2}`;
}
