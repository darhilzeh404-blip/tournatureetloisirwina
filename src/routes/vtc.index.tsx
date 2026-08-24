import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar, CarFront, Check, CheckCircle2, ChevronDown, Clock, Gem, Heart,
  Loader2, MapPin, Sparkles, Users, Zap, ArrowRight, Star,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { requestNotificationPermission, showAppNotification } from "@/lib/notifications";
import { formatXAF } from "@/lib/vtc-zones";
import kiaK7Bg from "@/assets/kia-k7-vtc.jpg";
import { VtcCourseFlow } from "@/components/vtc/VtcCourseFlow";


export const Route = createFileRoute("/vtc/")({
  head: () => ({
    meta: [
      { title: "VTC & Mariage — Agence Wina" },
      { name: "description", content: "Réservez un VTC Standard, Confort, VIP ou un véhicule de mariage à Libreville, Akanda et Owendo. Tarifs fixes par zone." },
    ],
  }),
  component: VtcPage,
});

const WEDDING_FARES = {
  berline: { h12: 100_000, h24: 200_000, label: "Berline VIP" },
  suv:     { h12: 200_000, h24: 400_000, label: "SUV VIP" },
} as const;
const VTC_SLEEP_UNTIL = new Date(2026, 8, 2, 0, 0, 0);
const VTC_SLEEP_LABEL = "mercredi 2 septembre 2026";

type WeddingVehicle = keyof typeof WEDDING_FARES;
type WeddingDuration = "h12" | "h24";

type MainTab = "standard" | "confort" | "vip" | "mariage" | "covoiturage" | "gammes";

function VtcSleepNotice({
  open,
  onOpenChange,
  onNotify,
  requesting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotify: () => void;
  requesting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Service VTC temporairement indisponible</DialogTitle>
          <DialogDescription>
            Notre service VTC est en pause jusqu'au {VTC_SLEEP_LABEL}. Retrouvez-nous bientôt pour vos courses et mariages.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-3xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900">
          <p>Vous pouvez demander à recevoir une notification lorsque le service reprendra.</p>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <button
            type="button"
            onClick={onNotify}
            disabled={requesting}
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {requesting ? "Activation en cours…" : "Recevoir un rappel"}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center rounded-2xl border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            Fermer
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MAIN_TABS: {
  id: MainTab;
  label: string;
  sub: string;
  icon?: string;
  lucide?: React.ComponentType<{ className?: string }>;
  tint: string;
}[] = [
  { id: "standard",    label: "Standard",    sub: "Citadine",   icon: "/icons/standard-3d.png",         tint: "from-primary/20 to-primary/5" },
  { id: "confort",     label: "Confort",     sub: "Berline",    icon: "/icons/confort-3d.png",          tint: "from-accent/25 to-accent/5" },
  { id: "vip",         label: "VIP",         sub: "Prestige",   icon: "/icons/vip-3d.png",              tint: "from-primary/15 to-accent/10" },
  { id: "mariage",     label: "Mariage",     sub: "Événement",  icon: "/icons/vehicule mariage-3d.png", tint: "from-accent/20 to-primary/10" },
  { id: "covoiturage", label: "Covoiturage", sub: "En groupe",  lucide: Users,                          tint: "from-primary/20 to-accent/5" },
  { id: "gammes",      label: "Nos Gammes",  sub: "Abonnement", icon: "/icons/gammes-3d.png",           tint: "from-accent/15 to-accent/5" },
];

function VtcPage() {
  const [tab, setTab] = useState<MainTab | null>(null);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [requestingNotification, setRequestingNotification] = useState(false);
  const sleepActive = Date.now() < VTC_SLEEP_UNTIL.getTime();

  useEffect(() => {
    if (sleepActive) {
      setShowSleepModal(true);
    }
  }, [sleepActive]);

  const requestVtcResumeNotification = async () => {
    setRequestingNotification(true);
    try {
      const permission = await requestNotificationPermission();
      if (permission === "granted") {
        await showAppNotification("Service VTC en pause", {
          body: `Le service VTC reste indisponible jusqu'au ${VTC_SLEEP_LABEL}. Nous vous informerons dès sa reprise.`,
          tag: "vtc-sleep",
        });
        toast.success("Notifications activées. Vous recevrez un rappel si possible.");
      } else if (permission === "denied") {
        toast.error("Notifications refusées. Activez-les dans votre navigateur pour recevoir un rappel.");
      } else {
        toast("Permission de notifications demandée. Activez-les pour recevoir un rappel.");
      }
    } catch (error) {
      console.error("[VTC sleep] notification", error);
      toast.error("Impossible d'activer les notifications.");
    } finally {
      setRequestingNotification(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 via-background to-background pb-32">
      <VtcSleepNotice
        open={showSleepModal}
        onOpenChange={setShowSleepModal}
        onNotify={requestVtcResumeNotification}
        requesting={requestingNotification}
      />
      {/* Header premium compact, glass, coins inférieurs arrondis */}
      <section className="relative overflow-hidden rounded-b-[28px] px-5 pb-6 pt-7 shadow-lg shadow-primary/20">
        <img
          src={kiaK7Bg}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
          loading="eager"
          decoding="async"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/85 via-primary/70 to-black/70" aria-hidden />
        <div className="pointer-events-none absolute inset-0 opacity-20" aria-hidden>
          <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary-foreground blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-accent/60 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur-md ring-1 ring-primary-foreground/25">
              <CarFront className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/75">Service Premium</p>
              <h1 className="text-xl font-extrabold leading-tight text-primary-foreground">VTC & Mariage</h1>
            </div>
          </div>
          <p className="mt-2 max-w-md text-[12.5px] leading-snug text-primary-foreground/85">
            Choisissez votre gamme, réservez en quelques secondes — Standard, Confort, VIP, Mariage, Covoiturage.
          </p>
        </div>
      </section>

      {/* Onglets arrondis — style dashboard client (cartes 3D tintées) */}
      <div className="relative -mt-4 px-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[13px] font-bold text-foreground">Nos services</h2>
            <span className="text-[10px] font-medium text-muted-foreground">Accès rapide</span>
          </div>
          <div
            role="tablist"
            aria-label="Services VTC"
            className="mt-3 grid grid-cols-3 gap-3"
          >
            {MAIN_TABS.map((t) => {
              const active = tab === t.id;
              const Icon = t.lucide;
              return (
                <motion.button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  whileHover={{ y: -4, scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className={`relative flex h-full flex-col items-center gap-2 overflow-hidden rounded-2xl border p-3 text-center shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    active
                      ? "border-primary/40 bg-gradient-to-br from-primary to-primary/85 shadow-[0_14px_28px_-14px_hsl(var(--primary)/0.65)]"
                      : `border-border/60 bg-gradient-to-br ${t.tint}`
                  }`}
                >
                  <div className={`grid h-12 w-12 place-items-center rounded-2xl ${active ? "bg-primary-foreground/15 ring-1 ring-primary-foreground/25" : ""}`}>
                    {t.icon ? (
                      <img src={t.icon} alt="" className="h-12 w-12 object-contain drop-shadow" />
                    ) : Icon ? (
                      <Icon className={`h-8 w-8 ${active ? "text-primary-foreground" : "text-primary"}`} />
                    ) : null}
                  </div>
                  <div className="text-center">
                    <div className={`text-sm font-bold leading-tight ${active ? "text-primary-foreground" : "text-foreground"}`}>
                      {t.label}
                    </div>
                    <div className={`text-[10px] ${active ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                      {t.sub}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="mx-auto mt-6 max-w-6xl px-4">
        {sleepActive ? (
          <section className="rounded-3xl border border-amber-300/50 bg-amber-100/90 p-6 text-foreground shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-3xl bg-amber-200/80 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300 text-amber-950">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-950">VTC en pause temporaire</p>
                  <p className="mt-1 text-sm text-amber-900/90">
                    Nos services VTC sont temporairement suspendus jusqu&apos;au {VTC_SLEEP_LABEL}. Merci de votre patience.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
                <div className="rounded-3xl border border-border/70 bg-card/80 p-5">
                  <p className="text-sm text-muted-foreground">
                    Vous pouvez revenir plus tard ou réserver un autre service depuis votre espace client.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={requestVtcResumeNotification}
                  disabled={requestingNotification}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {requestingNotification ? "Activation en cours…" : "Recevoir un rappel"}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab ?? "none"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="space-y-2.5"
            >
              {tab === null ? (
                <div className="rounded-3xl border border-dashed border-border/60 bg-card/70 p-8 text-center backdrop-blur-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-3 text-[15px] font-extrabold text-foreground">Choisissez une catégorie</h3>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    Sélectionnez un onglet ci-dessus pour commencer votre réservation.
                  </p>
                </div>
              ) : tab === "mariage" ? (
                <MariageFlow />
              ) : tab === "covoiturage" ? (
                <CovoiturageSection />
              ) : tab === "gammes" ? (
                <PremiumRangesSection onCourse={() => setTab("standard")} />
              ) : (
                <VtcCourseFlow category={tab} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <ClientNav />
      <style>{`.input-base{width:100%;border-radius:.75rem;border:1px solid hsl(var(--border));background:hsl(var(--card));padding:.6rem .75rem;font-size:.875rem;transition:border-color .15s,box-shadow .15s}.input-base:focus{outline:none;border-color:hsl(var(--primary));box-shadow:0 0 0 3px hsl(var(--primary)/.15)}`}</style>
    </div>
  );
}

// ─── Covoiturage (résumé + CTA vers le flow existant) ───────────────────────
function CovoiturageSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-3xl border border-border/60 bg-card/95 p-5 shadow-sm backdrop-blur-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
          <Users className="h-7 w-7 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary ring-1 ring-primary/20">
            <Sparkles className="h-2.5 w-2.5" /> Économique
          </span>
          <h3 className="mt-1.5 text-[16px] font-extrabold leading-tight text-foreground">Covoiturage · Voyager en groupe</h3>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
            Partagez un trajet avec d'autres passagers vers la même destination et divisez le coût de la course.
            Idéal pour les longs trajets et les déplacements réguliers.
          </p>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {[
          { i: Users,    t: "Jusqu'à 4 passagers" },
          { i: MapPin,   t: "Départs & arrivées communs" },
          { i: Zap,      t: "Tarif partagé, plus léger" },
          { i: Calendar, t: "Réservez à l'avance" },
        ].map((f, idx) => {
          const I = f.i;
          return (
            <li key={idx} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-secondary/40 px-3 py-2">
              <I className="h-4 w-4 text-primary" />
              <span className="text-[12.5px] font-semibold text-foreground">{f.t}</span>
            </li>
          );
        })}
      </ul>

      <Link
        to="/deplacement-groupe"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[13.5px] font-bold text-primary-foreground shadow-[0_10px_24px_-12px_hsl(var(--primary)/0.65)] transition-all active:scale-[0.98]"
      >
        <Users className="h-4 w-4" /> Réserver un covoiturage <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.section>
  );
}

// ─── Wizard state (locks selections & enforces order) ───────────────────────
function useWizard(steps: string[]) {
  const [openId, setOpenIdState] = useState<string | null>(steps[0] ?? null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  const indexOf = (id: string) => steps.indexOf(id);
  const isConfirmed = (id: string) => confirmedIds.has(id);
  const canOpen = (id: string) => {
    const i = indexOf(id);
    if (i <= 0) return true;
    return confirmedIds.has(steps[i - 1]);
  };

  const invalidateFrom = (id: string) => {
    const i = indexOf(id);
    if (i < 0) return;
    setConfirmedIds((prev) => {
      const next = new Set(prev);
      steps.slice(i).forEach((s) => next.delete(s));
      return next;
    });
  };

  const setOpenId = (id: string | null) => {
    if (id === null) { setOpenIdState(null); return; }
    if (!canOpen(id)) {
      toast.info("Confirmez l'étape précédente d'abord");
      return;
    }
    // Re-opening a confirmed step invalidates it + downstream to keep coherence
    if (confirmedIds.has(id)) invalidateFrom(id);
    setOpenIdState(id);
  };

  const confirm = (id: string) => {
    setConfirmedIds((prev) => new Set(prev).add(id));
    const i = indexOf(id);
    const next = steps[i + 1] ?? null;
    setOpenIdState(next);
  };

  const allConfirmed = steps.every((s) => confirmedIds.has(s));

  return { openId, setOpenId, isConfirmed, canOpen, confirm, allConfirmed, invalidateFrom };
}

type WizardCtx = ReturnType<typeof useWizard>;

// ─── Accordion premium (une seule carte ouverte, avec confirmation) ─────────
function AccordionCard({
  id, wizard, title, summary, icon, children, canConfirm = true, confirmLabel = "Choisir",
}: {
  id: string;
  wizard: WizardCtx;
  title: string;
  summary?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  canConfirm?: boolean;
  confirmLabel?: string;
}) {
  const open = wizard.openId === id;
  const confirmed = wizard.isConfirmed(id);
  const locked = !wizard.canOpen(id) && !open;

  return (
    <motion.section
      layout
      transition={{ layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
      className={`overflow-hidden rounded-3xl border bg-card/90 backdrop-blur-sm transition-shadow ${
        open ? "border-primary/30 shadow-[0_8px_28px_-12px_hsl(var(--primary)/0.35)]"
             : confirmed ? "border-primary/20 shadow-sm"
             : "border-border/60 shadow-sm"
      } ${locked ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={() => wizard.setOpenId(open ? null : id)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:scale-[0.995] transition-transform"
        aria-expanded={open}
        aria-disabled={locked}
      >
        <motion.div
          animate={{ scale: open ? 1.05 : 1 }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
            open ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                 : confirmed ? "bg-primary/15 text-primary"
                 : "bg-primary/10 text-primary"
          }`}
        >
          {confirmed && !open ? <CheckCircle2 className="h-4 w-4" /> : icon}
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-[14px] font-bold text-foreground">{title}</h2>
            {confirmed && !open && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                <Check className="h-2.5 w-2.5" /> OK
              </span>
            )}
          </div>
          {summary && <p className="truncate text-[12px] text-muted-foreground">{summary}</p>}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              {children}
              <button
                type="button"
                onClick={() => {
                  if (!canConfirm) { toast.error("Complétez cette étape avant de continuer"); return; }
                  wizard.confirm(id);
                }}
                disabled={!canConfirm}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[13.5px] font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> {confirmLabel}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MARIAGE
// ════════════════════════════════════════════════════════════════════════════

function MariageFlow() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const wizard = useWizard(["vehicle", "duration", "info"]);
  const [vehicle, setVehicle] = useState<WeddingVehicle>("berline");
  const [duration, setDuration] = useState<WeddingDuration>("h12");
  const [eventDate, setEventDate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const total = WEDDING_FARES[vehicle][duration];
  const minDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16);

  const submit = async () => {
    if (!isAuthenticated || !user) { toast.error("Connectez-vous pour réserver"); navigate({ to: "/connexion" }); return; }
    if (!eventDate) { toast.error("Choisissez la date de l'événement"); return; }
    if (!/^[0-9+\s]{8,15}$/.test(phone)) { toast.error("Numéro de téléphone invalide"); return; }
    if (name.trim().length < 2) { toast.error("Nom requis"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id, service_type: "VTC" as const,
        reservation_date: eventDate.slice(0, 10),
        total_amount: total, paid_amount: 0,
        details: {
          flow: "vtc_mariage",
          vehicle, vehicle_label: WEDDING_FARES[vehicle].label,
          duration, duration_hours: duration === "h12" ? 12 : 24,
          event_date: eventDate, contact_name: name, contact_phone: phone,
          requires_admin_validation: true,
        },
      }).select("id").single();
      if (error) throw error;
      toast.success("Réservation mariage créée — procédez au paiement total");
      navigate({ to: "/paiement/$reservationId", params: { reservationId: data.id } });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la réservation");
    } finally { setLoading(false); }
  };

  return (
    <>
      <AccordionCard id="vehicle" wizard={wizard}
        title="Véhicule mariage" summary={WEDDING_FARES[vehicle].label}
        icon={
  <img
    src="/icons/vehicule mariage-3d.png"
    alt="Véhicule mariage"
    className="h-5 w-5 object-contain"
  />
}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(WEDDING_FARES) as WeddingVehicle[]).map((v) => {
            const f = WEDDING_FARES[v]; const active = vehicle === v;
            return (
              <button key={v} type="button" onClick={() => setVehicle(v)}
                className={`rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.98] ${active ? "border-primary bg-primary/5 shadow-md shadow-primary/10" : "border-border bg-card hover:border-primary/40"}`}>
                <p className="text-[13px] font-extrabold">{f.label}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <PriceRow label="12h" value={formatXAF(f.h12)} />
                  <PriceRow label="24h" value={formatXAF(f.h24)} />
                </div>
              </button>
            );
          })}
        </div>
      </AccordionCard>

      <AccordionCard id="duration" wizard={wizard}
        title="Durée" summary={duration === "h12" ? "12 heures" : "24 heures"}
        icon={<Clock className="h-4 w-4" />}
      >
        <SegmentedTwo
          value={duration}
          onChange={(v) => setDuration(v as WeddingDuration)}
          options={[
            { v: "h12", l: "12 heures" },
            { v: "h24", l: "24 heures" },
          ]}
        />
      </AccordionCard>

      <AccordionCard id="info" wizard={wizard}
        canConfirm={!!eventDate && name.trim().length >= 2 && /^[0-9+\s]{8,15}$/.test(phone)}
        title="Vos informations" summary={name && phone ? `${name} · ${phone}` : "Date & contact"}
        icon={<Calendar className="h-4 w-4" />}
        confirmLabel="Valider"
      >
        <Field label="Date & heure de l'événement">
          <input type="datetime-local" min={minDate} value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="input-base" />
        </Field>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nom complet">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="input-base" placeholder="Votre nom" />
          </Field>
          <Field label="Téléphone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} className="input-base" placeholder="+241 ..." />
          </Field>
        </div>
      </AccordionCard>

      <motion.div layout className="overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-[0_10px_30px_-15px_hsl(var(--primary)/0.4)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Total mariage</p>
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
              {WEDDING_FARES[vehicle].label} · {duration === "h12" ? "12h" : "24h"} · paiement total
            </p>
          </div>
          <p className="text-2xl font-extrabold text-primary">{formatXAF(total)}</p>
        </div>
      </motion.div>

      <StickyContinue
        loading={loading}
        disabled={!wizard.allConfirmed}
        label={wizard.allConfirmed ? "Continuer · Payer le total" : "Confirmez toutes les étapes"}
        onClick={submit}
        icon={<Heart className="h-4 w-4" />}
      />
    </>
  );
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

function SegmentedTwo<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; l: string; i?: typeof CarFront }[];
}) {
  return (
    <div className="relative grid grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1">
      {options.map((o) => {
        const I = o.i; const active = value === o.v;
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            className="relative z-10 flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors">
            {active && (
              <motion.span layoutId={`seg-${options.map((x) => x.v).join("-")}`}
                className="absolute inset-0 -z-10 rounded-lg bg-card shadow-sm ring-1 ring-border/60"
                transition={{ type: "spring", stiffness: 380, damping: 32 }} />
            )}
            {I && <I className={`h-3.5 w-3.5 ${active ? "text-primary" : "text-muted-foreground"}`} />}
            <span className={active ? "text-primary" : "text-muted-foreground"}>{o.l}</span>
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-[13px] font-medium">{icon} {label}</label>
      {children}
    </div>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border/40 pt-1 first:border-t-0 first:pt-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-extrabold text-primary">{value}</span>
    </div>
  );
}

function StickyContinue({
  loading, disabled, label, onClick, icon, loadingLabel,
}: {
  loading: boolean; disabled: boolean; label: string;
  onClick: () => void; icon: React.ReactNode;
  loadingLabel?: string;
}) {
  return (
    <div
      className="fixed inset-x-0 z-40 px-4 md:hidden"
      style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="mx-auto max-w-md"
      >
        <button
          type="button"
          onClick={onClick}
          disabled={loading || disabled}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[14px] font-bold text-primary-foreground shadow-[0_12px_30px_-10px_hsl(var(--primary)/0.55)] transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
          {loading ? (loadingLabel ?? "Réservation...") : label}
        </button>

      </motion.div>
    </div>
  );
  // Desktop: also render an inline button below (optional)
}

// ─── Nos Gammes VTC (pills tabs premium) ───────────────────────────────────
type RangeKey = "berline" | "vip";

function PremiumRangesSection({ onCourse: _onCourse }: { onCourse: () => void }) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [active, setActive] = useState<RangeKey>("berline");
  const [subscribing, setSubscribing] = useState<RangeKey | null>(null);
  const tabs: { id: RangeKey; label: string; icon: string }[] = [
   { id: "berline", label: "Berline Simple", icon: "/icons/berline-3d.png" },
{ id: "vip", label: "Berline VIP", icon: "/icons/vip-3d.png" },
  ];

  const subscribe = async (plan: "berline_simple" | "berline_vip", amount: number, label: string) => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour souscrire");
      navigate({ to: "/connexion" });
      return;
    }
    setSubscribing(plan === "berline_simple" ? "berline" : "vip");
    try {
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "VTC" as const,
        reservation_date: new Date().toISOString().slice(0, 10),
        total_amount: amount,
        paid_amount: 0,
        details: {
          flow: "vtc_subscription",
          plan,
          plan_label: label,
          duration_label: "1 mois",
          requires_admin_validation: true,
        },
      }).select("id").single();
      if (error) throw error;
      toast.success(`${label} créé — procédez au paiement total`);
      navigate({ to: "/paiement/$reservationId", params: { reservationId: data.id } });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la souscription");
    } finally {
      setSubscribing(null);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="mt-8"
      aria-labelledby="vtc-ranges-title"
    >
      <div className="mb-3 flex items-end justify-between px-1">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-primary">Premium</p>
          <h2 id="vtc-ranges-title" className="text-[17px] font-extrabold text-foreground">
            Nos Gammes VTC
          </h2>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-bold text-accent">
          <Star className="h-3 w-3 fill-current" /> Exclusif
        </span>
      </div>

      {/* Pills tabs — scroll horizontal sur mobile */}
      <div
        role="tablist"
        aria-label="Gammes VTC"
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className="relative shrink-0 snap-start"
            >
              <span
                className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors ${
                  isActive ? "text-primary-foreground" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="vtc-range-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-primary shadow-[0_8px_22px_-10px_hsl(var(--primary)/0.7)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {!isActive && <span className="absolute inset-0 -z-10 rounded-full border border-border/60 bg-card" />}
                <img
  src={t.icon}
  className="h-5 w-5 object-contain"
  alt={t.label}
/>
              </span>
            </button>
          );
        })}
      </div>

      {/* Carte active */}
      <div className="mt-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {active === "berline" && (
              <RangeCard
                badge="Abonnement"
                badgeTone="primary"
                icon="/icons/vehicule mariage-3d.png"
                title="Abonnement Berline Simple"
                price="150.000 XAF"
                priceSuffix="/mois"
                subtitle="Paiement total à la souscription"
                description="Service mensuel avec chauffeur dédié pour vos déplacements quotidiens en berline confortable."
                ctaLabel={subscribing === "berline" ? "Création…" : "Souscrire et payer"}
                ctaDisabled={subscribing !== null}
                onCta={() => subscribe("berline_simple", 150_000, "Abonnement Berline Simple")}
              />
            )}
            {active === "vip" && (
              <RangeCard
                badge="Prestige"
                badgeTone="accent"
                icon="/icons/vip-3d.png"
                title="Abonnement Berline VIP"
                price="250.000 XAF"
                priceSuffix="/mois"
                subtitle="Paiement total à la souscription"
                description="Berlines haut de gamme, chauffeur dédié en costume, expérience premium pour clientèle exigeante."
                ctaLabel={subscribing === "vip" ? "Création…" : "Souscrire et payer"}
                ctaDisabled={subscribing !== null}
                onCta={() => subscribe("berline_vip", 250_000, "Abonnement Berline VIP")}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

function RangeCard({
  badge, badgeTone, icon: Icon, title, price, priceSuffix, subtitle, description, ctaLabel, ctaDisabled, onCta,
}: {
  badge: string;
  badgeTone: "primary" | "accent";
  icon: string;
  title: string;
  price: string;
  priceSuffix?: string;
  subtitle: string;
  description: string;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCta: () => void | Promise<void>;
}) {
  const toneClasses =
    badgeTone === "accent"
      ? "bg-accent/15 text-accent ring-accent/25"
      : "bg-primary/10 text-primary ring-primary/20";
  return (
    <article className="relative overflow-hidden rounded-3xl border border-border/50 bg-card p-5 shadow-md shadow-foreground/5">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-primary/15 to-accent/10 blur-2xl" aria-hidden />
      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
  <img
    src={Icon}
    alt={title}
    className="h-9 w-9 object-contain drop-shadow-lg"
  />
</div>
        <div className="min-w-0 flex-1">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${toneClasses}`}>
            <Sparkles className="h-2.5 w-2.5" /> {badge}
          </span>
          <h3 className="mt-1.5 text-[16px] font-extrabold leading-tight text-foreground">{title}</h3>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="relative mt-4 flex items-end justify-between rounded-2xl bg-secondary/50 p-3.5">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Tarif</p>
          <p className="mt-0.5 text-[16px] font-extrabold leading-tight text-foreground">
            {price}
            {priceSuffix && <span className="text-[12px] font-semibold text-muted-foreground">{priceSuffix}</span>}
          </p>
          <p className="mt-0.5 text-[11.5px] font-medium text-primary">{subtitle}</p>
        </div>
        <MapPin className="h-5 w-5 text-primary/60" />
      </div>

      <button
        type="button"
        onClick={onCta}
        disabled={ctaDisabled}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[13.5px] font-bold text-primary-foreground shadow-[0_10px_24px_-12px_hsl(var(--primary)/0.65)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {ctaLabel} <ArrowRight className="h-4 w-4" />
      </button>
    </article>
  );
}

// (Course de groupe retirée — voir /deplacement-groupe pour le nouveau covoiturage.)

