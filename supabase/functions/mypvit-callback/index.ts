import {
  database,
  failure,
  json,
  corsHeaders,
  config,
  reconcile,
} from "../_shared/mypvit.ts";
import { normalizePhone, type Transaction } from "../_shared/mypvit-protocol.ts";

function callbackSourceAllowed(req: Request) {
  const raw = Deno.env.get("MYPVIT_CALLBACK_ALLOWED_IPS")?.trim();
  // An empty list keeps Sandbox backwards-compatible. Production sets the
  // official MyPVIT source addresses as an additional webhook safeguard.
  if (!raw) return true;
  const allowed = new Set(raw.split(",").map((ip) => ip.trim()).filter(Boolean));
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",").map((ip) => ip.trim()).some((ip) => allowed.has(ip));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, req);
  if (!callbackSourceAllowed(req)) return json({ error: "Callback source forbidden" }, 403, req);
  try {
    const body = await req.json();
    if (
      typeof body.transactionId !== "string" ||
      body.transactionId.length > 100 ||
      typeof body.merchantReferenceId !== "string" ||
      body.merchantReferenceId.length > 20 ||
      !["string", "number"].includes(typeof body.code) ||
      !["SUCCESS", "FAILED"].includes(body.status) ||
      typeof body.amount !== "number" ||
      typeof body.accountOperationCode !== "string" ||
      typeof body.transactionOperation !== "string" ||
      typeof body.operator !== "string" ||
      typeof body.customerID !== "string"
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
      body.transactionOperation !== "PAYMENT" ||
      body.amount !== tx.amount ||
      body.operator !== tx.operator_code ||
      normalizePhone(body.customerID) !== tx.phone
    ) return json({ error: "Callback mismatch" }, 400);

    // MyPVIT defines this webhook as the final notification. We validate every
    // immutable field against the transaction created server-side, then use the
    // idempotent database RPC so callback retries cannot credit twice. Check
    // Status remains the fallback when a callback is never delivered.
    // Never trust the callback-supplied status: re-verify server-to-server with
    // MyPVit's authenticated status API before settling.
    await reconcile(db, config(), tx, body.transactionId);
    return json({ transactionId: body.transactionId, responseCode: body.code }, 200, req);
  } catch (error) {
    return failure(error, req);
  }
});
