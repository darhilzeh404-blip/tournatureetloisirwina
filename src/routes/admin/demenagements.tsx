import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/demenagements")({
  head: () => ({
    meta: [
      { title: "Déménagements — Admin Wina" },
      {
        name: "description",
        content: "Gestion des demandes de déménagement premium.",
      },
    ],
  }),
  component: AdminDemenagements,
});

type MovingRequest = {
  id: string;
  user_id: string;
  reference_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  from_address: string;
  to_address: string;
  desired_date: string;
  housing_type: string;
  service_type: string;
  volume: string;
  floor_from: string | null;
  floor_to: string | null;
  movers_count: number;
  packing: string;
  status: string;
  paid: boolean;
  paid_amount: number;
  created_at: string;
};

const STATUS_LABEL: Record<
  string,
  {
    label: string;
    variant:
      | "outline"
      | "default"
      | "destructive"
      | "secondary";
  }
> = {
  NOUVELLE: {
    label: "Nouvelle",
    variant: "outline",
  },
  ANALYSE: {
    label: "En analyse",
    variant: "secondary",
  },
  DEVIS_ENVOYE: {
    label: "Devis envoyé",
    variant: "default",
  },
  ACCEPTE: {
    label: "Acceptée",
    variant: "default",
  },
  REFUSE: {
    label: "Refusée",
    variant: "destructive",
  },
  MODIFICATION_DEMANDEE: {
    label: "Modification demandée",
    variant: "secondary",
  },
  EN_COURS: {
    label: "En cours",
    variant: "default",
  },
  TERMINE: {
    label: "Terminée",
    variant: "default",
  },
  ANNULE: {
    label: "Annulée",
    variant: "destructive",
  },
};

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " XAF";
}

function AdminDemenagements() {
  const { isAuthenticated, isLoading, role, user } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<MovingRequest[]>([]);
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
          .from("moving_requests")
          .select(`
            id,
            user_id,
            reference_code,
            full_name,
            phone,
            email,
            from_address,
            to_address,
            desired_date,
            housing_type,
            service_type,
            volume,
            floor_from,
            floor_to,
            movers_count,
            packing,
            status,
            paid,
            paid_amount,
            created_at,
            moving_quotes(price, status)
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Application fees are never WINA revenue: show the accepted quote's service price.
        setRequests(((data as any[]) ?? []).map((r) => {
          const q = (r.moving_quotes ?? []).find((x: any) => x.status === "ACCEPTE");
          return { ...r, paid_amount: r.paid && q ? Math.min(Number(r.paid_amount ?? 0), Number(q.price)) : r.paid_amount };
        }) as MovingRequest[]);
      } catch (err) {
        console.error("[admin/demenagements]", err);
        toast.error(
          "Impossible de charger les demandes de déménagement.",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [role, user]);

  const updateStatus = async (
    id: string,
    status: string,
  ) => {
    setUpdatingId(id);

    try {
      const { error } = await supabase
        .from("moving_requests")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      setRequests((prev) =>
        prev.map((row) =>
          row.id === id
            ? { ...row, status }
            : row,
        ),
      );

      toast.success(
        `Statut mis à jour : ${
          STATUS_LABEL[status]?.label ?? status
        }`,
      );
    } catch (err) {
      console.error(
        "[admin/demenagements] update",
        err,
      );

      toast.error(
        "Impossible de mettre à jour le statut.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">
          Demandes de déménagement
        </h1>

        <p className="text-sm text-muted-foreground">
          Gérez les demandes de déménagement et
          suivez leur traitement.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Demandes de déménagement
          </CardTitle>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Chargement...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Aucune demande de déménagement trouvée.
            </div>
          ) : (
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="px-3 py-3">
                    Référence
                  </th>

                  <th className="px-3 py-3">
                    Client
                  </th>

                  <th className="px-3 py-3">
                    Trajet
                  </th>

                  <th className="px-3 py-3">
                    Date
                  </th>

                  <th className="px-3 py-3">
                    Formule
                  </th>

                  <th className="px-3 py-3">
                    Volume
                  </th>

                  <th className="px-3 py-3">
                    Statut
                  </th>

                  <th className="px-3 py-3">
                    Paiement
                  </th>

                  <th className="px-3 py-3">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {requests.map((request) => {
                  const status =
                    STATUS_LABEL[request.status] ?? {
                      label: request.status,
                      variant: "outline" as const,
                    };

                  return (
                    <tr
                      key={request.id}
                      className="rounded-3xl border border-border/80 bg-card"
                    >
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold">
                          {request.reference_code}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {request.id.slice(0, 8)}
                        </div>
                      </td>

                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold">
                          {request.full_name}
                        </div>

                        {request.phone && (
                          <div className="text-xs text-muted-foreground">
                            {request.phone}
                          </div>
                        )}

                        {request.email && (
                          <div className="text-xs text-muted-foreground">
                            {request.email}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3 align-top">
                        <div className="max-w-[260px]">
                          <div>
                            <span className="font-medium">
                              Départ :
                            </span>{" "}
                            {request.from_address}
                          </div>

                          <div className="mt-1">
                            <span className="font-medium">
                              Arrivée :
                            </span>{" "}
                            {request.to_address}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3 align-top">
                        {request.desired_date}
                      </td>

                      <td className="px-3 py-3 align-top">
                        {request.service_type}
                      </td>

                      <td className="px-3 py-3 align-top">
                        {request.volume}
                      </td>

                      <td className="px-3 py-3 align-top">
                        <Badge variant={status.variant}>
                          {status.label}
                        </Badge>
                      </td>

                      <td className="px-3 py-3 align-top">
                        {request.paid ? (
                          <div>
                            <Badge variant="default">
                              Payé
                            </Badge>

                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatXAF(
                                Number(
                                  request.paid_amount,
                                ),
                              )}
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline">
                            Non payé
                          </Badge>
                        )}
                      </td>

                      <td className="px-3 py-3 align-top">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={
                              updatingId === request.id
                            }
                            onClick={() =>
                              void updateStatus(
                                request.id,
                                "ANALYSE",
                              )
                            }
                            title="Mettre en analyse"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={
                              updatingId === request.id
                            }
                            onClick={() =>
                              void updateStatus(
                                request.id,
                                "REFUSE",
                              )
                            }
                            title="Refuser"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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