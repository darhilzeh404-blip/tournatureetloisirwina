/**
 * SPA shim for the server-only Supabase admin client.
 * Pas de service-role côté natif. Toute opération privilégiée passe par une RPC.
 */
export const supabaseAdmin = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "[SPA] supabaseAdmin n'est pas disponible côté client. Utilisez une RPC Supabase.",
      );
    },
  },
) as never;
