import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function corsHeaders(req?: Request) {
  const origin = req?.headers.get("origin");
  const allowed = new Set((Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  return {
    ...(origin && allowed.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    Vary: "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function normalizePlate(s: string) {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function normalizePhone(s: string) {
  return (s || "").replace(/\s/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, req);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server not configured" }, 500, req);

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401, req);
  const token = authHeader.slice(7);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u.user) return json({ error: "Invalid session" }, 401, req);

  const { data: roles } = await admin
    .from("user_roles").select("role").eq("user_id", u.user.id);
  if (!roles?.some((r: any) => r.role === "admin")) return json({ error: "Forbidden" }, 403, req);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400, req); }

  const full_name = String(body?.full_name ?? "").trim();
  const vehicle_type = String(body?.vehicle_type ?? "Sedan").trim();
  const category_raw = String(body?.category ?? "STANDARD").toUpperCase();
  const category = ["STANDARD", "CONFORT", "VIP"].includes(category_raw) ? category_raw : "STANDARD";
  const license_plate = normalizePlate(String(body?.license_plate ?? ""));
  const phone = normalizePhone(String(body?.phone ?? ""));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!full_name || !email || !password || !license_plate) {
    return json({ error: "Champs requis manquants" }, 400, req);
  }
  if (password.length < 8) return json({ error: "Mot de passe min 8 caractères" }, 400, req);

  const { data: dupPlate } = await admin
    .from("drivers").select("id").eq("license_plate", license_plate).maybeSingle();
  if (dupPlate) return json({ error: "Cette immatriculation existe déjà" }, 409, req);
  if (phone) {
    const { data: dupPhone } = await admin
      .from("drivers").select("id").eq("phone", phone).maybeSingle();
    if (dupPhone) return json({ error: "Ce numéro de téléphone existe déjà" }, 409, req);
  }

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name },
  });
  if (cErr || !created.user) return json({ error: cErr?.message || "Création échouée" }, 400, req);

  const uid = created.user.id;

  await admin.from("profiles").upsert(
    { user_id: uid, full_name, email, phone, status: "actif" },
    { onConflict: "user_id" },
  );
  await admin.from("user_roles").delete().eq("user_id", uid);
  await admin.from("user_roles").insert({ user_id: uid, role: "chauffeur" });

  const { error: dErr } = await admin.from("drivers").insert({
    user_id: uid, full_name, vehicle_type, category, license_plate, phone, email, status: "actif",
  });
  if (dErr) {
    const msg = dErr.message || "";
    if ((dErr as any).code === "23505" || /duplicate key|unique/i.test(msg)) {
      const which = /phone/i.test(msg) ? "téléphone" : "immatriculation";
      return json({ error: `Doublon: ${which} déjà utilisé(e)` }, 409, req);
    }
    return json({ error: `Driver créé partiellement: ${msg}` }, 500, req);
  }

  return json({ success: true, user_id: uid, email }, 200, req);
});
