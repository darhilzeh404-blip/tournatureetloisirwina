import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plane, Calendar, MapPin, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { randomId } from "@/lib/random-id";
import { AgencyLogo } from "@/components/AgencyLogo";

export const Route = createFileRoute("/vols/$programId")({
  component: BookFlight,
});

const FCFA = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "";

type Program = {
  id: string; agency_id: string; title: string; airline_name: string | null;
  flight_number: string | null; origin: string; destination: string;
  departure_at: string | null; arrival_at: string | null; price: number;
  service_fee: number | null; seats_available: number; class: string | null;
  description: string | null; image_url: string | null;
};

type Passenger = {
  full_name: string;
  passport_number: string;
  passport_expiry: string;
  nationality: string;
  photoFile: File | null;
  photoPath: string | null;
  uploading: boolean;
};

type Pickup = { id: string; name: string; address: string | null };

const newPassenger = (): Passenger => ({
  full_name: "",
  passport_number: "",
  passport_expiry: "",
  nationality: "Gabonaise",
  photoFile: null,
  photoPath: null,
  uploading: false,
});

function BookFlight() {
  const { programId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [program, setProgram] = useState<Program | null>(null);
  const [agency, setAgency] = useState<{ id: string; name: string; logo_url: string | null } | null>(null);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(true);

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [passengers, setPassengers] = useState<Passenger[]>([newPassenger()]);
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup_wina" | "email_only">("email_only");
  const [pickupId, setPickupId] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase
        .from("flight_programs" as any)
        .select("*")
        .eq("id", programId)
        .maybeSingle();
      if (!p) { setLoading(false); return; }
      setProgram(p as any);

      const { data: a } = await supabase
        .from("partner_agencies_public" as any)
        .select("id,name,logo_url")
        .eq("id", (p as any).agency_id)
        .maybeSingle();
      if (a) setAgency(a as any);

      const { data: pk } = await supabase
        .from("flight_pickup_locations" as any)
        .select("id,name,address")
        .eq("is_active", true)
        .order("name");
      setPickups(((pk as any) ?? []) as Pickup[]);
      setLoading(false);
    })();
  }, [programId]);

  useEffect(() => {
    if (user?.email && !contactEmail) setContactEmail(user.email);
  }, [user, contactEmail]);

  const unit = program ? (program.price ?? 0) + (program.service_fee ?? 0) : 0;
  const total = unit * passengers.length;
  const canPay = passengers.length > 0 && passengers.length <= (program?.seats_available ?? 0);

  const updatePassenger = (i: number, patch: Partial<Passenger>) => {
    setPassengers((prev) => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  };

  const uploadPhoto = async (i: number, file: File) => {
    if (!user) { toast.error("Connectez-vous d'abord"); return; }
    updatePassenger(i, { uploading: true, photoFile: file });
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${programId}/${randomId()}.${ext}`;
    const { error } = await supabase.storage.from("passports").upload(path, file, { upsert: false });
    if (error) { toast.error("Upload échoué: " + error.message); updatePassenger(i, { uploading: false }); return; }
    updatePassenger(i, { photoPath: path, uploading: false });
    toast.success("Passeport téléversé");
  };

  const handleSubmit = async () => {
    if (!user) { navigate({ to: "/connexion" }); return; }
    if (!program) return;
    if (!contactName.trim() || !contactPhone.trim() || !contactEmail.trim()) {
      toast.error("Renseignez le contact"); return;
    }
    for (const p of passengers) {
      if (!p.full_name.trim() || !p.passport_number.trim() || !p.photoPath) {
        toast.error("Nom, n° passeport et photo requis pour chaque passager"); return;
      }
    }
    if (deliveryMethod === "pickup" && !pickupId) { toast.error("Choisissez un point de retrait"); return; }
    if (deliveryMethod === "email" && !contactEmail) { toast.error("Email requis"); return; }
    if (passengers.length > program.seats_available) { toast.error("Pas assez de places"); return; }

    setSubmitting(true);
    try {
      const ref = "VOL-" + Date.now().toString(36).toUpperCase() + randomId().slice(0, 4).toUpperCase();
      const { data: booking, error: bErr } = await (supabase.from("flight_bookings") as any).insert({
        reference_code: ref,
        program_id: program.id,
        agency_id: program.agency_id,
        user_id: user.id,
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        contact_email: contactEmail.trim(),
        seats: passengers.length,
        unit_price: program.price,
        service_fee: program.service_fee ?? 0,
        total_amount: total,
        delivery_method: deliveryMethod,
        pickup_location_id: deliveryMethod === "pickup" ? pickupId : null,
        delivery_address: deliveryMethod === "email" ? contactEmail : null,
        status: "PENDING_PAYMENT",
      }).select("id").single();

      if (bErr || !booking) throw new Error(bErr?.message || "Création dossier échouée");

      const rows = passengers.map((p, idx) => ({
        booking_id: booking.id,
        full_name: p.full_name.trim(),
        passport_number: p.passport_number.trim(),
        passport_expiry: p.passport_expiry || null,
        nationality: p.nationality || null,
        passport_photo_url: p.photoPath!,
        seat_index: idx + 1,
      }));
      const { error: pErr } = await (supabase.from("flight_booking_passengers") as any).insert(rows);
      if (pErr) throw new Error(pErr.message);

      navigate({ to: "/paiement-vol/$bookingId", params: { bookingId: booking.id } });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main className="p-8 text-center text-sm text-muted-foreground">Chargement…</main>;
  if (!program) return <main className="p-8 text-center text-sm text-muted-foreground">Vol introuvable.</main>;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link to="/vols" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Vols
        </Link>

        <div className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            {agency?.logo_url ? (
              <AgencyLogo src={agency.logo_url} alt={agency.name} size={48} />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Plane className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{agency?.name ?? "Agence"}</p>
              <p className="text-xs text-muted-foreground">
                {program.airline_name ?? ""}{program.flight_number ? ` · ${program.flight_number}` : ""}
                {program.class ? ` · ${program.class}` : ""}
              </p>
            </div>
          </div>
          <h1 className="mt-3 text-xl font-bold">{program.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{program.origin} → {program.destination}</span>
            {program.departure_at && <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />{fmtDate(program.departure_at)}</span>}
          </div>
          {program.description && <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{program.description}</p>}
          <div className="mt-4 flex items-end justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">{program.seats_available} places restantes</span>
            <span className="text-lg font-extrabold text-primary">{FCFA(unit)} <span className="text-xs font-normal text-muted-foreground">/ passager</span></span>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-base font-bold">Contact</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><Label>Nom complet</Label><Input value={contactName} onChange={(e) => setContactName(e.target.value)} /></div>
            <div><Label>Téléphone</Label><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="074XXXXXX" /></div>
            <div className="sm:col-span-2"><Label>Email</Label><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Passagers ({passengers.length})</h2>
            <Button
              type="button" size="sm" variant="outline"
              onClick={() => setPassengers((p) => [...p, newPassenger()])}
              disabled={passengers.length >= program.seats_available}
            >
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          </div>
          <div className="mt-4 space-y-4">
            {passengers.map((p, i) => (
              <div key={i} className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Passager {i + 1}</p>
                  {passengers.length > 1 && (
                    <Button type="button" size="sm" variant="ghost"
                      onClick={() => setPassengers((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Label>Nom complet (tel qu'il apparaît sur le passeport)</Label>
                    <Input value={p.full_name} onChange={(e) => updatePassenger(i, { full_name: e.target.value })} /></div>
                  <div><Label>N° passeport</Label>
                    <Input value={p.passport_number} onChange={(e) => updatePassenger(i, { passport_number: e.target.value })} /></div>
                  <div><Label>Expiration</Label>
                    <Input type="date" value={p.passport_expiry} onChange={(e) => updatePassenger(i, { passport_expiry: e.target.value })} /></div>
                  <div><Label>Nationalité</Label>
                    <Input value={p.nationality} onChange={(e) => updatePassenger(i, { nationality: e.target.value })} /></div>
                  <div>
                    <Label>Photo du passeport</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Input type="file" accept="image/*"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(i, f); }} />
                      {p.uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {p.photoPath && !p.uploading && <span className="text-xs font-semibold text-primary">✓ ajouté</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-base font-bold">Livraison du billet</h2>
          <RadioGroup value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as any)} className="mt-3 space-y-2">
            <label className="flex items-center gap-2 rounded-xl border p-3 cursor-pointer">
              <RadioGroupItem value="email" id="d-email" />
              <span className="text-sm">Par email (billet numérique)</span>
            </label>
            <label className="flex items-center gap-2 rounded-xl border p-3 cursor-pointer">
              <RadioGroupItem value="pickup" id="d-pickup" />
              <span className="text-sm">Retrait en agence Wina</span>
            </label>
          </RadioGroup>
          {deliveryMethod === "pickup" && (
            <div className="mt-3">
              <Label>Point de retrait</Label>
              <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
                value={pickupId} onChange={(e) => setPickupId(e.target.value)}>
                <option value="">— Choisir —</option>
                {pickups.map((pk) => <option key={pk.id} value={pk.id}>{pk.name}{pk.address ? ` — ${pk.address}` : ""}</option>)}
              </select>
              {pickups.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Aucun point configuré, contactez le support.</p>
              )}
            </div>
          )}
        </section>

        <div className="mt-6 rounded-2xl border bg-primary/5 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total à payer</span>
            <span className="text-2xl font-extrabold text-primary">{FCFA(total)}</span>
          </div>
          <Button
            className="mt-4 w-full" size="lg"
            onClick={handleSubmit}
            disabled={submitting || !canPay}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continuer vers le paiement
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Paiement Airtel Money / Moov Money via MyPVit
          </p>
        </div>
      </div>
    </main>
  );
}
