import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    // 1. Archive / soft-delete reservations
    await supabaseAdmin
      .from("reservations")
      .update({ archived_at: new Date().toISOString() })
      .eq("user_id", userId);

    // 2. Archive payments
    await supabaseAdmin
      .from("payments")
      .update({ archived_at: new Date().toISOString() })
      .eq("user_id", userId);

    // 3. Delete profile
    await supabaseAdmin.from("profiles").delete().eq("user_id", userId);

    // 4. Delete user roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);

    // 5. Delete driver row if exists
    await supabaseAdmin.from("drivers").delete().eq("user_id", userId);

    // 6. Delete user circuits assignments
    await supabaseAdmin.from("user_circuits").delete().eq("user_id", userId);

    // 7. Delete auth user (irreversible)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[DELETE ACCOUNT] Auth deletion failed:", error.message);
      throw new Error("La suppression du compte a échoué. Veuillez réessayer.");
    }

    return { success: true };
  });
