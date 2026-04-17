import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ALLOWED_ROLES = ["admin", "gerant", "chauffeur", "client"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/create-user")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

        if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
          return jsonResponse({ error: "Server not configured" }, 500);
        }

        // 1. Verify caller is authenticated
        const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const token = authHeader.slice(7);

        const userClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const { data: userData, error: userErr } = await userClient.auth.getUser(token);
        if (userErr || !userData.user) {
          return jsonResponse({ error: "Invalid session" }, 401);
        }

        const callerId = userData.user.id;

        // 2. Verify caller is admin (via service role to bypass RLS reliably)
        const adminClient = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: callerRoles, error: roleErr } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", callerId);

        if (roleErr) {
          return jsonResponse({ error: "Role check failed" }, 500);
        }

        const isAdmin = callerRoles?.some((r) => r.role === "admin");
        if (!isAdmin) {
          return jsonResponse({ error: "Forbidden — admin only" }, 403);
        }

        // 3. Parse + validate body
        let body: any;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }

        const email = String(body?.email ?? "").trim().toLowerCase();
        const password = String(body?.password ?? "");
        const fullName = String(body?.full_name ?? "").trim();
        const phone = body?.phone ? String(body.phone).trim() : null;
        const role = String(body?.role ?? "client") as AllowedRole;

        if (!email || !password || !fullName) {
          return jsonResponse({ error: "Missing required fields" }, 400);
        }
        if (password.length < 8) {
          return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
        }
        if (!ALLOWED_ROLES.includes(role)) {
          return jsonResponse({ error: "Invalid role" }, 400);
        }

        // 4. Create the user via admin API (does NOT affect caller's session)
        const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });

        if (createErr || !created.user) {
          return jsonResponse({ error: createErr?.message || "Could not create user" }, 400);
        }

        const newUserId = created.user.id;

        // 5. Ensure profile exists (handle_new_user trigger should create it, but we upsert defensively)
        const { error: profileErr } = await adminClient
          .from("profiles")
          .upsert(
            {
              user_id: newUserId,
              full_name: fullName,
              email,
              phone,
              status: "actif",
            },
            { onConflict: "user_id" }
          );

        if (profileErr) {
          console.error("[create-user] Profile upsert failed:", profileErr);
        }

        // 6. Set the requested role (replace default 'client' from trigger)
        await adminClient.from("user_roles").delete().eq("user_id", newUserId);
        const { error: roleInsertErr } = await adminClient
          .from("user_roles")
          .insert({ user_id: newUserId, role });

        if (roleInsertErr) {
          return jsonResponse(
            { error: `User created but role assignment failed: ${roleInsertErr.message}` },
            500
          );
        }

        console.log(`[create-user] Admin ${callerId} created user ${newUserId} with role ${role}`);

        return jsonResponse({
          success: true,
          user: { id: newUserId, email, full_name: fullName, role },
        });
      },
    },
  },
});
