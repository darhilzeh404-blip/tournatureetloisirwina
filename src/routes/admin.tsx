import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw redirect({ to: "/connexion" });
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", session.user.id).limit(1).single();
    if (roleRow?.role !== "admin") throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Admin — Agence Wina" },
      { name: "description", content: "Tableau de bord administrateur Agence Wina." },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { isAuthenticated, isLoading, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (role && role !== "admin"))) {
      navigate({ to: "/connexion" });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><p>Chargement...</p></div>;
  if (!isAuthenticated || role !== "admin") return null;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />
      <div className="flex-1 overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
