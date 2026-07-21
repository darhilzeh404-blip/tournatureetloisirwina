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

export const Route = createFileRoute("/api/pawapay/status/$depositId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const token = process.env.PAWAPAY_API_TOKEN;
        if (!token) return json({ error: "PawaPay non configuré" }, 500);

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
        const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
        if (!userData.user) return json({ error: "Invalid session" }, 401);

        const depositId = params.depositId;
        const { data: tx } = await supabaseAdmin
          .from("pawapay_transactions").select("*")
          .eq("deposit_id", depositId).maybeSingle();
        if (!tx || tx.user_id !== userData.user.id) return json({ error: "Not found" }, 404);

        // Si déjà finalisé en DB, retourne
        if (["COMPLETED", "FAILED", "REJECTED"].includes(tx.status)) {
          return json({ status: tx.status, failure_reason: tx.failure_reason });
        }

        // Sinon interroge PawaPay
        try {
          const res = await fetch(`${pawapayBase()}/deposits/${depositId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const payload: any = await res.json().catch(() => ({}));
          // v1: retourne un array; on prend le 1er
          const record = Array.isArray(payload) ? payload[0] : payload;
          const remoteStatus = record?.status || "SUBMITTED";

          if (remoteStatus === "COMPLETED") {
            await supabaseAdmin.rpc("apply_pawapay_completion", {
              _deposit_id: depositId,
              _callback: record,
            });
            return json({ status: "COMPLETED" });
          }
          if (remoteStatus === "FAILED" || remoteStatus === "REJECTED") {
            const reason =
              record?.failureReason?.failureMessage ||
              record?.rejectionReason?.rejectionMessage ||
              "Paiement refusé";
            await supabaseAdmin.rpc("apply_pawapay_failure", {
              _deposit_id: depositId,
              _status: remoteStatus,
              _reason: reason,
              _callback: record,
            });
            return json({ status: remoteStatus, failure_reason: reason });
          }
          return json({ status: remoteStatus });
        } catch (e: any) {
          return json({ status: tx.status, error: e?.message }, 200);
        }
      },
    },
  },
});
