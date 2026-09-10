import {
  config,
  database,
  failure,
  json,
  reconcile,
} from "../_shared/mypvit.ts";
import type { Transaction } from "../_shared/mypvit-protocol.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    if (
      typeof body.transactionId !== "string" ||
      body.transactionId.length > 100 ||
      typeof body.merchantReferenceId !== "string" ||
      body.merchantReferenceId.length > 20 ||
      !["string", "number"].includes(typeof body.code)
    ) return json({ error: "Invalid callback" }, 400);
    const db = database();
    const { data, error } = await db.from("mypvit_transactions").select("*").eq(
      "reference",
      body.merchantReferenceId,
    ).maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Unknown reference" }, 404);
    const tx = data as Transaction;
    if (
      (tx.provider_id && tx.provider_id !== body.transactionId) ||
      body.accountOperationCode !== tx.account_code ||
      body.transactionOperation !== "PAYMENT" || body.amount !== tx.amount
    ) return json({ error: "Callback mismatch" }, 400);
    // Callbacks are unsigned: only an authenticated status response can settle money.
    const result = await reconcile(db, config(), tx, body.transactionId);
    if (result.status === "PENDING") {
      return json({ error: "Status not yet final" }, 503);
    }
    return json({ transactionId: body.transactionId, responseCode: body.code });
  } catch (error) {
    return failure(error);
  }
});
