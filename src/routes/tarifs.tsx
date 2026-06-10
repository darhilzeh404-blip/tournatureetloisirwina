import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Bus, GraduationCap, Sparkles, MapPin, Crown, Check, LogIn, Loader2 } from "lucide-react";
import { useAuth, getRoleRedirectPath } from "@/hooks/use-auth";
import { ClientNav } from "@/components/ClientNav";
import { usePricingCatalog, type SchoolTripTariff, type GroupBusTrip } from "@/hooks/use-pricing-catalog";

export const Route = createFileRoute("/tarifs")({
  head: () => ({
    meta: [
      { title: "Tarifs & services — Agence Wina" },
      { name: "description", content: "Découvrez nos tarifs : transport scolaire, extra-scolaire, location de bus pour mariages et excursions au Gabon." },
      { property: "og:title", content: "Tarifs & services — Agence Wina" },
      { property: "og:description", content: "Tarifs transport scolaire, extra-scolaire et location de bus." },
    ],
  }),
  component: TarifsPage,
});

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}


const GROUP_BUS_PRICING = [
  {
    title: "Parc d’Akanda",
    gathering: "Parking SANgel",
    destinations: ["Cap Santa-Clara", "Cap Estérias", "Cap des Pères", "Cap Caravane", "Boulokoboué", "Malibé 1", "Malibé 2", "Ndossi village", "Akouago-village"],
    rows: [["Aller", 20_000], ["Retour", 20_000]] as [string, number][],
  },
  {
    title: "Ntoum-Meyan & Donguila",
    gathering: "ABC Mall des Charbonnages",
    destinations: ["LBV - Donguila", "LBV - Meyang"],
    rows: [["Bus 16 places / journée", 100_000], ["Bus 32 places / journée", 200_000]] as [string, number][],
  },
  {
    title: "LBV - Cocobeach",
    gathering: "ABC Mall des Charbonnages",
    destinations: ["LBV - Cocobeach"],
    rows: [["Bus 16 places / journée", 192_000], ["Bus 32 places / journée", 384_000]] as [string, number][],
  },
];

function TarifsPage() {
  const { isAuthenticated, isLoading, role } = useAuth();
  const navigate = useNavigate();
  const catalog = usePricingCatalog();

  // Group school trip tariffs by route_label
  const schoolByRoute = useMemo(() => {
    const map = new Map<string, { sort_order: number; rows: SchoolTripTariff[] }>();
    catalog.schoolTrips.forEach((t) => {
      const entry = map.get(t.route_label) ?? { sort_order: t.sort_order, rows: [] };
      entry.rows.push(t);
      map.set(t.route_label, entry);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].sort_order - b[1].sort_order)
      .map(([label, v]) => ({ label, rows: v.rows }));
  }, [catalog.schoolTrips]);


  // Redirection des non-clients (chauffeur/admin/gerant) vers leur espace
  useEffect(() => {
    if (!isLoading && isAuthenticated && role && role !== "client") {
      navigate({ to: getRoleRedirectPath(role) });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  if (isLoading) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-56 rounded bg-muted" />
          <div className="h-4 w-72 rounded bg-muted" />
          <div className="h-40 w-full rounded-2xl bg-muted" />
        </div>
      </section>
    );
  }

  // Non connecté → invitation à se connecter
  if (!isAuthenticated) {
    return (
      <section className="flex min-h-[70vh] items-center justify-center px-4 py-10">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <LogIn className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Connexion requise</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Connectez-vous en tant que client pour consulter nos tarifs détaillés.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              to="/connexion"
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Se connecter
            </Link>
            <Link
              to="/inscription"
              className="rounded-xl border border-input bg-background px-6 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Si role !== client, on a déjà déclenché le redirect → ne rien afficher
  if (role !== "client") return null;

  return (
    <div className="pb-24">
      {/* Header */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 px-5 pb-8 pt-10">
        <motion.div initial="hidden" animate="show" variants={stagger} className="mx-auto max-w-3xl">
          <motion.p variants={fadeUp} className="text-xs font-semibold uppercase tracking-wider text-primary">
            Espace client
          </motion.p>
          <motion.h1 variants={fadeUp} className="mt-1 text-3xl font-bold leading-tight">
            Tarifs & services
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-2 text-sm text-muted-foreground">
            Tous nos services et tarifs en toute transparence.
          </motion.p>
        </motion.div>
      </section>

      <div className="mx-auto max-w-3xl space-y-10 px-5 pt-8">
        {/* TRANSPORT SCOLAIRE */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Transport scolaire</h2>
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-2xl border bg-card p-5">
            <p className="text-sm font-semibold">À préciser lors de la réservation :</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {[
                "Type d'abonnement : aller-retour ou simple",
                "Âge et niveau d'étude des élèves",
                "Nombre d'enfants",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Akanda-LBV */}
          <motion.div variants={fadeUp} className="mt-5">
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
              <MapPin className="h-4 w-4 text-primary" /> Trajet Akanda — Libreville
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <PricingBlock
                variant="standard"
                title="Standard"
                rows={[
                  ["Aller-retour", 80000],
                  ["Simple", 50000],
                ]}
              />
              <PricingBlock
                variant="vip"
                title="VIP"
                rows={[
                  ["Aller-retour", 150000],
                  ["Simple", 80000],
                ]}
              />
            </div>
          </motion.div>

          {/* Owendo-LBV */}
          <motion.div variants={fadeUp} className="mt-5">
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
              <MapPin className="h-4 w-4 text-primary" /> Trajet Owendo — Libreville
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <PricingBlock
                variant="standard"
                title="Standard"
                rows={[
                  ["Aller-retour", 80000],
                  ["Simple", 50000],
                ]}
              />
              <PricingBlock
                variant="vip"
                title="VIP"
                rows={[
                  ["Aller-retour", 150000],
                  ["Simple", 80000],
                ]}
              />
            </div>
          </motion.div>
        </motion.section>

        {/* TRANSPORT EXTRA SCOLAIRE */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
              <Sparkles className="h-5 w-5 text-accent-foreground" />
            </div>
            <h2 className="text-xl font-bold">Transport extra-scolaire & activités</h2>
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-2xl border bg-card p-5">
            <ul className="space-y-2.5 text-sm">
              {[
                { emoji: "🌱", label: "Atelier de jardinage (fruits et légumes)" },
                { emoji: "👨‍🍳", label: "Atelier d'art culinaire" },
                { emoji: "🥗", label: "Apprentissage de la nutrition quotidienne et saine" },
                { emoji: "🌿", label: "Atelier Nature et culture" },
                { emoji: "🏊", label: "Natation et danse" },
              ].map((act) => (
                <li key={act.label} className="flex items-start gap-3">
                  <span className="text-lg">{act.emoji}</span>
                  <span className="pt-0.5">{act.label}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.section>

        {/* TRANSPORT DE GROUPE */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Bus className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Transport de groupe</h2>
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <p className="text-sm font-semibold text-primary">Ces tarifs concernent uniquement les déplacements en groupe.</p>
            <p className="mt-1 text-xs text-muted-foreground">Les lieux de rassemblement sont indiqués pour faciliter l’organisation du départ.</p>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-4 grid gap-4">
            {GROUP_BUS_PRICING.map((group) => (
              <div key={group.title} className="rounded-2xl border bg-card p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">{group.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Rassemblement : {group.gathering}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.destinations.map((destination) => (
                    <span key={destination} className="rounded-full border bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                      {destination}
                    </span>
                  ))}
                </div>
                <div className="mt-4 rounded-xl bg-secondary/50 p-3">
                  {group.rows.map(([label, price]) => (
                    <div key={label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-border py-2 first:pt-0 last:border-0 last:pb-0">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-extrabold text-primary">{formatXAF(price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.section>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground"
        >
          <h3 className="text-lg font-bold">Prêt à réserver ?</h3>
          <p className="mt-1 text-sm opacity-90">
            Choisissez votre service et obtenez une réservation en quelques clics.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/reserver-transport"
              className="rounded-xl bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-background/90"
            >
              Réserver un trajet
            </Link>
            <Link
              to="/activites"
              className="rounded-xl border border-primary-foreground/30 bg-transparent px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10"
            >
              Voir les activités
            </Link>
          </div>
        </motion.div>
      </div>

      <ClientNav />
    </div>
  );
}

function PricingBlock({
  variant,
  title,
  rows,
}: {
  variant: "standard" | "vip";
  title: string;
  rows: [string, number][];
}) {
  const isVip = variant === "vip";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 ${
        isVip
          ? "border-primary/40 bg-gradient-to-br from-primary/10 to-accent/10"
          : "bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold">{title}</h4>
        {isVip && (
          <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Crown className="h-3 w-3" /> VIP
          </span>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {rows.map(([label, price]) => (
          <li key={label} className="flex items-baseline justify-between gap-2 border-b border-dashed border-border/60 pb-2 last:border-0 last:pb-0">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={`text-sm font-bold ${isVip ? "text-primary" : ""}`}>
              {formatXAF(price)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
