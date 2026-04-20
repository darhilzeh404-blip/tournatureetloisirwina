import { useEffect, useMemo, useState } from "react";
import { Calendar, Users, Loader2, ArrowRight, Bed, UserCheck, Heart, Receipt, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/destinations";

export type BookingTarget = {
  /** Source du circuit / activité */
  kind: "circuit" | "activity";
  /** id de la table circuits / transport_activities. null si destination en dur sans BDD */
  id: string | null;
  /** slug optionnel (pour résoudre côté BDD un circuit seedé) */
  slug?: string;
  name: string;
  /** Prix par personne (par défaut). Sera écrasé si on retrouve le circuit en BDD */
  basePrice: number;
};

type CircuitRow = {
  id: string;
  nom: string;
  base_price: number;
  includes_lodging: boolean;
  includes_guide: boolean;
  lodging_price: number;
  guide_price: number;
};

type CircuitActivity = {
  id: string;
  name: string;
  price: number;
  is_default: boolean;
};

export function BookingDialog({
  target,
  onClose,
}: {
  target: BookingTarget;
  onClose: () => void;
}) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [circuit, setCircuit] = useState<CircuitRow | null>(null);
  const [extras, setExtras] = useState<CircuitActivity[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
  const [persons, setPersons] = useState(1);
  const [date, setDate] = useState("");
  const [allergies, setAllergies] = useState("");
  const [wantsLodging, setWantsLodging] = useState(false);
  const [wantsGuide, setWantsGuide] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(target.kind === "circuit");

  // Charge le circuit BDD (par id ou slug) + ses activités
  useEffect(() => {
    if (target.kind !== "circuit") {
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      let row: CircuitRow | null = null;
      if (target.id) {
        const { data } = await supabase
          .from("circuits")
          .select("id, nom, base_price, includes_lodging, includes_guide, lodging_price, guide_price")
          .eq("id", target.id)
          .maybeSingle();
        row = (data as CircuitRow) ?? null;
      } else if (target.slug) {
        const { data } = await supabase
          .from("circuits")
          .select("id, nom, base_price, includes_lodging, includes_guide, lodging_price, guide_price")
          .eq("slug", target.slug)
          .maybeSingle();
        row = (data as CircuitRow) ?? null;
      }
      if (!mounted) return;
      setCircuit(row);
      if (row) {
        setWantsLodging(row.includes_lodging);
        setWantsGuide(row.includes_guide);
        const { data: acts } = await supabase
          .from("circuit_activities")
          .select("id, name, price, is_default")
          .eq("circuit_id", row.id)
          .order("sort_order");
        if (!mounted) return;
        const list = (acts as CircuitActivity[]) ?? [];
        setExtras(list);
        setSelectedExtras(new Set(list.filter((a) => a.is_default).map((a) => a.id)));
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [target.id, target.slug, target.kind]);

  const effectiveBasePrice = circuit?.base_price ?? target.basePrice;

  const breakdown = useMemo(() => {
    const lines: { label: string; amount: number }[] = [];
    const baseTotal = effectiveBasePrice * persons;
    lines.push({
      label: `${target.name} × ${persons} personne${persons > 1 ? "s" : ""}`,
      amount: baseTotal,
    });
    if (circuit && wantsLodging) {
      lines.push({ label: `Hébergement × ${persons}`, amount: circuit.lodging_price * persons });
    }
    if (circuit && wantsGuide) {
      lines.push({ label: "Guide accompagnateur", amount: circuit.guide_price });
    }
    extras.forEach((a) => {
      if (selectedExtras.has(a.id) && a.price > 0) {
        lines.push({ label: `${a.name} × ${persons}`, amount: a.price * persons });
      }
    });
    const total = lines.reduce((s, l) => s + l.amount, 0);
    return { lines, total };
  }, [effectiveBasePrice, persons, circuit, wantsLodging, wantsGuide, extras, selectedExtras, target.name]);

  const toggleExtra = (id: string) => {
    setSelectedExtras((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const submit = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver");
      navigate({ to: "/connexion" });
      return;
    }
    if (!date) {
      toast.error("Choisissez une date");
      return;
    }
    if (breakdown.total <= 0) {
      toast.error("Prix non défini, contactez l'administrateur");
      return;
    }
    setSubmitting(true);
    try {
      const selectedExtrasDetail = extras
        .filter((a) => selectedExtras.has(a.id))
        .map((a) => ({ id: a.id, name: a.name, price: a.price }));

      const details: Record<string, unknown> = {
        kind: target.kind,
        name: target.name,
        persons,
        allergies: allergies.trim() || null,
        wants_lodging: wantsLodging,
        wants_guide: wantsGuide,
        extras: selectedExtrasDetail,
        breakdown: breakdown.lines,
      };
      if (circuit) {
        details.circuit_id = circuit.id;
        details.circuit = circuit.nom;
      } else if (target.kind === "circuit") {
        details.circuit = target.name;
      } else {
        details.activity_id = target.id;
        details.activity = target.name;
      }

      const { error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "CIRCUIT_TOURISTIQUE" as const,
        reservation_date: date,
        total_amount: breakdown.total,
        paid_amount: 0,
        details,
      });
      if (error) throw error;
      toast.success("Réservation créée 🎉");
      onClose();
      navigate({ to: "/mes-reservations" });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réservation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold leading-tight">{target.name}</h3>
            <p className="text-xs text-muted-foreground">
              {target.kind === "circuit" ? "Circuit touristique" : "Activité"} · à partir de{" "}
              <span className="font-semibold text-primary">{formatFCFA(effectiveBasePrice)}</span> /pers
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-muted p-1.5 hover:bg-muted/70"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> Date
                </label>
                <input
                  type="date"
                  value={date}
                  min={new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                  <Users className="h-3.5 w-3.5 text-primary" /> Personnes
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPersons(Math.max(1, persons - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-base font-bold"
                  >
                    −
                  </button>
                  <span className="min-w-[2rem] text-center text-base font-bold">{persons}</span>
                  <button
                    type="button"
                    onClick={() => setPersons(persons + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-base font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {circuit && (extras.length > 0 || circuit.lodging_price > 0 || circuit.guide_price > 0) && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Options</p>

                {circuit.lodging_price > 0 && (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={wantsLodging}
                      onChange={(e) => setWantsLodging(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Bed className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Hébergement</p>
                      <p className="text-[11px] text-muted-foreground">{formatFCFA(circuit.lodging_price)} / pers</p>
                    </div>
                  </label>
                )}

                {circuit.guide_price > 0 && (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={wantsGuide}
                      onChange={(e) => setWantsGuide(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <UserCheck className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Guide accompagnateur</p>
                      <p className="text-[11px] text-muted-foreground">{formatFCFA(circuit.guide_price)} forfait</p>
                    </div>
                  </label>
                )}

                {extras.map((a) => {
                  const checked = selectedExtras.has(a.id);
                  return (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExtra(a.id)}
                        className="h-4 w-4"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {a.price > 0 ? `+ ${formatFCFA(a.price)} / pers` : "Inclus"}
                          {a.is_default && " · recommandé"}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                <Heart className="h-3.5 w-3.5 text-primary" /> Allergies / restrictions alimentaires
              </label>
              <textarea
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                rows={2}
                placeholder="Ex : arachides, fruits de mer, végétarien…"
                className="w-full rounded-xl border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Receipt className="h-4 w-4" />
                <p className="text-xs font-bold uppercase tracking-wide">Récapitulatif</p>
              </div>
              <ul className="space-y-1 text-xs">
                {breakdown.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{l.label}</span>
                    <span className="font-semibold">{formatFCFA(l.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span className="text-xs font-medium">Total</span>
                <span className="text-xl font-extrabold text-primary">{formatFCFA(breakdown.total)}</span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Acompte de 50% requis à la réservation. 48h minimum d'avance.
              </p>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {submitting ? "Réservation…" : "Confirmer la réservation"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
