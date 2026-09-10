import {
  config,
  database,
  env,
  failure,
  json,
  reconcile,
} from "../_shared/mypvit.ts";
import type { Transaction } from "../_shared/mypvit-protocol.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    if (
      req.headers.get("authorization") !==
        `Bearer ${env("MYPVIT_RECONCILE_TOKEN")}`
    ) return json({ error: "Unauthorized" }, 401);
    const db = database();
    const c = config();
    const { data, error } = await db.from("mypvit_transactions").select("*").eq(
      "status",
      "PENDING",
    )
      .not("provider_id", "is", null).lt(
        "submitted_at",
        new Date(Date.now() - 180000).toISOString(),
      )
      .order("checked_at", { ascending: true, nullsFirst: true }).limit(5);
    if (error) throw error;
    let processed = 0;
    for (const row of data ?? []) {
      try {
        const { error: updateError } = await db.from("mypvit_transactions")
          .update({ checked_at: new Date().toISOString() }).eq("id", row.id);
        if (updateError) throw updateError;
        await reconcile(db, c, row as Transaction);
        processed++;
      } catch {
        console.warn("MyPVit reconciliation deferred", row.id);
      }
    }
    return json({ processed, selected: data?.length ?? 0 });
  } catch (error) {
    return failure(error);
  }
});
