import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Shield, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { isClientPreview, setClientPreview, subscribeClientPreview } from "@/lib/admin-preview";

/**
 * Floating banner shown when an admin is browsing the app as a client.
 * Only visible outside /admin routes so it doesn't overlap the admin UI.
 */
export function AdminPreviewBanner() {
  const { role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setPreview(isClientPreview());
    return subscribeClientPreview(() => setPreview(isClientPreview()));
  }, []);

  if (role !== "admin") return null;
  if (!preview) return null;
  if (location.pathname.startsWith("/admin")) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 md:bottom-6">
      <button
        onClick={() => {
          setClientPreview(false);
          navigate({ to: "/admin" });
        }}
        className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black shadow-2xl shadow-amber-500/30 hover:bg-amber-400 transition-colors"
      >
        <Shield className="h-4 w-4" />
        <span>Mode aperçu client</span>
        <span className="mx-1 h-4 w-px bg-black/30" />
        <ArrowLeft className="h-4 w-4" />
        <span>Retour admin</span>
      </button>
    </div>
  );
}
