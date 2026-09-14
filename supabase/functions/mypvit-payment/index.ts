import {
  config,
  corsHeaders,
  database,
  failure,
  getSecret,
  initiate,
  json,
  reconcile,
} from "../_shared/mypvit.ts";
import {
  normalizePhone,
  publicTransaction,
  type Transaction,
} from "../_shared/mypvit-protocol.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, req);
  try {
    const db = database();
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) {
      return json({ error: "Session expirée. Reconnectez-vous." }, 401, req);
    }
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) {
      return json({ error: "Session expirée. Reconnectez-vous." }, 401, req);
    }
    const body = await req.json();
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (body.action === "status") {
      if (typeof body.id !== "string" || !uuid.test(body.id)) {
        return json({ error: "Identifiant invalide." }, 400, req);
      }
      const { data, error } = await db.from("mypvit_transactions").select("*")
        .eq("id", body.id).eq("user_id", auth.user.id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("FORBIDDEN");
      let tx = data as Transaction;
      if (tx.status === "PENDING" && !tx.submitted_at) {
        const c = config();
        tx = await initiate(db, c, tx, await getSecret(db, c));
      }
      // Atomic polling lease avoids flooding the provider from multiple tabs.
      if (tx.status === "PENDING" && tx.provider_id) {
        const { data: claimed, error: claimError } = await db.from(
          "mypvit_transactions",
        ).update({ checked_at: new Date().toISOString() })
          .eq("id", tx.id).or(
            `checked_at.is.null,checked_at.lt.${
              new Date(Date.now() - 10000).toISOString()
            }`,
          ).select("id").maybeSingle();
        if (claimError) throw claimError;
        if (claimed) tx = await reconcile(db, config(), tx);
      }
      return json({ transaction: publicTransaction(tx) }, 200, req);
    }
    if (
      !["reservation", "wallet_recharge"].includes(body.purpose) ||
      (body.purpose === "reservation" &&
        (typeof body.reservationId !== "string" ||
          !uuid.test(body.reservationId)))
    ) {
      return json({ error: "Réservation invalide." }, 400, req);
    }
    if (body.action === "current") {
      let query = db.from("mypvit_transactions").select("*").eq(
        "user_id",
        auth.user.id,
      ).eq("purpose", body.purpose).eq("status", "PENDING");
      query = body.purpose === "reservation"
        ? query.eq("reservation_id", body.reservationId)
        : query.is("reservation_id", null);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return json({
        transaction: data ? publicTransaction(data as Transaction) : null,
      }, 200, req);
    }
    if (
      body.action !== "start" ||
      !["airtel_money", "moov_money"].includes(body.channel) ||
      typeof body.requestId !== "string" || !uuid.test(body.requestId) ||
      !Number.isSafeInteger(body.amount) || body.amount <= 0 ||
      body.amount > 2147483647
    ) {
      return json({ error: "Demande de paiement invalide." }, 400, req);
    }
    const phone = normalizePhone(body.phone);
    const c = config();
    const secret = await getSecret(db, c);
    const { data, error } = await db.rpc("mypvit_prepare", {
      _user: auth.user.id,
      _request: body.requestId,
      _purpose: body.purpose,
      _reservation: body.purpose === "reservation" ? body.reservationId : null,
      _amount: body.amount,
      _channel: body.channel,
      _phone: phone,
      _operator: body.channel === "airtel_money"
        ? c.airtel_money
        : c.moov_money,
      _account: c.account,
    });
    if (error) throw error;
    const tx = await initiate(db, c, data as Transaction, secret);
    return json({ transaction: publicTransaction(tx) }, 200, req);
  } catch (error) {
    return failure(error, req);
  }
});
