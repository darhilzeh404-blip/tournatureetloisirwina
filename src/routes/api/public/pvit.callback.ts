import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function pvitBase() {
  return process.env.PVIT_BASE_URL || "https://api.mypvit.pro";
}

// Callback public appelé par MyPVit. On re-vérifie le statut auprès de l'API
// avant d'appliquer la mise à jour (jamais de confiance aveugle au payload).
export const Route = createFileRoute("/api/public/pvit/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.PVIT_API_TOKEN;
        const codeUrl = process.env.PVIT_CODE_URL;
        const sharedSecret = process.env.PVIT_CALLBACK_SECRET;
        if (!token || !codeUrl) return json({ error: "MyPVit non configuré" }, 500);

        // Optionnel : vérification d'un secret partagé si configuré
        if (sharedSecret) {
          const received =
            request.headers.get("x-pvit-secret") ||
            request.headers.get("x-callback-secret") ||
            "";
          if (received !== sharedSecret) return json({ error: "Forbidden" }, 403);
        }

        let payload: any = {};
        try { payload = await request.json(); } catch { /* ignore */ }

        const transactionId =
          payload?.reference ||
          payload?.transaction_id ||
          payload?.data?.reference ||
          payload?.data?.transaction_id;
        if (!transactionId) return json({ error: "Missing reference" }, 400);

        const { data: tx } = await (supabaseAdmin.from("pvit_transactions") as any)
          .select("id,status").eq("transaction_id", transactionId).maybeSingle();
        if (!tx) return json({ error: "Unknown transaction" }, 404);

        // Re-fetch autoritatif auprès de MyPVit
        try {
          const res = await fetch(`${pvitBase()}/${codeUrl}/status/${transactionId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "x-api-key": token,
            },
          });
          const remote: any = await res.json().catch(() => ({}));
          const record = remote?.data || remote;
          const status = String(record?.status || record?.state || "").toUpperCase();

          if (status === "SUCCESS" || status === "COMPLETED" || status === "PAID") {
            await (supabaseAdmin.rpc as any)("apply_pvit_completion", {
              _transaction_id: transactionId,
              _callback: record,
            });
          } else if (status === "FAILED" || status === "REJECTED" || status === "EXPIRED") {
            const reason = record?.reason || record?.message || "Paiement refusé";
            await (supabaseAdmin.rpc as any)("apply_pvit_failure", {
              _transaction_id: transactionId,
              _status: status === "EXPIRED" ? "EXPIRED" : "FAILED",
              _reason: reason,
              _callback: record,
            });
          }
        } catch (e) {
          console.error("[pvit/callback] verification failed", e);
        }

        return json({ ok: true });
      },
    },
  },
});
