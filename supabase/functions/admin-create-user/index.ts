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

const ALLOWED_ROLES = ["admin", "gerant", "chauffeur", "client", "agence"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

function json(body: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
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

  const { data: userData, error: ue } = await admin.auth.getUser(token);
  if (ue || !userData.user) return json({ error: "Invalid session" }, 401, req);

  const { data: roles } = await admin
    .from("user_roles").select("role").eq("user_id", userData.user.id);
  if (!roles?.some((r: any) => r.role === "admin")) return json({ error: "Forbidden" }, 403, req);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400, req); }

  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const fullName = String(body?.full_name ?? "").trim();
  const phone = body?.phone ? String(body.phone).trim() : null;
  const role = String(body?.role ?? "client") as AllowedRole;

  if (!email || !password || !fullName) return json({ error: "Missing required fields" }, 400, req);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400, req);
  if (!ALLOWED_ROLES.includes(role)) return json({ error: "Invalid role" }, 400, req);

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (cErr || !created.user) return json({ error: cErr?.message || "Could not create user" }, 400, req);

  const newUserId = created.user.id;

  await admin.from("profiles").upsert(
    { user_id: newUserId, full_name: fullName, email, phone, status: "actif" },
    { onConflict: "user_id" },
  );

  await admin.from("user_roles").delete().eq("user_id", newUserId);
  const { error: rErr } = await admin.from("user_roles").insert({ user_id: newUserId, role });
  if (rErr) return json({ error: `User created but role failed: ${rErr.message}` }, 500, req);

  return json({
    success: true,
    user: { id: newUserId, email, full_name: fullName, role },
  }, 200, req);
});
