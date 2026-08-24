import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Eye, Search, UserPlus, Loader2, X, MapPin, Receipt, ShieldCheck, Archive, ArchiveRestore } from "lucide-react";
import { VirtualTableBody } from "@/components/ui/virtual-list";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { canAssignTrip, requiresDriver, requiresGerant } from "@/lib/service-routing";

export const Route = createFileRoute("/admin/reservations")({
  component: AdminReservations,
});

type Status = "PENDING_PAYMENT" | "CONFIRMED" | "REJECTED" | "CANCELLED";

interface Reservation {
  id: string;
  user_id: string;
  service_type: string;
  status: Status;
  reservation_date: string;
  total_amount: number;
  paid_amount: number;
  paiement_valide: boolean;
  details: Record<string, unknown>;
  created_at: string;
  archived_at: string | null;
  admin_comment: string | null;
  reference_code: string | null;
  agent_code: string | null;
}

interface PaymentRow {
  id: string;
  reservation_id: string;
  status: "PENDING" | "VALIDATED" | "REJECTED";
  amount: number;
  receipt_url: string | null;
  transaction_ref: string | null;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

interface RoleRow {
  user_id: string;
  role: string;
}

interface Trip {
  id: string;
  reservation_id: string;
  client_id: string;
  driver_id: string | null;
  gerant_id: string | null;
  status: string;
}

const STATUS_MAP: Record<Status, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING_PAYMENT: { label: "En attente", variant: "outline" },
  CONFIRMED: { label: "Confirmée", variant: "default" },
  REJECTED: { label: "Refusée", variant: "destructive" },
  CANCELLED: { label: "Annulée", variant: "secondary" },
};

const SERVICE_LABELS: Record<string, string> = {
  TRANSPORT_SCOLAIRE: "Transport Scolaire",
  LOCATION_BUS: "Location Bus",
  CIRCUIT_TOURISTIQUE: "Circuit",
  VTC: "VTC / Transfert",
  BILLET: "Billet",
  ACTIVITE: "Activité",
  DEMENAGEMENT: "Déménagement",
};

function formatXAF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " XAF";
}

function AdminReservations() {
  const { isAuthenticated, isLoading, role, user } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [trips, setTrips] = useState<Map<string, Trip>>(new Map());
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [gerants, setGerants] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [assignTarget, setAssignTarget] = useState<Reservation | null>(null);
  const [payments, setPayments] = useState<Map<string, PaymentRow>>(new Map());
  const [allPayments, setAllPayments] = useState<Map<string, PaymentRow[]>>(new Map());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Reservation | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || role !== "admin")) {
      navigate({ to: "/connexion" });
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // Reservations
      const { data: resData } = await supabase
        .from("reservations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      const reservs = (resData as Reservation[]) ?? [];
      setReservations(reservs);

      // Profiles for client names
      const userIds = Array.from(new Set(reservs.map((r) => r.user_id)));
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone")
          .in("user_id", userIds);
        const map = new Map<string, Profile>();
        (profs ?? []).forEach((p) => map.set(p.user_id, p as Profile));
        setProfiles(map);
      }

      // Existing trips + latest payment per reservation
      const resIds = reservs.map((r) => r.id);
      if (resIds.length > 0) {
        const [{ data: tripsData }, { data: paymentsData }] = await Promise.all([
          supabase
            .from("trips")
            .select("id, reservation_id, client_id, driver_id, gerant_id, status")
            .in("reservation_id", resIds),
          supabase
            .from("payments")
            .select("id, reservation_id, status, amount, receipt_url, transaction_ref, created_at")
            .in("reservation_id", resIds)
            .order("created_at", { ascending: false }),
        ]);
        const tmap = new Map<string, Trip>();
        (tripsData as Trip[] | null)?.forEach((t) => tmap.set(t.reservation_id, t));
        setTrips(tmap);

        // garde le paiement le plus récent par réservation + tous les paiements
        const pmap = new Map<string, PaymentRow>();
        const pAll = new Map<string, PaymentRow[]>();
        (paymentsData as PaymentRow[] | null)?.forEach((p) => {
          if (!pmap.has(p.reservation_id)) pmap.set(p.reservation_id, p);
          const arr = pAll.get(p.reservation_id) ?? [];
          arr.push(p);
          pAll.set(p.reservation_id, arr);
        });
        setPayments(pmap);
        setAllPayments(pAll);
      }

      // Drivers + gerants lists
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["chauffeur", "gerant"]);
      const driverIds = (roleRows as RoleRow[] | null)?.filter((r) => r.role === "chauffeur").map((r) => r.user_id) ?? [];
      const gerantIds = (roleRows as RoleRow[] | null)?.filter((r) => r.role === "gerant").map((r) => r.user_id) ?? [];
      const allIds = [...driverIds, ...gerantIds];
      if (allIds.length > 0) {
        const { data: staffProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone")
          .in("user_id", allIds);
        const sp = (staffProfiles as Profile[] | null) ?? [];
        setDrivers(sp.filter((p) => driverIds.includes(p.user_id)));
        setGerants(sp.filter((p) => gerantIds.includes(p.user_id)));
      }
    } catch (err) {
      console.error("[ADMIN/RES] load error:", err);
      toast.error("Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && role === "admin") loadAll();
  }, [user, role, loadAll]);

  // Realtime: reservations + trips + payments (notif sur new upload)
  useEffect(() => {
    if (!user || role !== "admin") return;
    // Anti-rebond : une validation de paiement émet plusieurs événements
    // (payment + reservation + trip). Sans regroupement, `loadAll()` (qui
    // recharge des centaines de lignes) était relancé 3-4 fois de suite et
    // gelait l'écran admin sur mobile.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void loadAll(), 600);
    };
    const channel = supabase
      .channel("admin-reservations-trips-payments")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, scheduleReload)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "payments" }, (payload) => {
        const p = payload.new as { receipt_url?: string | null };
        if (p?.receipt_url) toast.info("📸 Nouvelle preuve de paiement reçue");
        scheduleReload();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "payments" }, scheduleReload)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user, role, loadAll]);


  const filtered = reservations.filter((r) => {
    const p = profiles.get(r.user_id);
    const clientName = p?.full_name ?? "";
    const q = search.toLowerCase();
    const matchSearch =
      clientName.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.reference_code ?? "").toLowerCase().includes(q) ||
      (r.agent_code ?? "").toLowerCase().includes(q);
    const isArchived = !!r.archived_at;
    if (tab === "archived") return matchSearch && isArchived;
    if (isArchived) return false;
    if (tab === "all") return matchSearch;
    return matchSearch && r.status === tab;
  });

  const archiveReservation = async (r: Reservation, restore = false) => {
    setArchivingId(r.id);
    try {
      const { error } = await supabase
        .from("reservations")
        .update({ archived_at: restore ? null : new Date().toISOString() })
        .eq("id", r.id);
      if (error) throw error;
      // Archive aussi paiements + trips liés
      await Promise.all([
        supabase.from("payments").update({ archived_at: restore ? null : new Date().toISOString() }).eq("reservation_id", r.id),
        supabase.from("trips").update({ archived_at: restore ? null : new Date().toISOString() }).eq("reservation_id", r.id),
      ]);
      toast.success(restore ? "Réservation restaurée." : "Réservation archivée.");
      loadAll();
    } catch (err) {
      console.error("[ARCHIVE]", err);
      toast.error("Erreur lors de l'archivage.");
    } finally {
      setArchivingId(null);
    }
  };

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
    if (error) {
      toast.error("Erreur lors de la mise à jour.");
      console.error(error);
    } else {
      toast.success(status === "CONFIRMED" ? "Réservation confirmée." : "Réservation refusée.");
    }
  };

  const viewProof = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("payment-receipts")
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Impossible de charger la preuve.");
      return;
    }
    setPreviewUrl(data.signedUrl);
  };

  const autoAssignCircuitGerant = async (reservation: Reservation) => {
    if (reservation.service_type !== "CIRCUIT_TOURISTIQUE") return;
    const d = (reservation.details ?? {}) as Record<string, unknown>;
    const circuitId = typeof d.circuit_id === "string" ? (d.circuit_id as string) : null;
    const circuitName = typeof d.circuit === "string" ? (d.circuit as string) : null;

    // Trouver le(s) gérant(s) assigné(s) à ce circuit
    let gerantUserId: string | null = null;
    if (circuitId) {
      const { data } = await supabase
        .from("user_circuits")
        .select("user_id")
        .eq("circuit_id", circuitId)
        .limit(1)
        .maybeSingle();
      if (data?.user_id) gerantUserId = data.user_id;
    }
    if (!gerantUserId && circuitName) {
      const { data: c } = await supabase
        .from("circuits")
        .select("id")
        .ilike("nom", `%${circuitName}%`)
        .limit(1)
        .maybeSingle();
      if (c?.id) {
        const { data: uc } = await supabase
          .from("user_circuits")
          .select("user_id")
          .eq("circuit_id", c.id)
          .limit(1)
          .maybeSingle();
        if (uc?.user_id) gerantUserId = uc.user_id;
      }
    }
    if (!gerantUserId) {
      return;
    }

    const origin = (typeof d.pickup === "string" ? d.pickup : "") || (typeof d.route === "string" ? d.route : "");
    const destination = (typeof d.destination === "string" ? d.destination : "") || circuitName || "";

    const existing = trips.get(reservation.id);
    if (existing) {
      await supabase
        .from("trips")
        .update({ gerant_id: gerantUserId, status: "assigned" })
        .eq("id", existing.id);
    } else {
      await supabase.from("trips").insert({
        reservation_id: reservation.id,
        client_id: reservation.user_id,
        gerant_id: gerantUserId,
        status: "assigned",
        origin_address: origin,
        destination_address: destination,
      });
    }
    toast.success("Circuit transféré automatiquement au gérant assigné.");
  };

  const validatePayment = async (reservation: Reservation) => {
    const payment = payments.get(reservation.id);
    if (!payment) {
      toast.error("Aucun paiement à valider.");
      return;
    }
    setValidatingId(reservation.id);
    try {
      const { error: payErr } = await supabase
        .from("payments")
        .update({ status: "VALIDATED" })
        .eq("id", payment.id);
      if (payErr) throw payErr;

      const newPaid = (reservation.paid_amount ?? 0) + (payment.amount ?? 0);
      const { error: resErr } = await supabase
        .from("reservations")
        .update({
          paiement_valide: true,
          status: "CONFIRMED",
          paid_amount: newPaid,
        })
        .eq("id", reservation.id);
      if (resErr) throw resErr;

      // Auto-transfert au gérant pour les circuits
      await autoAssignCircuitGerant(reservation);

      toast.success("Paiement validé. Vous pouvez maintenant assigner.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de validation.";
      toast.error(msg);
      console.error("[VALIDATE PAYMENT]", err);
    } finally {
      setValidatingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthenticated || role !== "admin") return null;

  const detailsLabel = (r: Reservation) => {
    const d = (r.details ?? {}) as Record<string, unknown>;
    const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined);
    const num = (k: string) => (typeof d[k] === "number" ? (d[k] as number) : undefined);
    const parts: string[] = [];

    // Extra-scolaire (formule = "Extra-scolaire" + activites[])
    if (str("formule") === "Extra-scolaire") {
      parts.push("Extra-scolaire");
      const acts = Array.isArray(d.activites) ? (d.activites as string[]) : [];
      if (acts.length) parts.push(`Activités: ${acts.join(", ")}`);
      const nb = num("nb_enfants");
      if (nb) parts.push(`${nb} enfant${nb > 1 ? "s" : ""}`);
      return parts.join(" — ");
    }

    // Transport scolaire (itineraire / niveau / nb_enfants / formule / standing)
    const itineraire = str("itineraire");
    const niveau = str("niveau");
    const formule = str("formule");
    const standing = str("standing");
    const nbEnfants = num("nb_enfants");
    if (itineraire || niveau || formule) {
      if (itineraire) parts.push(itineraire);
      if (niveau) parts.push(`Niveau: ${niveau}`);
      if (nbEnfants) parts.push(`${nbEnfants} enfant${nbEnfants > 1 ? "s" : ""}`);
      if (formule) parts.push(formule);
      if (standing) parts.push(standing);
      return parts.join(" — ");
    }

    // Bus (vehicule / capacite / standing / usage / jours)
    const vehicule = str("vehicule") ?? str("vehicle");
    if (vehicule) {
      parts.push(vehicule);
      const cap = num("capacite");
      if (cap) parts.push(`${cap} places`);
      const usage = str("usage");
      if (usage) parts.push(usage);
      if (standing) parts.push(standing);
      const jours = num("jours");
      if (jours) parts.push(`${jours} jour${jours > 1 ? "s" : ""}`);
      return parts.join(" — ");
    }

    // Circuits / legacy fallback
    const route = str("route");
    const circuit = str("circuit");
    if (route) parts.push(route);
    if (circuit) parts.push(circuit);
    return parts.join(" — ") || "—";
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Réservations</h1>
        <p className="text-sm text-muted-foreground">Gérez et assignez chauffeurs / gérants en temps réel.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par ID, code réf, code agent ou client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">Toutes ({reservations.filter(r => !r.archived_at).length})</TabsTrigger>
          <TabsTrigger value="PENDING_PAYMENT">En attente ({reservations.filter((r) => !r.archived_at && r.status === "PENDING_PAYMENT").length})</TabsTrigger>
          <TabsTrigger value="CONFIRMED">Confirmées ({reservations.filter((r) => !r.archived_at && r.status === "CONFIRMED").length})</TabsTrigger>
          <TabsTrigger value="REJECTED">Refusées ({reservations.filter((r) => !r.archived_at && r.status === "REJECTED").length})</TabsTrigger>
          <TabsTrigger value="archived">Archivées ({reservations.filter(r => !!r.archived_at).length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              {loading ? (
                <div className="p-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                      <th className="p-4">ID</th>
                      <th className="p-4">Codes</th>
                      <th className="p-4">Client</th>
                      <th className="p-4">Type</th>
                      <th className="p-4 hidden md:table-cell">Détails</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Statut</th>
                      <th className="p-4">Preuve</th>
                      <th className="p-4">Assignation</th>
                      <th className="p-4">Actions</th>
                    </tr>
                  </thead>
                  {filtered.length === 0 ? (
                    <tbody>
                      <tr>
                        <td colSpan={12} className="p-8 text-center text-muted-foreground">Aucune réservation trouvée.</td>
                      </tr>
                    </tbody>
                  ) : (
                  <VirtualTableBody
                    items={filtered}
                    colSpan={12}
                    estimateRowHeight={104}
                    renderRow={(r) => {
                      const st = STATUS_MAP[r.status];
                      const p = profiles.get(r.user_id);
                      const trip = trips.get(r.id);
                      const driver = trip?.driver_id ? drivers.find((d) => d.user_id === trip.driver_id) : null;
                      const gerant = trip?.gerant_id ? gerants.find((g) => g.user_id === trip.gerant_id) : null;
                      const payment = payments.get(r.id);
                      const canAssign = r.paiement_valide && r.status === "CONFIRMED" && canAssignTrip(r.service_type);
                      return (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-4 font-medium text-xs">{r.id.slice(0, 8)}…</td>
                          <td className="p-4">
                            {r.reference_code || r.agent_code ? (
                              <div className="flex flex-col gap-0.5 font-mono text-[11px]">
                                {r.reference_code && (
                                  <span title="Code client (référence)">REF · <span className="font-bold tracking-wider">{r.reference_code}</span></span>
                                )}
                                {r.agent_code && (
                                  <span className="text-muted-foreground" title="Code agent">AGT · <span className="font-bold tracking-wider">{r.agent_code}</span></span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">—</span>
                            )}
                          </td>
                          <td className="p-4">{p?.full_name ?? "—"}</td>
                          <td className="p-4">{SERVICE_LABELS[r.service_type] ?? r.service_type}</td>
                          <td className="p-4 hidden md:table-cell text-muted-foreground text-xs">{detailsLabel(r)}</td>
                          <td className="p-4 text-xs">{new Date(r.reservation_date).toLocaleDateString("fr-FR")}</td>
                          <td className="p-4 font-medium">{formatXAF(r.total_amount)}</td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1">
                              <Badge variant={st.variant}>{st.label}</Badge>
                              {r.paiement_valide && (
                                <Badge variant="default" className="text-[10px] gap-1">
                                  <ShieldCheck className="h-3 w-3" /> Paiement OK
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-xs">
                            {payment ? (
                              <div className="flex flex-col gap-1">
                                <Badge
                                  variant={payment.status === "VALIDATED" ? "default" : payment.status === "REJECTED" ? "destructive" : "outline"}
                                  className="text-[10px] w-fit"
                                >
                                  {payment.status} · {formatXAF(payment.amount)}
                                </Badge>
                                {payment.receipt_url && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[11px] w-fit"
                                    onClick={() => viewProof(payment.receipt_url!)}
                                  >
                                    <Receipt className="h-3 w-3 mr-1" /> Voir
                                  </Button>
                                )}
                                {payment.status === "PENDING" && !r.paiement_valide && (
                                  <Button
                                    size="sm"
                                    className="h-6 px-2 text-[11px] w-fit"
                                    onClick={() => validatePayment(r)}
                                    disabled={validatingId === r.id}
                                  >
                                    {validatingId === r.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <><ShieldCheck className="h-3 w-3 mr-1" /> Valider</>
                                    )}
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">Aucune</span>
                            )}
                          </td>
                          <td className="p-4 text-xs">
                            {trip ? (
                              <div className="space-y-0.5">
                                {driver && <div>👤 {driver.full_name}</div>}
                                {gerant && <div>🧭 {gerant.full_name}</div>}
                                <Badge variant="secondary" className="text-[10px]">{trip.status}</Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Non assignée</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              {r.status === "PENDING_PAYMENT" && (
                                <>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-success" title="Confirmer" onClick={() => updateStatus(r.id, "CONFIRMED")}>
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Rejeter" onClick={() => updateStatus(r.id, "REJECTED")}>
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {canAssign && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" title="Assigner" onClick={() => setAssignTarget(r)}>
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                              )}
                              {r.status === "CONFIRMED" && !r.paiement_valide && (
                                <span className="text-[10px] text-muted-foreground italic">Validez le paiement</span>
                              )}
                              <Button size="icon" variant="ghost" className="h-8 w-8" title="Voir détails" onClick={() => setDetailsTarget(r)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {r.archived_at ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-success"
                                  title="Restaurer"
                                  onClick={() => archiveReservation(r, true)}
                                  disabled={archivingId === r.id}
                                >
                                  {archivingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
                                </Button>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive"
                                  title="Archiver (suppression douce)"
                                  onClick={() => {
                                    if (confirm("Archiver cette réservation ? Elle ne sera plus visible par le client.")) archiveReservation(r);
                                  }}
                                  disabled={archivingId === r.id}
                                >
                                  {archivingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }}
                  />
                  )}
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {assignTarget && (
        <AssignDialog
          reservation={assignTarget}
          existingTrip={trips.get(assignTarget.id) ?? null}
          drivers={drivers}
          gerants={gerants}
          clientName={profiles.get(assignTarget.user_id)?.full_name ?? "Client"}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => {
            setAssignTarget(null);
            loadAll();
          }}
        />
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-10 right-0 rounded-md bg-background/80 p-2 hover:bg-background"
            >
              <X className="h-5 w-5" />
            </button>
            <img loading="lazy" decoding="async" src={previewUrl} alt="Preuve de paiement" className="w-full h-auto rounded-lg shadow-2xl" />
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block text-center text-sm text-primary-foreground bg-primary rounded-lg py-2 hover:bg-primary/90"
            >
              Ouvrir en plein écran
            </a>
          </div>
        </div>
      )}

      {detailsTarget && (
        <DetailsDialog
          reservation={detailsTarget}
          profile={profiles.get(detailsTarget.user_id) ?? null}
          trip={trips.get(detailsTarget.id) ?? null}
          driver={(() => {
            const t = trips.get(detailsTarget.id);
            return t?.driver_id ? drivers.find(d => d.user_id === t.driver_id) ?? null : null;
          })()}
          gerant={(() => {
            const t = trips.get(detailsTarget.id);
            return t?.gerant_id ? gerants.find(g => g.user_id === t.gerant_id) ?? null : null;
          })()}
          payments={allPayments.get(detailsTarget.id) ?? []}
          onClose={() => setDetailsTarget(null)}
          onViewProof={viewProof}
          serviceLabel={SERVICE_LABELS[detailsTarget.service_type] ?? detailsTarget.service_type}
        />
      )}
    </div>
  );
}

function DetailsDialog({
  reservation,
  profile,
  trip,
  driver,
  gerant,
  payments,
  onClose,
  onViewProof,
  serviceLabel,
}: {
  reservation: Reservation;
  profile: Profile | null;
  trip: Trip | null;
  driver: Profile | null;
  gerant: Profile | null;
  payments: PaymentRow[];
  onClose: () => void;
  onViewProof: (path: string) => void;
  serviceLabel: string;
}) {
  const st = STATUS_MAP[reservation.status];
  const details = reservation.details ?? {};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-card p-5 shadow-xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Détails de la réservation</h2>
            <p className="text-xs text-muted-foreground font-mono">{reservation.id}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 text-sm">
          {/* Statut + montants */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground mb-1">Statut</div>
              <Badge variant={st.variant}>{st.label}</Badge>
              {reservation.paiement_valide && (
                <Badge variant="default" className="ml-2 text-[10px] gap-1">
                  <ShieldCheck className="h-3 w-3" /> Paiement validé
                </Badge>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground mb-1">Montants</div>
              <div className="font-medium">{formatXAF(reservation.paid_amount)} / {formatXAF(reservation.total_amount)}</div>
            </div>
          </div>

          {/* Client */}
          <div className="rounded-lg border p-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">👤 CLIENT</div>
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Nom : </span>{profile?.full_name ?? "—"}</div>
              <div><span className="text-muted-foreground">Email : </span>{profile?.email ?? "—"}</div>
              <div><span className="text-muted-foreground">Téléphone : </span>{profile?.phone ?? "—"}</div>
              <div><span className="text-muted-foreground">User ID : </span><span className="font-mono text-xs">{reservation.user_id.slice(0, 8)}…</span></div>
            </div>
          </div>

          {/* Service */}
          <div className="rounded-lg border p-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">🚌 SERVICE</div>
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Type : </span>{serviceLabel}</div>
              <div><span className="text-muted-foreground">Date : </span>{new Date(reservation.reservation_date).toLocaleDateString("fr-FR")}</div>
              <div><span className="text-muted-foreground">Créée : </span>{new Date(reservation.created_at).toLocaleString("fr-FR")}</div>
            </div>
            {Object.keys(details).length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-primary">Voir tous les détails saisis</summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/50 p-2 text-[11px]">{JSON.stringify(details, null, 2)}</pre>
              </details>
            )}
          </div>

          {/* Trajet */}
          {trip && (
            <div className="rounded-lg border p-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2">📍 TRAJET</div>
              <div className="space-y-1">
                <div><span className="text-muted-foreground">Statut : </span><Badge variant="secondary" className="text-[10px]">{trip.status}</Badge></div>
                {driver && <div>👤 Chauffeur : <strong>{driver.full_name}</strong> · {driver.phone ?? "—"}</div>}
                {gerant && <div>🧭 Gérant : <strong>{gerant.full_name}</strong> · {gerant.phone ?? "—"}</div>}
              </div>
            </div>
          )}

          {/* Paiements */}
          <div className="rounded-lg border p-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">💳 PAIEMENTS ({payments.length})</div>
            {payments.length === 0 ? (
              <div className="text-muted-foreground italic text-xs">Aucun paiement enregistré.</div>
            ) : (
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded border bg-muted/30 p-2 text-xs">
                    <div>
                      <div className="font-medium">{formatXAF(p.amount)}</div>
                      <div className="text-muted-foreground">{new Date(p.created_at).toLocaleString("fr-FR")}</div>
                      {p.transaction_ref && <div className="font-mono text-[10px]">Ref: {p.transaction_ref}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === "VALIDATED" ? "default" : p.status === "REJECTED" ? "destructive" : "outline"}>
                        {p.status}
                      </Badge>
                      {p.receipt_url && (
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onViewProof(p.receipt_url!)}>
                          <Receipt className="h-3 w-3 mr-1" /> Preuve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {reservation.admin_comment && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
              <div className="text-xs font-semibold text-muted-foreground mb-1">📝 Commentaire admin</div>
              <div>{reservation.admin_comment}</div>
            </div>
          )}

          {reservation.archived_at && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
              ⚠️ Réservation archivée le {new Date(reservation.archived_at).toLocaleString("fr-FR")}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  );
}

function AssignDialog({
  reservation,
  existingTrip,
  drivers,
  gerants,
  clientName,
  onClose,
  onAssigned,
}: {
  reservation: Reservation;
  existingTrip: Trip | null;
  drivers: Profile[];
  gerants: Profile[];
  clientName: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const showDriver = requiresDriver(reservation.service_type);
  const showGerant = requiresGerant(reservation.service_type);
  const [driverId, setDriverId] = useState(existingTrip?.driver_id ?? "");
  const [gerantId, setGerantId] = useState(existingTrip?.gerant_id ?? "");
  const [saving, setSaving] = useState(false);

  const handleAssign = async () => {
    if (showDriver && !driverId) {
      toast.error("Sélectionnez un chauffeur.");
      return;
    }
    if (showGerant && !gerantId) {
      toast.error("Sélectionnez un gérant.");
      return;
    }
    setSaving(true);
    try {
      // Strict routing: only set the field that belongs to this service type.
      const driverValue = showDriver ? driverId || null : null;
      const gerantValue = showGerant ? gerantId || null : null;

      if (existingTrip) {
        const { error } = await supabase
          .from("trips")
          .update({
            driver_id: driverValue,
            gerant_id: gerantValue,
            status: "assigned",
          })
          .eq("id", existingTrip.id);
        if (error) throw error;
      } else {
        const d = reservation.details as Record<string, unknown>;
        const origin = (d.pickup as string) || (d.route as string) || "";
        const destination = (d.destination as string) || (d.circuit as string) || "";
        const { error } = await supabase.from("trips").insert({
          reservation_id: reservation.id,
          client_id: reservation.user_id,
          driver_id: driverValue,
          gerant_id: gerantValue,
          status: "assigned",
          origin_address: origin,
          destination_address: destination,
        });
        if (error) throw error;
      }
      toast.success("Assignation enregistrée.");
      onAssigned();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur d'assignation.";
      toast.error(msg);
      console.error("[ASSIGN]", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {showDriver ? "Assigner la course" : "Assigner le gérant"}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="text-xs text-muted-foreground">Client</div>
          <div className="font-medium">{clientName}</div>
          <div className="mt-2 text-xs text-muted-foreground">Service</div>
          <div className="font-medium">{SERVICE_LABELS[reservation.service_type] ?? reservation.service_type}</div>
        </div>

        <div className="mt-4 space-y-3">
          {showDriver && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Chauffeur</label>
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <option value="">— Choisir —</option>
                {drivers.map((d) => (
                  <option key={d.user_id} value={d.user_id}>{d.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {showGerant && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Gérant</label>
              <select
                value={gerantId}
                onChange={(e) => setGerantId(e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <option value="">— Choisir —</option>
                {gerants.map((g) => (
                  <option key={g.user_id} value={g.user_id}>{g.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {!showDriver && !showGerant && (
            <p className="text-sm text-muted-foreground italic">
              Ce service ne requiert pas d'assignation. La réservation reste dans son module d'origine après validation du paiement.
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          {(showDriver || showGerant) && (
            <Button onClick={handleAssign} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer l'assignation"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
