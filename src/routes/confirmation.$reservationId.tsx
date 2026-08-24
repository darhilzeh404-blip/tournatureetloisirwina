import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Bus,
  CalendarCheck,
  CarFront,
  GraduationCap,
  Loader2,
  Package,
  Plane,
  Ship,
  Train,
  Truck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SuccessScreen, type SuccessDetail } from "@/components/SuccessScreen";
import { toast } from "sonner";

export const Route = createFileRoute("/confirmation/$reservationId")({
  head: () => ({
    meta: [
      { title: "Réservation confirmée — WINA TOUR" },
      {
        name: "description",
        content: "Confirmation de votre réservation WINA TOUR : récapitulatif du service, de la date et des passagers.",
      },
      { property: "og:title", content: "Réservation confirmée — WINA TOUR" },
      {
        property: "og:description",
        content: "Votre réservation WINA TOUR est enregistrée. Retrouvez le récapitulatif complet de votre voyage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfirmationPage,
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

type Ctx = {
  icon: ReactNode;
  title: string;
  message: string;
  label: string;
};

function contextFor(serviceType: string | null, details: Record<string, any>): Ctx {
  const s = (serviceType ?? "").toLowerCase();
  const mode = String(details.mode ?? "").toLowerCase();

  if (s.includes("scolaire")) {
    return {
      icon: <GraduationCap className="h-9 w-9" />,
      title: "Transport scolaire réservé",
      message:
        "Votre demande d'abonnement scolaire est enregistrée. Notre équipe valide le trajet et vous confirme la prise en charge de votre enfant.",
      label: "Transport scolaire",
    };
  }
  if (s.includes("location") || s.includes("bus") || mode === "bus") {
    return {
      icon: <Bus className="h-9 w-9" />,
      title: "Réservation bus confirmée",
      message:
        "Votre réservation est bien enregistrée. Vous recevrez votre billet et les détails d'embarquement après validation par notre équipe.",
      label: "Bus",
    };
  }
  if (mode === "bateau" || s.includes("navire") || s.includes("bateau")) {
    return {
      icon: <Ship className="h-9 w-9" />,
      title: "Traversée réservée",
      message: "Votre traversée est enregistrée. Votre billet vous sera remis sous 24 heures.",
      label: "Navire",
    };
  }
  if (mode === "train" || s.includes("train") || details.train_booking) {
    return {
      icon: <Train className="h-9 w-9" />,
      title: "Billet de train réservé",
      message: "Votre paiement est reçu. Votre billet est en cours de traitement.",
      label: "Train",
    };
  }
  if (s.includes("vol") || s.includes("avion")) {
    return {
      icon: <Plane className="h-9 w-9" />,
      title: "Demande de vol enregistrée",
      message: "Nous traitons votre demande et revenons vers vous avec une proposition détaillée.",
      label: "Vol",
    };
  }
  if (s.includes("vtc") || s.includes("course")) {
    return {
      icon: <CarFront className="h-9 w-9" />,
      title: "Course confirmée",
      message: "Votre course est enregistrée. Vous serez notifié dès qu'un chauffeur est assigné.",
      label: "VTC",
    };
  }
  if (s.includes("colis")) {
    return {
      icon: <Package className="h-9 w-9" />,
      title: "Expédition enregistrée",
      message: "Votre demande d'expédition est bien reçue. Un conseiller vous contacte pour le retrait du colis.",
      label: "Expédition de colis",
    };
  }
  if (s.includes("demenagement") || s.includes("déménagement") || s.includes("funer") || s.includes("funé")) {
    return {
      icon: <Truck className="h-9 w-9" />,
      title: "Demande enregistrée",
      message: "Votre demande est bien reçue. Notre équipe vous transmet un devis détaillé dans les meilleurs délais.",
      label: "Service spécial",
    };
  }
  return {
    icon: <CalendarCheck className="h-9 w-9" />,
    title: "Réservation confirmée",
    message:
      "Votre réservation est bien enregistrée. Notre équipe la valide et vous tient informé à chaque étape.",
    label: serviceType ?? "Service",
  };
}

function ConfirmationPage() {
  const { reservationId } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("reservations")
        .select("id, service_type, reservation_date, total_amount, paid_amount, status, details, reference_code, created_at")
        .eq("id", reservationId)
        .maybeSingle();
      if (!active) return;
      setRow(data ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [reservationId]);

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const details = (row?.details ?? {}) as Record<string, any>;
  const ctx = contextFor(row?.service_type ?? null, details);

  const dateValue: string | null =
    details.departure_date ?? details.date ?? row?.reservation_date ?? row?.created_at ?? null;
  const timeValue: string | null = details.departure_time ?? details.time ?? details.heure ?? null;

  const adults = Number(details.adults ?? 0);
  const children = Number(details.children ?? details.nombre_enfants ?? 0);
  const infants = Number(details.infants ?? 0);
  const passengersCount = Number(details.passengers_count ?? details.seats ?? adults + children + infants);

  const items: SuccessDetail[] = [];
  items.push({ label: "Référence", value: row?.reference_code ?? String(reservationId).slice(0, 8).toUpperCase() });
  items.push({ label: "Service", value: ctx.label });
  if (details.origin && details.destination) {
    items.push({ label: "Trajet", value: `${details.origin} → ${details.destination}` });
  }
  if (dateValue) {
    items.push({
      label: "Date",
      value: new Date(dateValue).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }),
    });
  }
  if (timeValue) items.push({ label: "Heure", value: String(timeValue).slice(0, 5) });
  if (passengersCount > 0) {
    items.push({
      label: children || infants ? "Voyageurs" : "Passagers",
      value:
        children || infants
          ? `${adults} adulte(s), ${children} enfant(s)${infants ? `, ${infants} bébé(s)` : ""}`
          : `${passengersCount}`,
    });
  }
  if (row?.total_amount != null) items.push({ label: "Montant", value: fmt(Number(row.total_amount)) });

  const isConfirmed = String(row?.status ?? "").toUpperCase() === "CONFIRMED";
  const reference = row?.reference_code ?? String(reservationId).slice(0, 8).toUpperCase();

  const downloadReceipt = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { downloadReservationReceipt } = await import("@/lib/reservation-receipt");
      downloadReservationReceipt({
        reference,
        serviceLabel: ctx.label,
        status: "Confirmée",
        issuedAt: row?.created_at ?? null,
        rows: items
          .filter((d) => d.label !== "Montant")
          .map((d) => [d.label, String(d.value ?? "—")] as [string, string]),
        totalAmount: Number(row?.total_amount ?? 0),
        paidAmount: row?.paid_amount != null ? Number(row.paid_amount) : null,
      });
      toast.success("Reçu PDF téléchargé");
    } catch (e) {
      console.error("[confirmation] reçu PDF", e);
      toast.error("Impossible de générer le reçu PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SuccessScreen
      icon={ctx.icon}
      title={ctx.title}
      message={ctx.message}
      details={items}
      note="Vous pouvez suivre l'avancement de cette réservation à tout moment depuis « Mes réservations »."
      actions={[
        ...(isConfirmed
          ? [
              {
                label: downloading ? "Génération du reçu…" : "Télécharger le reçu PDF",
                onClick: downloadReceipt,
              },
            ]
          : []),
        { label: "Voir mes réservations", variant: isConfirmed ? ("ghost" as const) : undefined, onClick: () => navigate({ to: "/mes-reservations" }) },
        { label: "Retour à l'accueil", variant: "ghost", onClick: () => navigate({ to: "/espace-client" }) },
      ]}
    />
  );
}
