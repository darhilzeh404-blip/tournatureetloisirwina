import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/create-driver")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") || "";
        if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
        const token = authHeader.slice(7);

        let admin;
        try { admin = supabaseAdmin; } catch { return json({ error: "Server not configured" }, 500); }

        const { data: u, error: ue } = await admin.auth.getUser(token);
        if (ue || !u.user) return json({ error: "Invalid session" }, 401);

        const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
        if (!roles?.some((r) => r.role === "admin")) return json({ error: "Forbidden" }, 403);

        let body: any;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

        const full_name = String(body?.full_name ?? "").trim();
        const vehicle_type = String(body?.vehicle_type ?? "Sedan").trim();
        const license_plate = String(body?.license_plate ?? "").trim().toUpperCase();
        const phone = String(body?.phone ?? "").trim();
        const email = String(body?.email ?? "").trim().toLowerCase();
        const password = String(body?.password ?? "");

        if (!full_name || !email || !password || !license_plate) {
          return json({ error: "Champs requis manquants" }, 400);
        }
        if (password.length < 8) return json({ error: "Mot de passe min 8 caractères" }, 400);

        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name },
        });
        if (cErr || !created.user) return json({ error: cErr?.message || "Création échouée" }, 400);

        const uid = created.user.id;

        await admin.from("profiles").upsert(
          { user_id: uid, full_name, email, phone, status: "actif" },
          { onConflict: "user_id" }
        );

        await admin.from("user_roles").delete().eq("user_id", uid);
        await admin.from("user_roles").insert({ user_id: uid, role: "chauffeur" });

        const { error: dErr } = await admin.from("drivers").insert({
          user_id: uid, full_name, vehicle_type, license_plate, phone, email, status: "actif",
        });
        if (dErr) return json({ error: `Driver créé partiellement: ${dErr.message}` }, 500);

        return json({ success: true, user_id: uid, email });
      },
    },
  },
});
