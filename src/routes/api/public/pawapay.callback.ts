import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function pawapayBase() {
  return process.env.PAWAPAY_BASE_URL || "https://api.sandbox.pawapay.io";
}

// Endpoint public appelé par PawaPay. On ne se fie PAS aveuglément au payload:
// on re-vérifie le statut auprès de l'API PawaPay via GET /deposits/{id}.
export const Route = createFileRoute("/api/public/pawapay/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.PAWAPAY_API_TOKEN;
        if (!token) return json({ error: "PawaPay non configuré" }, 500);

        let payload: any = {};
        try { payload = await request.json(); } catch { /* ignore */ }

        const depositId = payload?.depositId || payload?.deposit_id;
        if (!depositId) return json({ error: "Missing depositId" }, 400);

        // Vérifie l'existence de la transaction locale
        const { data: tx } = await supabaseAdmin
          .from("pawapay_transactions").select("id,status").eq("deposit_id", depositId).maybeSingle();
        if (!tx) return json({ error: "Unknown deposit" }, 404);

        // Re-fetch autoritatif
        try {
          const res = await fetch(`${pawapayBase()}/deposits/${depositId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const remote: any = await res.json().catch(() => ({}));
          const record = Array.isArray(remote) ? remote[0] : remote;
          const status = record?.status;

          if (status === "COMPLETED") {
            await supabaseAdmin.rpc("apply_pawapay_completion", {
              _deposit_id: depositId,
              _callback: record,
            });
          } else if (status === "FAILED" || status === "REJECTED") {
            const reason =
              record?.failureReason?.failureMessage ||
              record?.rejectionReason?.rejectionMessage ||
              "Paiement refusé";
            await supabaseAdmin.rpc("apply_pawapay_failure", {
              _deposit_id: depositId,
              _status: status,
              _reason: reason,
              _callback: record,
            });
          }
        } catch (e) {
          console.error("[pawapay/callback] verification failed", e);
        }

        return json({ ok: true });
      },
    },
  },
});
