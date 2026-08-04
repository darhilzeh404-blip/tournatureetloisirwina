import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/demenagements")({
  head: () => ({
    meta: [
      { title: "Déménagements — Admin Wina" },
      { name: "description", content: "Gestion des demandes de déménagement premium." },
    ],
  }),
  component: AdminDemenagements,
});

type Reservation = {
  id: string;
  user_id: string;
  reservation_date: string;
  status: "PENDING_PAYMENT" | "CONFIRMED" | "REJECTED" | "CANCELLED";
  total_amount: number;
  paid_amount: number;
  details: Record<string, unknown> | null;
  created_at: string;
};

type Profile = {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

const STATUS_LABEL: Record<Reservation["status"], { label: string; variant: "outline" | "default" | "destructive" | "secondary" }> = {
  PENDING_PAYMENT: { label: "En attente", variant: "outline" },
  CONFIRMED: { label: "Confirmée", variant: "default" },
  REJECTED: { label: "Refusée", variant: "destructive" },
  CANCELLED: { label: "Annulée", variant: "secondary" },
};

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function AdminDemenagements() {
  const { isAuthenticated, isLoading, role, user } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || role !== "admin")) {
      navigate({ to: "/connexion" });
    }
  }, [isAuthenticated, isLoading, role, navigate]);

  useEffect(() => {
    if (!user || role !== "admin") return;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("reservations")
          .select("id, user_id, reservation_date, status, total_amount, paid_amount, details, created_at")
          .eq("service_type", "DEMENAGEMENT" as never)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = (data as Reservation[]) ?? [];
        setReservations(rows);

        const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
        if (userIds.length > 0) {
          const { data: profileRows, error: profileError } = await supabase
            .from("profiles")
            .select("user_id, full_name, email, phone")
            .in("user_id", userIds);

          if (profileError) throw profileError;

          const map: Record<string, Profile> = {};
          (profileRows ?? []).forEach((profile) => {
            map[profile.user_id] = profile as Profile;
          });
          setProfiles(map);
        } else {
          setProfiles({});
        }
      } catch (err) {
        console.error("[admin/demenagements]", err);
        toast.error("Impossible de charger les demandes de déménagement.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [role, user]);

  const updateStatus = async (id: string, status: Reservation["status"]) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
      if (error) throw error;
      setReservations((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
      toast.success(`Statut mis à jour : ${STATUS_LABEL[status].label}`);
    } catch (err) {
      console.error("[admin/demenagements] update", err);
      toast.error("Impossible de mettre à jour le statut.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Demandes de déménagement</h1>
        <p className="text-sm text-muted-foreground">Gérez les réservations Déménagement et suivez les paiements.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Déménagements en cours</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement...
            </div>
          ) : reservations.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Aucune demande de déménagement trouvée.</div>
          ) : (
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="px-3 py-3">Client</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Montant</th>
                  <th className="px-3 py-3">Détails</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => {
                  const profile = profiles[reservation.user_id];
                  const details = reservation.details as Record<string, unknown> | null;
                  const pickupAddress = details?.pickup_address as string | undefined;
                  const destinationAddress = details?.destination_address as string | undefined;
                  const serviceLevel = details?.service_level as string | undefined;

                  return (
                    <tr key={reservation.id} className="rounded-3xl border border-border/80 bg-card">
                      <td className="px-3 py-3 align-top text-sm font-semibold text-foreground">
                        {profile?.full_name || "Client inconnu"}
                        <div className="text-xs text-muted-foreground">{profile?.email || profile?.phone || reservation.user_id}</div>
                      </td>
                      <td className="px-3 py-3 align-top text-sm text-foreground">{reservation.reservation_date}</td>
                      <td className="px-3 py-3 align-top text-sm text-foreground">{formatXAF(reservation.total_amount)}</td>
                      <td className="px-3 py-3 align-top text-sm text-muted-foreground">
                        {pickupAddress && destinationAddress ? `${pickupAddress} → ${destinationAddress}` : "—"}
                        {serviceLevel ? ` · ${serviceLevel}` : ""}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Badge variant={STATUS_LABEL[reservation.status].variant}>{STATUS_LABEL[reservation.status].label}</Badge>
                      </td>
                      <td className="px-3 py-3 align-top space-x-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={updatingId === reservation.id}
                          onClick={() => void updateStatus(reservation.id, "CONFIRMED")}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={updatingId === reservation.id}
                          onClick={() => void updateStatus(reservation.id, "REJECTED")}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
