import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  User,
  Mail,
  Phone,
  LogIn,
  LogOut,
  Trash2,
  Shield,
  Calendar,
  MapPin,
  Bus,
  CarFront,
  Palmtree,
  Ticket,
  AlertTriangle,
  ChevronRight,
  Coins,
  Sparkles,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deleteAccount } from "@/lib/account.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClientNav } from "@/components/ClientNav";
import { fetchBalance, fetchLevels, formatCoins, levelOf, type VipLevel } from "@/lib/wina-coins";

export const Route = createFileRoute("/mon-compte")({
  head: () => ({
    meta: [
      { title: "Mon Profil — Agence Wina" },
      { name: "description", content: "Gérez votre profil et vos préférences." },
    ],
  }),
  component: MonComptePage,
});

interface ProfileData {
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

interface ActivityStats {
  totalReservations: number;
  totalSpent: number;
  servicesUsed: string[];
}

function MonComptePage() {
  const { isAuthenticated, isLoading, user, signOut, role } = useAuth();
  const navigate = useNavigate();
  const doDeleteAccount = useServerFn(deleteAccount);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [coinsBalance, setCoinsBalance] = useState<number>(0);
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const [vipLevels, setVipLevels] = useState<VipLevel[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Only redirect non-client authenticated users
  useEffect(() => {
    if (!isLoading && isAuthenticated && role && role !== "client") {
      navigate({ to: "/" });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  const fetchProfileData = useCallback(async () => {
    if (!user) return;
    setIsLoadingData(true);

    const [{ data: profileData }, { data: reservationsData }] = await Promise.all([
      supabase.from("profiles").select("full_name, phone, email, created_at").eq("user_id", user.id).single(),
      supabase
        .from("reservations")
        .select("total_amount, service_type")
        .eq("user_id", user.id)
        .is("archived_at", null),
    ]);

    if (profileData) {
      setProfile(profileData);
    }

    if (reservationsData) {
      const totalSpent = reservationsData.reduce((sum, r) => sum + (r.total_amount ?? 0), 0);
      const services = [...new Set(reservationsData.map((r) => r.service_type).filter(Boolean))];
      setStats({
        totalReservations: reservationsData.length,
        totalSpent,
        servicesUsed: services as string[],
      });
    }

    setIsLoadingData(false);
  }, [user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchProfileData();
    }
  }, [isAuthenticated, user, fetchProfileData]);

  // Solde Wina Coins + temps réel
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const refresh = async () => {
      const [bal, levels] = await Promise.all([fetchBalance(user.id), fetchLevels()]);
      if (!mounted) return;
      setCoinsBalance(bal?.coins_balance ?? 0);
      setTotalEarned(bal?.total_coins_earned ?? 0);
      setVipLevels(levels);
    };
    void refresh();
    const ch = supabase
      .channel(`coins-balance-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wina_coin_balances", filter: `user_id=eq.${user.id}` },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wina_coins_history", filter: `user_id=eq.${user.id}` },
        () => void refresh()
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Vous êtes déconnecté.");
      navigate({ to: "/connexion" });
    } catch {
      toast.error("Erreur lors de la déconnexion.");
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await doDeleteAccount({});
      toast.success("Votre compte a été supprimé.");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err?.message || "La suppression a échoué.");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const serviceLabel = (type: string) => {
    const map: Record<string, string> = {
      VTC: "VTC",
      TRANSPORT_SCOLAIRE: "Transport scolaire",
      LOCATION_BUS: "Location de bus",
      CIRCUIT_TOURISTIQUE: "Circuit touristique",
      BILLET: "Billet",
      ACTIVITE: "Activité",
    };
    return map[type] || type;
  };

  const serviceIcon = (type: string) => {
    switch (type) {
      case "VTC":
        return CarFront;
      case "TRANSPORT_SCOLAIRE":
      case "LOCATION_BUS":
        return Bus;
      case "CIRCUIT_TOURISTIQUE":
        return MapPin;
      case "BILLET":
        return Ticket;
      case "ACTIVITE":
        return Palmtree;
      default:
        return Bus;
    }
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (!isAuthenticated) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center px-4 py-10">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <LogIn className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Connexion requise</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connectez-vous pour accéder à votre profil.
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
              className="rounded-xl border border-input bg-background px-6 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || "Utilisateur";
  const email = profile?.email || user?.email || "";
  const phone = profile?.phone || "—";
  const createdAt = profile?.created_at || user?.created_at || "";

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      {/* Header */}
      <div className="relative overflow-hidden bg-primary px-5 pb-8 pt-10">
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/5" />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{displayName}</h1>
              <p className="text-sm text-white/80">{email}</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mx-auto max-w-md px-4">
        {/* Mini-solde Wina Coins */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="-mt-4"
        >
          <Link
            to="/wina-coins"
            className="group relative block overflow-hidden rounded-2xl border border-primary/20 p-5 shadow-md transition-all hover:shadow-lg"
            style={{ background: "var(--gradient-vip-card, linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 60%, #1e3a8a 100%))" }}
          >
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
            <div className="absolute -bottom-8 -right-2 h-16 w-16 rounded-full bg-white/5" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                  <Coins className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">
                    Wina Coins <Sparkles className="h-3 w-3" />
                  </p>
                  <p className="text-2xl font-extrabold text-white">
                    {formatCoins(coinsBalance)}
                  </p>
                  {vipLevels.length > 0 && (
                    <p className="text-[11px] font-medium text-white/80">
                      Niveau {levelOf(totalEarned, vipLevels)?.level_name ?? "Silver"}
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-white/90 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </motion.div>

        {/* Informations personnelles */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 rounded-2xl border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Informations
            </h2>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nom complet</p>
                <p className="text-sm font-medium">{displayName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Téléphone</p>
                <p className="text-sm font-medium">{phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Membre depuis</p>
                <p className="text-sm font-medium">
                  {createdAt ? formatDate(createdAt) : "—"}
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Résumé activité */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 rounded-2xl border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Activité
            </h2>
          </div>

          {isLoadingData ? (
            <div className="mt-4 space-y-3">
              <div className="h-10 animate-pulse rounded-lg bg-muted" />
              <div className="h-10 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : stats && stats.totalReservations > 0 ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-primary/5 p-3 text-center">
                  <p className="text-lg font-bold text-primary">{stats.totalReservations}</p>
                  <p className="text-[11px] text-muted-foreground">Réservations</p>
                </div>
                <div className="rounded-xl bg-primary/5 p-3 text-center">
                  <p className="text-lg font-bold text-primary">
                    {stats.totalSpent.toLocaleString("fr-FR")} FCFA
                  </p>
                  <p className="text-[11px] text-muted-foreground">Total dépensé</p>
                </div>
              </div>

              {stats.servicesUsed.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Services utilisés</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {stats.servicesUsed.map((svc) => {
                      const Icon = serviceIcon(svc);
                      return (
                        <span
                          key={svc}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium"
                        >
                          <Icon className="h-3 w-3" />
                          {serviceLabel(svc)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <Link
                to="/mes-reservations"
                className="mt-2 flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                <span>Voir mes réservations</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          ) : (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">Aucune réservation pour le moment.</p>
              <Link
                to="/espace-client"
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
              >
                Découvrir nos services
              </Link>
            </div>
          )}
        </motion.section>

        {/* Actions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 space-y-3"
        >
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <LogOut className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Déconnexion</p>
              <p className="text-[11px] text-muted-foreground">Fermer votre session</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            onClick={() => setShowDeleteDialog(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-destructive/20 bg-card p-4 text-left transition-colors hover:bg-destructive/5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
              <Trash2 className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">Supprimer mon compte</p>
              <p className="text-[11px] text-muted-foreground">Suppression définitive et irréversible</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </motion.section>
      </div>

      {/* Confirmation modal */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-lg">
              Supprimer votre compte ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm leading-relaxed">
              Cette action est <strong>irréversible</strong>. Toutes vos données personnelles,
              réservations et historique seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="w-full rounded-xl bg-destructive py-3 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {isDeleting ? "Suppression en cours…" : "Oui, supprimer mon compte"}
            </AlertDialogAction>
            <AlertDialogCancel className="w-full rounded-xl border py-3 text-sm font-medium">
              Annuler
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClientNav />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-primary px-5 pb-8 pt-10">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 animate-pulse rounded-2xl bg-white/20" />
          <div className="space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-white/30" />
            <div className="h-3 w-56 animate-pulse rounded bg-white/20" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-md px-4">
        <div className="-mt-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                <div className="space-y-1">
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
