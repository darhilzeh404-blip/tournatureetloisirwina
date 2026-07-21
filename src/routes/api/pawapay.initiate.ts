import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function pawapayBase() {
  // Sandbox par défaut (le token PawaPay détermine l'environnement)
  return process.env.PAWAPAY_BASE_URL || "https://api.sandbox.pawapay.io";
}

function normalizeMsisdn(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  // Gabon: 8 chiffres locaux, préfixé par 241
  if (digits.startsWith("241") && digits.length >= 11) return digits.slice(0, 11);
  if (digits.length === 8) return "241" + digits;
  if (digits.length === 9 && digits.startsWith("0")) return "241" + digits.slice(1);
  return digits;
}

export const Route = createFileRoute("/api/pawapay/initiate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.PAWAPAY_API_TOKEN;
        if (!token) return json({ error: "PawaPay non configuré" }, 500);

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
        const provider = String(body?.provider || ""); // AIRTEL_MMO_GAB | MOOV_MMO_GAB
        const rawPhone = String(body?.phone || "");
        const description = String(body?.description || "Paiement Wina").slice(0, 22);

        if (!["reservation", "wallet_recharge", "partner_booking"].includes(purpose)) {
          return json({ error: "purpose invalide" }, 400);
        }
        if (!relatedId || !amount || amount <= 0) return json({ error: "Paramètres invalides" }, 400);
        if (!["AIRTEL_MMO_GAB", "MOOV_MMO_GAB"].includes(provider)) {
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
        }

        // Génère un depositId UUID
        const depositId = crypto.randomUUID();

        // Insert la tx en base avant l'appel
        const { error: insErr } = await supabaseAdmin.from("pawapay_transactions").insert({
          deposit_id: depositId,
          user_id: userId,
          amount,
          provider,
          payer_msisdn: msisdn,
          status: "SUBMITTED",
          purpose,
          related_id: relatedId,
          metadata: { description },
        });
        if (insErr) return json({ error: "DB error: " + insErr.message }, 500);

        // Appel API PawaPay
        const pawapayBody = {
          depositId,
          amount: String(amount),
          currency: "XAF",
          country: "GAB",
          correspondent: provider,
          payer: { type: "MSISDN", address: { value: msisdn } },
          customerTimestamp: new Date().toISOString(),
          statementDescription: description.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 22) || "Wina",
        };

        let pawapayResponse: any = null;
        let pawapayStatus = 0;
        try {
          const res = await fetch(`${pawapayBase()}/deposits`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(pawapayBody),
          });
          pawapayStatus = res.status;
          pawapayResponse = await res.json().catch(() => ({}));
        } catch (e: any) {
          await supabaseAdmin.from("pawapay_transactions").update({
            status: "FAILED",
            failure_reason: "Réseau: " + (e?.message || "unknown"),
          }).eq("deposit_id", depositId);
          return json({ error: "Erreur réseau PawaPay" }, 502);
        }

        const acceptedStatus = pawapayResponse?.status || "";
        const isAccepted = pawapayStatus < 400 && acceptedStatus === "ACCEPTED";

        await supabaseAdmin.from("pawapay_transactions").update({
          status: isAccepted ? "ACCEPTED" : "FAILED",
          initiate_response: pawapayResponse,
          failure_reason: isAccepted ? null : (pawapayResponse?.rejectionReason?.rejectionMessage || pawapayResponse?.errorMessage || `HTTP ${pawapayStatus}`),
        }).eq("deposit_id", depositId);

        if (!isAccepted) {
          return json({
            error: "Paiement refusé par l'opérateur",
            detail: pawapayResponse,
          }, 400);
        }

        return json({ success: true, depositId });
      },
    },
  },
});
