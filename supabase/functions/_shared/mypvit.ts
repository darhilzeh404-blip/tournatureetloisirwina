import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  paymentPayload,
  type Transaction,
  verifiedStatus,
} from "./mypvit-protocol.ts";

function allowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function corsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("origin");
  const allowed = origin && allowedOrigins().has(origin) ? origin : null;
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": allowed } : {}),
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function json(body: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
export function env(name: string, fallback?: string) {
  const value = Deno.env.get(name)?.trim() || fallback;
  if (!value) throw new Error("PAYMENT_NOT_CONFIGURED");
  return value;
}
export function config() {
  const base = env("MYPVIT_BASE_URL", "https://api.mypvit.pro/v2").replace(
    /\/$/,
    "",
  );
  if (!base.startsWith("https://")) throw new Error("PAYMENT_NOT_CONFIGURED");
  const c = {
    base,
    statusBase: env("MYPVIT_STATUS_BASE_URL", base.replace(/\/v2$/, "")),
    account: env("MYPVIT_OPERATION_ACCOUNT_CODE"),
    password: env("MYPVIT_SECRET_PASSWORD"),
    secretCode: env("MYPVIT_CODE_URL_SECRET"),
    paymentCode: env("MYPVIT_CODE_URL_PAYMENT"),
    statusCode: env("MYPVIT_CODE_URL_STATUS"),
    callback: env("MYPVIT_CALLBACK_URL_CODE"),
    owner: env("MYPVIT_OWNER_CHARGE", "CUSTOMER"),
    operatorOwner: env("MYPVIT_OWNER_CHARGE_OPERATOR", "CUSTOMER"),
    airtel_money: env("MYPVIT_AIRTEL_OPERATOR_CODE", "AIRTEL_MONEY"),
    moov_money: env("MYPVIT_MOOV_OPERATOR_CODE", "MOOV_MONEY"),
  };
  if (
    ![c.owner, c.operatorOwner].every((v) =>
      ["CUSTOMER", "MERCHANT"].includes(v)
    )
  ) throw new Error("PAYMENT_NOT_CONFIGURED");
  return c;
}
export function database() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}
type Database = ReturnType<typeof database>;
type Config = ReturnType<typeof config>;

class ProviderError extends Error {
  constructor(
    readonly phase: "renew_secret" | "payment" | "status",
    readonly httpStatus: number | null,
    readonly providerCode: string | null,
    readonly providerMessage: string | null,
  ) {
    super(`MYPVIT_${phase.toUpperCase()}_FAILED`);
  }
}

function providerText(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 300)
    : null;
}

function providerError(
  phase: ProviderError["phase"],
  response: Response,
  body: Record<string, unknown>,
) {
  return new ProviderError(
    phase,
    response.status,
    providerText(body.error) ?? providerText(body.code) ?? providerText(body.status_code),
    providerText(body.message),
  );
}

function logProviderError(error: unknown) {
  if (error instanceof ProviderError) {
    // Deliberately exclude request headers, payloads and all secret values.
    console.warn("mypvit_provider_error", JSON.stringify({
      phase: error.phase,
      httpStatus: error.httpStatus,
      providerCode: error.providerCode,
      providerMessage: error.providerMessage,
    }));
    return;
  }
  console.warn("mypvit_provider_error", JSON.stringify({
    phase: "network_or_response",
    error: error instanceof Error ? error.name : "UnknownError",
  }));
}

async function responseBody(
  response: Response,
): Promise<Record<string, unknown>> {
  const body = await response.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("PROVIDER_UNAVAILABLE");
  }
  return body;
}

export async function getSecret(db: Database, c: Config): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const { data, error } = await db.rpc("mypvit_claim_secret", {
      _account: c.account,
    });
    if (error) throw error;
    if (data.secret) return data.secret;
    if (data.renew) {
      try {
        const res = await fetch(
          `${c.base}/${encodeURIComponent(c.secretCode)}/renew-secret`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
            },
            body: new URLSearchParams({
              operationAccountCode: c.account,
              password: c.password,
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        const body = await responseBody(res);
        if (
          !res.ok || typeof body.secret !== "string" || !body.secret ||
          body.operation_account_code !== c.account ||
          typeof body.expires_in !== "number" || body.expires_in <= 120
        ) throw providerError("renew_secret", res, body);
        const { error: saveError } = await db.from("mypvit_secrets").update({
          secret: body.secret,
          expires_at: new Date(Date.now() + body.expires_in * 1000)
            .toISOString(),
          lease_until: null,
        }).eq("account_code", c.account);
        if (saveError) throw saveError;
        return body.secret;
      } catch (error) {
        logProviderError(error);
        await db.from("mypvit_secrets").update({ lease_until: null }).eq(
          "account_code",
          c.account,
        );
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("PROVIDER_UNAVAILABLE");
}

export async function settle(
  db: Database,
  tx: Transaction,
  status: string,
  providerId: string | null,
) {
  const { data, error } = await db.rpc("mypvit_settle", {
    _id: tx.id,
    _status: status,
    _provider_id: providerId,
  });
  if (error) throw error;
  return data as Transaction;
}

export async function reconcile(
  db: Database,
  c: Config,
  tx: Transaction,
  providerId = tx.provider_id,
): Promise<Transaction> {
  if (tx.status !== "PENDING" || !providerId) return tx;
  if (tx.account_code !== c.account) throw new Error("PROVIDER_MISMATCH");
  const url = new URL(
    `${c.statusBase.replace(/\/$/, "")}/${
      encodeURIComponent(c.statusCode)
    }/status`,
  );
  url.search = new URLSearchParams({
    transactionId: providerId,
    accountOperationCode: tx.account_code,
    transactionOperation: "PAYMENT",
  }).toString();
  let secret = await getSecret(db, c);
  let res = await fetch(url, {
    headers: { "X-Secret": secret, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 401 || res.status === 403) {
    // Invalidate only the key that failed, preserving a concurrent renewal.
    const { error } = await db.from("mypvit_secrets").update({
      expires_at: null,
    }).eq("account_code", c.account).eq("secret", secret);
    if (error) throw error;
    secret = await getSecret(db, c);
    res = await fetch(url, {
      headers: { "X-Secret": secret, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  }
  const body = await responseBody(res);
  if (!res.ok) throw providerError("status", res, body);
  const status = verifiedStatus(body, tx);
  if (status !== "PENDING") return settle(db, tx, status, providerId);
  const { error } = await db.from("mypvit_transactions").update({
    provider_id: providerId,
  }).eq("id", tx.id).is("provider_id", null);
  if (error) throw error;
  return tx;
}

export async function initiate(
  db: Database,
  c: Config,
  tx: Transaction,
  secret: string,
): Promise<Transaction> {
  if (tx.status !== "PENDING" || tx.submitted_at) return tx;
  const { data: claim, error } = await db.from("mypvit_transactions").update({
    submitted_at: new Date().toISOString(),
  })
    .eq("id", tx.id).eq("status", "PENDING").is("submitted_at", null).select(
      "id",
    ).maybeSingle();
  if (error) throw error;
  if (!claim) return tx;
  // Never automatically replay a debit after timeout or an ambiguous response.
  try {
    const res = await fetch(
      `${c.base}/${encodeURIComponent(c.paymentCode)}/rest`,
      {
        method: "POST",
        headers: {
          "X-Secret": secret,
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Callback-MediaType": "application/json",
        },
        body: JSON.stringify(paymentPayload(tx, c)),
        signal: AbortSignal.timeout(20000),
      },
    );
    const body = await responseBody(res);
    if (!res.ok && ![400, 401, 403, 422].includes(res.status)) {
      throw providerError("payment", res, body);
    }
    if (
      [400, 401, 403, 422].includes(res.status) &&
      typeof body.error === "string" && !body.reference_id
    ) {
      if (res.status === 401 || res.status === 403) {
        const { error: invalidateError } = await db.from("mypvit_secrets")
          .update({ expires_at: null }).eq("account_code", c.account).eq(
            "secret",
            secret,
          );
        if (invalidateError) throw invalidateError;
      }
      return await settle(db, tx, "FAILED", null);
    }
    if (
      typeof body.reference_id !== "string" || !body.reference_id ||
      body.merchant_reference_id !== tx.reference ||
      body.merchant_operation_account_code !== tx.account_code
    ) return tx;
    const { error: saveError } = await db.from("mypvit_transactions").update({
      provider_id: body.reference_id,
    })
      .eq("id", tx.id).is("provider_id", null);
    if (saveError) throw saveError;
    tx = { ...tx, provider_id: body.reference_id };
    if (body.status === "SUCCESS" || body.status === "FAILED") {
      return await reconcile(db, c, tx);
    }
  } catch (error) {
    logProviderError(error);
    console.warn("MyPVit initiation uncertain", tx.id);
  }
  return tx;
}

const messages: Record<string, string> = {
  PAYMENT_NOT_CONFIGURED: "Le paiement mobile est temporairement indisponible.",
  INVALID_PHONE: "Numéro Mobile Money gabonais invalide.",
  INVALID_AMOUNT: "Montant invalide. Recharge : de 500 à 1 000 000 FCFA.",
  AMOUNT_CHANGED: "Le montant dû a changé. Actualisez la réservation.",
  PAYMENT_ALREADY_PENDING:
    "Un paiement est déjà en attente pour cette réservation.",
  NOT_PAYABLE: "Cette réservation ne peut plus être payée.",
  RATE_LIMITED: "Trop de tentatives. Réessayez plus tard.",
  FORBIDDEN: "Paiement introuvable ou accès refusé.",
};
export function failure(error: unknown) {
  if (error instanceof ProviderError) {
    logProviderError(error);
    let message = "Le service MyPVIT est temporairement indisponible.";
    if (error.httpStatus === 401) {
      message = "MyPVIT a refusé l’authentification : vérifiez le mot de passe API et le Code URL Secret.";
    } else if (error.httpStatus === 403) {
      message = "MyPVIT a bloqué cet appel : vérifiez l’activation de l’API/URL et l’autorisation IP.";
    } else if (error.httpStatus === 404) {
      message = "MyPVIT ne reconnaît pas un Code URL : vérifiez les codes Secret, Paiement et Statut.";
    }
    return json({ error: message }, 503);
  }
  const code = error instanceof Error
    ? error.message
    : String((error as { message?: string })?.message ?? "");
  console.warn(
    "MyPVit request failed",
    Object.keys(messages).find((key) => code.includes(key)) ?? "INTERNAL",
  );
  const key = Object.keys(messages).find((key) => code.includes(key));
  return json({
    error: key
      ? messages[key]
      : "Vérification du paiement indisponible. Réessayez dans quelques instants.",
  }, key === "FORBIDDEN" ? 403 : 503);
}
