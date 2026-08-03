import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Home, Loader2, MapPin, Package, ShieldCheck } from "lucide-react";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/ui/number-input";
import { toast } from "sonner";

export const Route = createFileRoute("/demenagement")({
  head: () => ({
    meta: [
      { title: "Déménagement — Agence Wina" },
      { name: "description", content: "Demandez un déménagement premium à Libreville, Owendo ou Akanda." },
    ],
  }),
  component: DemenagementPage,
});

type ServiceLevel = "standard" | "premium";

function DemenagementPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [pickupAddress, setPickupAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [volumeM3, setVolumeM3] = useState(5);
  const [serviceLevel, setServiceLevel] = useState<ServiceLevel>("standard");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/connexion" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const amount = useMemo(() => {
    const base = 80_000;
    const volume = Math.max(1, volumeM3);
    const volumePrice = volume * 15_000;
    const premiumFee = serviceLevel === "premium" ? 25_000 : 0;
    return base + volumePrice + premiumFee;
  }, [serviceLevel, volumeM3]);

  const handleSubmit = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour réserver votre déménagement.");
      navigate({ to: "/connexion" });
      return;
    }
    if (!pickupAddress.trim()) {
      toast.error("Adresse de départ requise.");
      return;
    }
    if (!destinationAddress.trim()) {
      toast.error("Adresse de destination requise.");
      return;
    }
    if (!plannedDate) {
      toast.error("Choisissez une date de déménagement.");
      return;
    }
    if (!contactName.trim()) {
      toast.error("Nom du contact requis.");
      return;
    }
    if (!/^[0-9+\s().-]{8,20}$/.test(contactPhone.trim())) {
      toast.error("Téléphone de contact invalide.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.from("reservations").insert({
        user_id: user.id,
        service_type: "DEMENAGEMENT" as const,
        reservation_date: plannedDate,
        total_amount: amount,
        paid_amount: 0,
        paiement_valide: false,
        status: "PENDING_PAYMENT" as const,
        details: {
          pickup_address: pickupAddress.trim(),
          destination_address: destinationAddress.trim(),
          planned_date: plannedDate,
          volume_m3: volumeM3,
          service_level: serviceLevel,
          contact_name: contactName.trim(),
          contact_phone: contactPhone.trim(),
          instructions: instructions.trim(),
        },
      }).select("id").single();
      if (error || !data) throw error ?? new Error("Impossible de créer la réservation.");
      toast.success("Demande de déménagement créée. Finalisez le paiement pour la valider.");
      navigate({ to: "/paiement/$reservationId", params: { reservationId: data.id } });
    } catch (err: any) {
      toast.error(err?.message || "Impossible de créer la demande.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24">
      <section className="rounded-b-[28px] bg-gradient-to-br from-primary/10 via-background to-background px-5 pb-8 pt-8 shadow-sm shadow-primary/10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Service Premium</p>
              <h1 className="mt-2 text-3xl font-extrabold text-foreground">Déménagement</h1>
            </div>
            <div className="rounded-3xl bg-card px-4 py-3 text-sm shadow-sm">
              <div className="font-semibold">Tarif estimé</div>
              <div className="mt-1 text-2xl font-bold text-primary">{new Intl.NumberFormat("fr-FR").format(amount)} XAF</div>
            </div>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Réservez un déménagement sur mesure avec prise en charge complète. Indiquez votre volume, vos adresses et vos besoins, puis payez pour lancer la validation.
          </p>
        </div>
      </section>

      <main className="mx-auto mt-6 max-w-4xl px-5">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6 rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Package className="h-5 w-5" />
                <span>Informations de déménagement</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pickupAddress">Adresse de départ</Label>
                  <Input
                    id="pickupAddress"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="Ex: Libreville, Quartier Louis"
                  />
                </div>
                <div>
                  <Label htmlFor="destinationAddress">Adresse de destination</Label>
                  <Input
                    id="destinationAddress"
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    placeholder="Ex: Akanda, Centre-ville"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="plannedDate">Date souhaitée</Label>
                  <Input
                    id="plannedDate"
                    type="date"
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="volumeM3">Volume estimé (m³)</Label>
                  <NumberInput
                    id="volumeM3"
                    value={volumeM3}
                    min={1}
                    max={200}
                    onChange={setVolumeM3}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <Label>Formule</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { value: "standard" as ServiceLevel, label: "Standard", description: "Prise en charge économique" },
                    { value: "premium" as ServiceLevel, label: "Premium", description: "Déménagement haut de gamme" },
                  ].map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setServiceLevel(option.value)}
                      className={`rounded-3xl border p-4 text-left transition ${serviceLevel === option.value ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-foreground">{option.label}</span>
                        {serviceLevel === option.value && <ShieldCheck className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="instructions">Instructions supplémentaires</Label>
                <Textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={5}
                  placeholder="Indiquez si vous avez besoin d'emballage, d'un monte-meuble, etc."
                />
              </div>
            </div>
          </section>

          <aside className="space-y-6 rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Home className="h-5 w-5" />
                <span>Coordonnées</span>
              </div>

              <div className="grid gap-4">
                <div>
                  <Label htmlFor="contactName">Nom du contact</Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Nom complet"
                  />
                </div>
                <div>
                  <Label htmlFor="contactPhone">Téléphone</Label>
                  <Input
                    id="contactPhone"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+241 07 00 00 00"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <MapPin className="h-4 w-4" />
                <span>Résumé de la demande</span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p><span className="font-semibold text-foreground">Date :</span> {plannedDate || "Non définie"}</p>
                <p><span className="font-semibold text-foreground">Volume :</span> {volumeM3} m³</p>
                <p><span className="font-semibold text-foreground">Formule :</span> {serviceLevel === "premium" ? "Premium" : "Standard"}</p>
                <p><span className="font-semibold text-foreground">Total estimé :</span> {new Intl.NumberFormat("fr-FR").format(amount)} XAF</p>
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Réserver mon déménagement"}
            </Button>

            <div className="rounded-3xl border border-border/70 bg-primary/5 p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Paiement sécurisé</p>
              <p>Vous serez redirigé vers la page de paiement pour finaliser la réservation.</p>
            </div>
          </aside>
        </div>
      </main>

      <ClientNav />
    </div>
  );
}
