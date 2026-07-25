import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function pvitBase() {
  // Base API MyPVit — configurable, sinon URL par défaut du provider
  return process.env.PVIT_BASE_URL || "https://api.mypvit.pro";
}

function normalizeMsisdn(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("241") && digits.length >= 11) return digits.slice(0, 11);
  if (digits.length === 8) return "241" + digits;
  if (digits.length === 9 && digits.startsWith("0")) return "241" + digits.slice(1);
  return digits;
}

function newTransactionId(): string {
  // Référence unique, préfixée WINA + timestamp + aléatoire (compatible tout navigateur)
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WINA${Date.now()}${rand}`;
}

export const Route = createFileRoute("/api/pvit/initiate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.PVIT_API_TOKEN;
        const codeUrl = process.env.PVIT_CODE_URL;
        if (!token || !codeUrl) return json({ error: "MyPVit non configuré" }, 500);

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(
          authHeader.slice(7),
        );
        if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
        const userId = userData.user.id;

        let body: any;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

        const purpose = String(body?.purpose || "");
        const relatedId = String(body?.related_id || "");
        const amount = Math.floor(Number(body?.amount));
        const operator = String(body?.operator || ""); // airtelmoney | moovmoney
        const rawPhone = String(body?.phone || "");
        const description = String(body?.description || "Paiement Wina").slice(0, 60);

        if (!["reservation", "wallet_recharge", "partner_booking", "flight_booking"].includes(purpose)) {
          return json({ error: "purpose invalide" }, 400);
        }
        if (!relatedId || !amount || amount <= 0) return json({ error: "Paramètres invalides" }, 400);
        if (!["airtelmoney", "moovmoney"].includes(operator)) {
          return json({ error: "Opérateur invalide" }, 400);
        }
        const msisdn = normalizeMsisdn(rawPhone);
        if (!msisdn || msisdn.length < 11) return json({ error: "Numéro invalide" }, 400);

        // Vérifier l'ownership selon purpose
        if (purpose === "reservation") {
          const { data: r } = await supabaseAdmin
            .from("reservations").select("id,user_id,total_amount,paid_amount")
            .eq("id", relatedId).maybeSingle();
          if (!r || r.user_id !== userId) return json({ error: "Réservation introuvable" }, 404);
        } else if (purpose === "wallet_recharge") {
          if (relatedId !== userId) return json({ error: "Recharge invalide" }, 400);
        } else if (purpose === "partner_booking") {
          const { data: b } = await supabaseAdmin
            .from("partner_bookings").select("id,user_id,total_amount")
            .eq("id", relatedId).maybeSingle();
          if (!b || b.user_id !== userId) return json({ error: "Réservation introuvable" }, 404);
        } else if (purpose === "flight_booking") {
          const { data: fb } = await (supabaseAdmin.from("flight_bookings") as any)
            .select("id,user_id,total_amount,status")
            .eq("id", relatedId).maybeSingle();
          if (!fb || fb.user_id !== userId) return json({ error: "Dossier vol introuvable" }, 404);
          if (fb.status === "CONFIRMED" || fb.status === "PAID") {
            return json({ error: "Dossier déjà payé" }, 400);
          }
        }

        const transactionId = newTransactionId();

        const { error: insErr } = await (supabaseAdmin.from("pvit_transactions") as any).insert({
          transaction_id: transactionId,
          user_id: userId,
          amount,
          operator,
          payer_msisdn: msisdn,
          status: "PENDING",
          purpose,
          related_id: relatedId,
          metadata: { description },
        });
        if (insErr) return json({ error: "DB error: " + insErr.message }, 500);

        // Callback public
        const origin = request.headers.get("origin") || new URL(request.url).origin;
        const callbackUrl = process.env.PVIT_CALLBACK_URL || `${origin}/api/public/pvit/callback`;

        // Corps MyPVit — service RESTLINK (push USSD direct)
        const pvitBody = {
          service: "RESTLINK",
          agent: msisdn,
          reference: transactionId,
          amount,
          operator, // airtelmoney | moovmoney
          callback_url: callbackUrl,
          product_name: description,
          customer_account_number: msisdn,
        };

        let pvitResponse: any = null;
        let pvitStatus = 0;
        try {
          const res = await fetch(`${pvitBase()}/${codeUrl}/link`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              "x-api-key": token,
            },
            body: JSON.stringify(pvitBody),
          });
          pvitStatus = res.status;
          pvitResponse = await res.json().catch(() => ({}));
        } catch (e: any) {
          await (supabaseAdmin.from("pvit_transactions") as any).update({
            status: "FAILED",
            failure_reason: "Réseau: " + (e?.message || "unknown"),
          }).eq("transaction_id", transactionId);
          return json({ error: "Erreur réseau MyPVit" }, 502);
        }

        const okStatus = pvitStatus < 400;
        const merchantOpId =
          pvitResponse?.merchant_operation_id ||
          pvitResponse?.data?.merchant_operation_id ||
          pvitResponse?.transaction_id ||
          null;

        await (supabaseAdmin.from("pvit_transactions") as any).update({
          status: okStatus ? "ACCEPTED" : "FAILED",
          merchant_operation_id: merchantOpId,
          initiate_response: pvitResponse,
          failure_reason: okStatus ? null : (pvitResponse?.message || pvitResponse?.error || `HTTP ${pvitStatus}`),
        }).eq("transaction_id", transactionId);

        if (!okStatus) {
          return json({
            error: "Paiement refusé par MyPVit",
            detail: pvitResponse,
          }, 400);
        }

        return json({ success: true, transactionId });
      },
    },
  },
});
