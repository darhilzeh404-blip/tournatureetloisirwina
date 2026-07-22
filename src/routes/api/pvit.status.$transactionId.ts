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

export const Route = createFileRoute("/api/pvit/status/$transactionId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const token = process.env.PVIT_API_TOKEN;
        const codeUrl = process.env.PVIT_CODE_URL;
        if (!token || !codeUrl) return json({ error: "MyPVit non configuré" }, 500);

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
        const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
        if (!userData.user) return json({ error: "Invalid session" }, 401);

        const transactionId = params.transactionId;
        const { data: tx } = await (supabaseAdmin.from("pvit_transactions") as any)
          .select("*").eq("transaction_id", transactionId).maybeSingle();
        if (!tx || tx.user_id !== userData.user.id) return json({ error: "Not found" }, 404);

        if (["SUCCESS", "FAILED", "EXPIRED"].includes(tx.status)) {
          return json({ status: tx.status, failure_reason: tx.failure_reason });
        }

        // Interroge MyPVit pour statut à jour
        try {
          const res = await fetch(`${pvitBase()}/${codeUrl}/status/${transactionId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "x-api-key": token,
            },
          });
          const payload: any = await res.json().catch(() => ({}));
          const record = payload?.data || payload;
          const remote = String(record?.status || record?.state || "").toUpperCase();

          if (remote === "SUCCESS" || remote === "COMPLETED" || remote === "PAID") {
            await (supabaseAdmin.rpc as any)("apply_pvit_completion", {
              _transaction_id: transactionId,
              _callback: record,
            });
            return json({ status: "SUCCESS" });
          }
          if (remote === "FAILED" || remote === "REJECTED" || remote === "EXPIRED") {
            const reason = record?.reason || record?.message || "Paiement refusé";
            const status = remote === "EXPIRED" ? "EXPIRED" : "FAILED";
            await (supabaseAdmin.rpc as any)("apply_pvit_failure", {
              _transaction_id: transactionId,
              _status: status,
              _reason: reason,
              _callback: record,
            });
            return json({ status, failure_reason: reason });
          }
          return json({ status: remote || tx.status });
        } catch (e: any) {
          return json({ status: tx.status, error: e?.message }, 200);
        }
      },
    },
  },
});
