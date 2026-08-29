import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/delete-user")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader =
          request.headers.get("authorization") || request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        const token = authHeader.slice(7);

        let adminClient;
        try {
          adminClient = supabaseAdmin;
        } catch (e: any) {
          console.error("[delete-user] Admin client init failed:", e?.message);
          return jsonResponse({ error: "Server not configured" }, 500);
        }

        const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
        if (userErr || !userData.user) {
          return jsonResponse({ error: "Invalid session" }, 401);
        }
        const callerId = userData.user.id;

        const { data: callerRoles, error: roleErr } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", callerId);
        if (roleErr) return jsonResponse({ error: "Role check failed" }, 500);
        if (!callerRoles?.some((r) => r.role === "admin")) {
          return jsonResponse({ error: "Forbidden — admin only" }, 403);
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }

        const userIds: string[] = Array.isArray(body?.userIds)
          ? body.userIds.filter((v: unknown) => typeof v === "string")
          : [];
        if (userIds.length === 0) return jsonResponse({ error: "userIds requis" }, 400);
        if (userIds.includes(callerId)) {
          return jsonResponse({ error: "Impossible de supprimer votre propre compte" }, 400);
        }

        const failures: string[] = [];
        for (const uid of userIds) {
          try {
            await adminClient.from("user_roles").delete().eq("user_id", uid);
            await adminClient.from("profiles").delete().eq("user_id", uid);
            await adminClient.from("drivers").delete().eq("user_id", uid);
            const { error } = await adminClient.auth.admin.deleteUser(uid);
            if (error) failures.push(uid);
          } catch {
            failures.push(uid);
          }
        }

        return jsonResponse({
          deleted: userIds.length - failures.length,
          failed: failures.length,
        });
      },
    },
  },
});
