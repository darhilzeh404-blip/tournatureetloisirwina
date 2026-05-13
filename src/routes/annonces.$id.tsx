import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Megaphone, AlertTriangle, Tag, Calendar, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/annonces/$id")({
  component: AnnouncementDetail,
});

type Announcement = {
  id: string;
  title: string;
  description: string;
  type: "promo" | "event" | "alert";
  starts_at: string;
  ends_at: string;
  details_url: string | null;
  is_active: boolean;
};

const TYPE_STYLES: Record<Announcement["type"], { bg: string; icon: typeof Tag; label: string }> = {
  promo: { bg: "from-emerald-600 to-emerald-500", icon: Tag, label: "Promo" },
  event: { bg: "from-blue-600 to-indigo-500", icon: Megaphone, label: "Événement" },
  alert: { bg: "from-red-600 to-orange-500", icon: AlertTriangle, label: "Alerte" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AnnouncementDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error) setError(error.message);
      else if (!data) setError("Annonce introuvable.");
      else setItem(data as Announcement);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate({ to: ".." as any });
      window.history.back();
    } else {
      navigate({ to: "/espace-client" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl p-4">
        <button
          type="button"
          onClick={goBack}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm font-semibold hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>

        {loading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : error || !item ? (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">{error ?? "Annonce introuvable."}</p>
            <Link to="/espace-client" className="mt-4 inline-block text-sm font-semibold text-primary underline">
              Retour à l'espace client
            </Link>
          </div>
        ) : (
          (() => {
            const style = TYPE_STYLES[item.type] ?? TYPE_STYLES.event;
            const Icon = style.icon;
            return (
              <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className={`bg-gradient-to-r ${style.bg} p-6 text-white`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide">
                      {style.label}
                    </span>
                  </div>
                  <h1 className="mt-4 text-2xl font-bold leading-tight">{item.title}</h1>
                </div>

                <div className="space-y-4 p-6">
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div>Du {formatDate(item.starts_at)}</div>
                      <div>au {formatDate(item.ends_at)}</div>
                    </div>
                  </div>

                  {item.description && (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                      {item.description}
                    </p>
                  )}

                  {item.details_url && (
                    <a
                      href={item.details_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      Voir le lien externe <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </article>
            );
          })()
        )}
      </div>
    </div>
  );
}
