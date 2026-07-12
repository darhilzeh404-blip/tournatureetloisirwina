import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Mountain } from "lucide-react";
import { BookingDialog, type BookingTarget } from "@/components/BookingDialog";
import { ClientNav } from "@/components/ClientNav";
import { hdImg } from "@/lib/supabase-image";


export const Route = createFileRoute("/sites-touristiques")({
  head: () => ({
    meta: [
      { title: "Sites touristiques — Agence Wina" },
      { name: "description", content: "Découvrez les sites touristiques du Gabon et réservez votre visite." },
    ],
  }),
  component: SitesTouristiques,
});

type Site = {
  id: string;
  name: string;
  slug: string;
  description: string;
  location: string | null;
  price: number;
  images: string[];
  is_active: boolean;
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

function SitesTouristiques() {
  const [list, setList] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<BookingTarget | null>(null);
  const [selected, setSelected] = useState<Site | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tourist_sites")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")
        .order("name");
      setList((data ?? []) as Site[]);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <Link to="/espace-client" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-accent-foreground">
            <Mountain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Sites touristiques</h1>
            <p className="text-sm text-muted-foreground">Explorez les plus beaux sites du Gabon</p>
          </div>
        </header>

        {loading ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : list.length === 0 ? (
          <div className="mt-10 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Aucun site disponible pour le moment.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <article key={s.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-lg">
                <button type="button" onClick={() => setSelected(s)} className="block w-full text-left">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                    {s.images[0] ? (
                      <img
                        {...hdImg(s.images[0], "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw")}
                        alt={s.name}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (

                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Mountain className="h-8 w-8" />
                      </div>
                    )}
                    {s.images.length > 1 && (
                      <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                        +{s.images.length - 1} photo(s)
                      </span>
                    )}
                  </div>
                </button>
                <div className="p-4 space-y-2">
                  <h2 className="text-base font-bold">{s.name}</h2>
                  {s.location && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {s.location}
                    </p>
                  )}
                  {s.description && <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-extrabold text-primary">{fmt(s.price)}</span>
                    <button
                      type="button"
                      onClick={() => setTarget({ kind: "activity", id: null, name: s.name, basePrice: s.price })}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      Réserver
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{selected.name}</h3>
              <button type="button" onClick={() => setSelected(null)} className="rounded-full p-1 hover:bg-muted">✕</button>
            </div>
            <div className="mt-3 grid gap-2">
              {selected.images.map((url, i) => (
                <div key={i} className="flex w-full items-center justify-center rounded-lg bg-black/5">
                  <img
                    {...hdImg(url, "(max-width: 1024px) 100vw, 1200px")}
                    alt={`${selected.name} ${i + 1}`}
                    className="max-h-[75vh] w-full rounded-lg object-contain"
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </div>
              ))}

            </div>
            {selected.description && <p className="mt-4 text-sm text-muted-foreground">{selected.description}</p>}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-lg font-extrabold text-primary">{fmt(selected.price)}</span>
              <button
                type="button"
                onClick={() => { setTarget({ kind: "activity", id: null, name: selected.name, basePrice: selected.price }); setSelected(null); }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                Réserver
              </button>
            </div>
          </div>
        </div>
      )}

      {target && <BookingDialog target={target} onClose={() => setTarget(null)} />}
      <ClientNav />
    </main>
  );
}
