import {
  type config,
  type database,
  getSecret,
  initiate,
  reconcile,
} from "./mypvit.ts";
import type { Transaction } from "./mypvit-protocol.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}
const tx: Transaction = {
  id: "tx1",
  user_id: "user",
  reference: "WINA123",
  purpose: "wallet_recharge",
  reservation_id: null,
  amount: 500,
  channel: "airtel_money",
  phone: "077123456",
  account_code: "ACC_TEST",
  operator_code: "AIRTEL_MONEY",
  provider_id: null,
  status: "PENDING",
  submitted_at: null,
  checked_at: null,
  created_at: "",
};
const c: ReturnType<typeof config> = {
  base: "https://api.mypvit.pro/v2",
  statusBase: "https://api.mypvit.pro",
  account: "ACC_TEST",
  password: "password with spaces",
  secretCode: "SECRET",
  paymentCode: "REST",
  statusCode: "CHECK",
  callback: "CALLBACK",
  owner: "CUSTOMER",
  operatorOwner: "MERCHANT",
  airtel_money: "AIRTEL_MONEY",
  moov_money: "MOOV_MONEY",
};

function fakeDatabase(rpcData: unknown[] = [], rows: unknown[] = []) {
  const calls: { name: string; args: unknown }[] = [];
  const updates: unknown[] = [];
  const db = {
    rpc(name: string, args: unknown) {
      calls.push({ name, args });
      return Promise.resolve({ data: rpcData.shift(), error: null });
    },
    from(_table: string) {
      const chain = {
        update(value: unknown) {
          updates.push(value);
          return chain;
        },
        eq() {
          return chain;
        },
        is() {
          return chain;
        },
        select() {
          return chain;
        },
        maybeSingle() {
          return Promise.resolve({ data: rows.shift() ?? null, error: null });
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return chain;
    },
  };
  return { db: db as unknown as ReturnType<typeof database>, calls, updates };
}
async function withFetch(mock: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

Deno.test("cached shared secret does not call renewal", async () => {
  const { db } = fakeDatabase([{ secret: "cached" }]);
  await withFetch(() => {
    throw new Error("Unexpected renewal");
  }, async () => equal(await getSecret(db, c), "cached"));
});
Deno.test("renewal uses URL-encoded fields and persists expiration", async () => {
  const { db, updates } = fakeDatabase([{ renew: true }]);
  await withFetch(async (url, init) => {
    equal(String(url), "https://api.mypvit.pro/v2/SECRET/renew-secret");
    const form = init?.body as URLSearchParams;
    equal(form.get("operationAccountCode"), "ACC_TEST");
    equal(form.get("password"), "password with spaces");
    return Response.json({
      secret: "renewed",
      operation_account_code: "ACC_TEST",
      expires_in: 3600,
    });
  }, async () => {
    equal(await getSecret(db, c), "renewed");
    equal((updates[0] as { secret: string }).secret, "renewed");
  });
});
Deno.test("accepted PENDING initiation records provider ID without crediting", async () => {
  const { db, calls } = fakeDatabase([], [{ id: tx.id }]);
  await withFetch(async (_url, init) => {
    equal(new Headers(init?.headers).get("X-Secret"), "secret");
    return Response.json({
      status: "PENDING",
      reference_id: "PAY1",
      merchant_reference_id: tx.reference,
      merchant_operation_account_code: tx.account_code,
    });
  }, async () => {
    const result = await initiate(db, c, tx, "secret");
    equal(result.provider_id, "PAY1");
    equal(result.status, "PENDING");
    equal(calls.length, 0);
  });
});
Deno.test("timeout remains pending and a claimed debit is never replayed", async () => {
  const { db, calls } = fakeDatabase([], [{ id: tx.id }]);
  let attempts = 0;
  await withFetch(() => {
    attempts++;
    throw new Error("timeout");
  }, async () => {
    equal((await initiate(db, c, tx, "secret")).status, "PENDING");
    await initiate(
      db,
      c,
      { ...tx, submitted_at: new Date().toISOString() },
      "secret",
    );
    equal(attempts, 1);
    equal(calls.length, 0);
  });
});
Deno.test("definite validation rejection marks FAILED without a provider ID", async () => {
  const { db, calls } = fakeDatabase([{ ...tx, status: "FAILED" }], [{
    id: tx.id,
  }]);
  await withFetch(
    async () =>
      Response.json({ error: "CONSTRAINT_VIOLATION" }, { status: 400 }),
    async () => {
      equal((await initiate(db, c, tx, "secret")).status, "FAILED");
      equal(calls[0].args, {
        _id: tx.id,
        _status: "FAILED",
        _provider_id: null,
      });
    },
  );
});
Deno.test("only the authenticated matching status settles a transaction; status URL has no v2", async () => {
  const { db, calls } = fakeDatabase([{ secret: "cached" }, {
    ...tx,
    status: "SUCCESS",
  }]);
  await withFetch(async (input, init) => {
    const url = new URL(String(input));
    equal(url.pathname, "/CHECK/status");
    equal(url.searchParams.get("transactionId"), "PAY1");
    equal(url.searchParams.get("transactionOperation"), "PAYMENT");
    equal(new Headers(init?.headers).get("X-Secret"), "cached");
    return Response.json({
      status: "SUCCESS",
      amount: 500,
      operator: tx.operator_code,
      merchant_reference_id: tx.reference,
      merchant_operation_account_code: tx.account_code,
      customer_account_number: tx.phone,
    });
  }, async () => {
    equal((await reconcile(db, c, tx, "PAY1")).status, "SUCCESS");
    equal(calls[1].args, {
      _id: tx.id,
      _status: "SUCCESS",
      _provider_id: "PAY1",
    });
  });
});
Deno.test("a mismatched amount cannot settle a transaction", async () => {
  const { db, calls } = fakeDatabase([{ secret: "cached" }]);
  await withFetch(
    async () =>
      Response.json({
        status: "SUCCESS",
        amount: 1,
        operator: tx.operator_code,
        merchant_reference_id: tx.reference,
        merchant_operation_account_code: tx.account_code,
        customer_account_number: tx.phone,
      }),
    async () => {
      let message = "";
      try {
        await reconcile(db, c, tx, "PAY1");
      } catch (error) {
        message = (error as Error).message;
      }
      equal(message, "PROVIDER_MISMATCH");
      equal(calls.length, 1);
    },
  );
});
