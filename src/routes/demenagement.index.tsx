import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Truck, MapPin, Loader2, CheckCircle2, Camera, X, Crosshair,
  ArrowRight, Package, Building2, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ClientNav } from "@/components/ClientNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  FLOORS, FURNITURE_ITEMS, HEAVY_ITEMS, HOUSING_TYPES, MAX_MOVING_PHOTOS,
  MOVERS_OPTIONS, MOVING_STATUS_LABELS, PACKING_OPTIONS, SERVICE_TYPES, VOLUMES,
  fetchMyMovingRequests, movingStatusClass,
  type FloorLevel, type HousingType, type MovingRequest, type MovingServiceType,
  type MovingVolume, type PackingType,
} from "@/lib/moving";
import truck3d from "@/assets/icons/demenagement-3d.png";

export const Route = createFileRoute("/demenagement/")({
  head: () => ({
    meta: [
      { title: "Réserver un déménagement — Wina Tour" },
      { name: "description", content: "Louez un camion ou un service complet de déménagement à Libreville. Obtenez rapidement un devis personnalisé." },
      { property: "og:title", content: "Réserver un déménagement — Wina Tour" },
      { property: "og:description", content: "Camion seul, déménagement classique ou complet : demandez votre devis personnalisé." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MovingPage,
});

type Choice<T> = { value: T; label: string };

function Section({ icon: Icon, title, children }: { icon: typeof Truck; title: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      className="rounded-3xl border bg-card p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </motion.section>
  );
}

function Pills<T extends string | number>({
  options, value, onChange, ariaLabel,
}: { options: Choice<T>[]; value: T; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
            value === o.value
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MovingPage() {
  const navigate = useNavigate();
  const { user, isLoading, isAuthenticated } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [fromAddress, setFromAddress] = useState("");
  const [fromQuartier, setFromQuartier] = useState("");
  const [fromCommune, setFromCommune] = useState("");
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [toAddress, setToAddress] = useState("");
  const [toQuartier, setToQuartier] = useState("");
  const [toCommune, setToCommune] = useState("");
  const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const [housing, setHousing] = useState<HousingType>("APPARTEMENT");
  const [service, setService] = useState<MovingServiceType>("CLASSIQUE");
  const [volume, setVolume] = useState<MovingVolume>("MOYEN");
  const [fromFloor, setFromFloor] = useState<FloorLevel>("RDC");
  const [toFloor, setToFloor] = useState<FloorLevel>("RDC");
  const [fromElevator, setFromElevator] = useState(false);
  const [toElevator, setToElevator] = useState(false);
  const [movers, setMovers] = useState(0);
  const [acDismount, setAcDismount] = useState(false);
  const [acUnits, setAcUnits] = useState(1);
  const [furniture, setFurniture] = useState<string[]>([]);
  const [reassembly, setReassembly] = useState(false);
  const [packing, setPacking] = useState<PackingType>("AUCUN");
  const [heavy, setHeavy] = useState<string[]>([]);
  const [boxes, setBoxes] = useState(0);
  const [comment, setComment] = useState("");

  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [sent, setSent] = useState(false);
  const [myRequests, setMyRequests] = useState<MovingRequest[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/connexion" });
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata as Record<string, string> | undefined;
    setFullName((v) => v || meta?.full_name || "");
    setPhone((v) => v || meta?.phone || "");
    setEmail((v) => v || user.email || "");
    fetchMyMovingRequests(user.id).then(setMyRequests).catch(() => {});
  }, [user]);

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  const toggle = (list: string[], setList: (v: string[]) => void, item: string) =>
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);

  const locate = (setter: (c: { lat: number; lng: number }) => void) => {
    if (!navigator.geolocation) {
      toast.error("Géolocalisation indisponible sur cet appareil.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Position enregistrée.");
      },
      () => toast.error("Impossible de récupérer votre position."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (incoming.length === 0) {
      toast.error("Sélectionnez uniquement des fichiers image.");
      return;
    }
    const room = MAX_MOVING_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_MOVING_PHOTOS} photos.`);
      return;
    }
    const selected = incoming.slice(0, room);
    setPhotos([...photos, ...selected]);
    if (selected.length < incoming.length) {
      toast.message(`Vous pouvez ajouter jusqu'à ${MAX_MOVING_PHOTOS} photos au total.`);
    }
  };

  const validate = (): string | null => {
    if (!fullName.trim()) return "Le nom complet est obligatoire.";
    if (!phone.trim()) return "Le téléphone est obligatoire.";
    if (!fromAddress.trim()) return "L'adresse de départ est obligatoire.";
    if (!toAddress.trim()) return "L'adresse d'arrivée est obligatoire.";
    if (!date) return "La date souhaitée est obligatoire.";
    if (acDismount && acUnits < 1) return "Indiquez le nombre de climatiseurs.";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const err = validate();
    if (err) { toast.error(err); return; }

    setSubmitting(true);
    setUploadingPhotos(photos.length > 0);
    try {
      const db = supabase as unknown as { from: (t: string) => any };
      const { data: inserted, error } = await db.from("moving_requests").insert({
        user_id: user.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        from_address: fromAddress.trim(),
        from_quartier: fromQuartier.trim() || null,
        from_commune: fromCommune.trim() || null,
        from_lat: fromCoords?.lat ?? null,
        from_lng: fromCoords?.lng ?? null,
        to_address: toAddress.trim(),
        to_quartier: toQuartier.trim() || null,
        to_commune: toCommune.trim() || null,
        to_lat: toCoords?.lat ?? null,
        to_lng: toCoords?.lng ?? null,
        desired_date: date,
        desired_time: time || null,
        housing_type: housing,
        service_type: service,
        volume,
        from_floor: fromFloor,
        to_floor: toFloor,
        from_elevator: fromElevator,
        to_elevator: toElevator,
        movers_count: movers,
        ac_dismount: acDismount,
        ac_units: acDismount ? acUnits : 0,
        reassembly,
        packing,
        boxes_count: boxes,
        comment: comment.trim() || null,
      }).select("id").single();
      if (error) throw error;

      const requestId = (inserted as { id: string }).id;

      const items = [
        ...furniture.map((label) => ({ request_id: requestId, kind: "MEUBLE", label })),
        ...heavy.map((label) => ({ request_id: requestId, kind: "LOURD", label })),
      ];
      if (items.length) await db.from("moving_request_items").insert(items);

      for (const file of photos) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${user.id}/${requestId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("moving-photos").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });
        if (!upErr) {
          await db.from("moving_request_photos").insert({ request_id: requestId, storage_path: path });
        } else {
          console.error("[moving photo upload]", upErr);
        }
      }

      setSent(true);
      toast.success("Votre demande de déménagement a été transmise.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      fetchMyMovingRequests(user.id).then(setMyRequests).catch(() => {});
    } catch (e) {
      console.error(e);
      toast.error("Envoi impossible. Vérifiez les champs et réessayez.");
    } finally {
      setSubmitting(false);
      setUploadingPhotos(false);
    }
  };

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (sent) {
    return (
      <div className="pb-24">
        <div className="mx-auto max-w-lg px-5 pt-16 text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-green-500/10 text-green-600">
            <CheckCircle2 className="h-10 w-10" />
          </motion.div>
          <h1 className="mt-5 text-2xl font-bold">Votre demande de déménagement a été transmise.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Notre équipe étudiera votre dossier et vous enverra un devis personnalisé.
          </p>
          <div className="mt-8 space-y-2">
            {myRequests[0] && (
              <Button asChild className="w-full rounded-xl">
                <Link to="/demenagement/$id" params={{ id: myRequests[0].id }}>Suivre ma demande</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="w-full rounded-xl">
              <Link to="/espace-client">Retour à l'accueil</Link>
            </Button>
          </div>
        </div>
        <ClientNav />
      </div>
    );
  }

  return (
    <div className="pb-24">
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-accent/10 to-transparent px-5 pb-8 pt-10">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <img src={truck3d} alt="Illustration 3D de camion de déménagement" className="h-20 w-20 object-contain drop-shadow-lg"
            loading="lazy" width={512} height={512} />
          <div>
            <h1 className="text-2xl font-bold">Réserver un déménagement</h1>
            <p className="mt-1 text-sm text-muted-foreground">Obtenez rapidement un devis personnalisé.</p>
          </div>
        </div>
      </section>

      {myRequests.length > 0 && (
        <div className="mx-auto mt-6 max-w-3xl px-5">
          <h2 className="mb-2 text-sm font-bold text-muted-foreground">Mes demandes</h2>
          <div className="space-y-2">
            {myRequests.slice(0, 3).map((r) => (
              <Link key={r.id} to="/demenagement/$id" params={{ id: r.id }}
                className="flex items-center justify-between rounded-2xl border bg-card p-3 transition-shadow hover:shadow-md">
                <div>
                  <div className="text-sm font-semibold">{r.reference_code}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.desired_date).toLocaleDateString("fr-FR")} · {r.from_address}
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${movingStatusClass(r.status)}`}>
                  {MOVING_STATUS_LABELS[r.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="mx-auto mt-6 max-w-3xl space-y-4 px-5">
        <Section icon={Truck} title="Informations personnelles">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fullName">Nom complet *</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="phone">Téléphone *</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required className="mt-1.5" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="email">Email (facultatif)</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
            </div>
          </div>
        </Section>

        <Section icon={MapPin} title="Adresse de départ">
          <Input placeholder="Adresse complète *" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Quartier" value={fromQuartier} onChange={(e) => setFromQuartier(e.target.value)} />
            <Input placeholder="Commune" value={fromCommune} onChange={(e) => setFromCommune(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => locate(setFromCoords)}>
              <Crosshair className="mr-2 h-4 w-4" /> Utiliser ma position
            </Button>
            <a className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fromAddress || "Libreville")}`}
              target="_blank" rel="noopener noreferrer">Localiser sur Google Maps</a>
            {fromCoords && (
              <span className="text-xs text-green-600">
                ✓ {fromCoords.lat.toFixed(5)}, {fromCoords.lng.toFixed(5)}
              </span>
            )}
          </div>
        </Section>

        <Section icon={MapPin} title="Adresse d'arrivée">
          <Input placeholder="Adresse complète *" value={toAddress} onChange={(e) => setToAddress(e.target.value)} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Quartier" value={toQuartier} onChange={(e) => setToQuartier(e.target.value)} />
            <Input placeholder="Commune" value={toCommune} onChange={(e) => setToCommune(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => locate(setToCoords)}>
              <Crosshair className="mr-2 h-4 w-4" /> Utiliser ma position
            </Button>
            <a className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(toAddress || "Libreville")}`}
              target="_blank" rel="noopener noreferrer">Localiser sur Google Maps</a>
            {toCoords && (
              <span className="text-xs text-green-600">
                ✓ {toCoords.lat.toFixed(5)}, {toCoords.lng.toFixed(5)}
              </span>
            )}
          </div>
        </Section>

        <Section icon={CalendarDays} title="Date">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="date">Date souhaitée *</Label>
              <Input id="date" type="date" value={date} min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="time">Heure souhaitée</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1.5" />
            </div>
          </div>
        </Section>

        <Section icon={Building2} title="Type de logement">
          <Pills ariaLabel="Type de logement" options={HOUSING_TYPES} value={housing} onChange={setHousing} />
        </Section>

        <Section icon={Truck} title="Type de prestation">
          <div className="grid gap-3">
            {SERVICE_TYPES.map((s) => (
              <button key={s.value} type="button" onClick={() => setService(s.value)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  service === s.value ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"
                }`}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    service === s.value ? "border-primary" : "border-muted-foreground/40"}`}>
                    {service === s.value && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  <span className="text-sm font-semibold">{s.label}</span>
                </div>
                {service === s.value && (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    className="mt-2 pl-6 text-xs text-muted-foreground">{s.desc}</motion.p>
                )}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={Package} title="Volume approximatif">
          <Pills ariaLabel="Volume" options={VOLUMES} value={volume} onChange={setVolume} />
        </Section>

        <Section icon={Building2} title="Nombre d'étages">
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Départ</Label>
              <div className="mt-2">
                <Pills ariaLabel="Étage départ" options={FLOORS.map((f) => ({ value: f, label: f }))} value={fromFloor} onChange={setFromFloor} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Arrivée</Label>
              <div className="mt-2">
                <Pills ariaLabel="Étage arrivée" options={FLOORS.map((f) => ({ value: f, label: f }))} value={toFloor} onChange={setToFloor} />
              </div>
            </div>
          </div>
        </Section>

        <Section icon={Building2} title="Ascenseur">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Départ</Label>
              <div className="mt-2">
                <Pills ariaLabel="Ascenseur départ" value={fromElevator ? "oui" : "non"}
                  onChange={(v) => setFromElevator(v === "oui")}
                  options={[{ value: "oui", label: "Oui" }, { value: "non", label: "Non" }]} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Arrivée</Label>
              <div className="mt-2">
                <Pills ariaLabel="Ascenseur arrivée" value={toElevator ? "oui" : "non"}
                  onChange={(v) => setToElevator(v === "oui")}
                  options={[{ value: "oui", label: "Oui" }, { value: "non", label: "Non" }]} />
              </div>
            </div>
          </div>
        </Section>

        <Section icon={Truck} title="Besoin de déménageurs">
          <Pills ariaLabel="Déménageurs" options={MOVERS_OPTIONS} value={movers} onChange={setMovers} />
        </Section>

        <Section icon={Package} title="Démontage de climatisation">
          <Pills ariaLabel="Démontage climatisation" value={acDismount ? "oui" : "non"}
            onChange={(v) => setAcDismount(v === "oui")}
            options={[{ value: "oui", label: "Oui" }, { value: "non", label: "Non" }]} />
          {acDismount && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              <Label htmlFor="acUnits">Nombre de climatiseurs</Label>
              <Input id="acUnits" type="number" min={1} value={acUnits}
                onChange={(e) => setAcUnits(Math.max(1, Number(e.target.value) || 1))} className="mt-1.5 max-w-[160px]" />
            </motion.div>
          )}
        </Section>

        <Section icon={Package} title="Démontage de meubles">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FURNITURE_ITEMS.map((item) => (
              <label key={item} className="flex items-center gap-2 rounded-xl border bg-background p-2.5 text-sm">
                <Checkbox checked={furniture.includes(item)} onCheckedChange={() => toggle(furniture, setFurniture, item)} />
                {item}
              </label>
            ))}
          </div>
        </Section>

        <Section icon={Package} title="Remontage à destination">
          <Pills ariaLabel="Remontage" value={reassembly ? "oui" : "non"}
            onChange={(v) => setReassembly(v === "oui")}
            options={[{ value: "oui", label: "Oui" }, { value: "non", label: "Non" }]} />
        </Section>

        <Section icon={Package} title="Emballage">
          <Pills ariaLabel="Emballage" options={PACKING_OPTIONS} value={packing} onChange={setPacking} />
        </Section>

        <Section icon={Package} title="Objets lourds">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {HEAVY_ITEMS.map((item) => (
              <label key={item} className="flex items-center gap-2 rounded-xl border bg-background p-2.5 text-sm">
                <Checkbox checked={heavy.includes(item)} onCheckedChange={() => toggle(heavy, setHeavy, item)} />
                {item}
              </label>
            ))}
          </div>
          <div>
            <Label htmlFor="boxes">Nombre approximatif de cartons</Label>
            <Input id="boxes" type="number" min={0} value={boxes}
              onChange={(e) => setBoxes(Math.max(0, Number(e.target.value) || 0))} className="mt-1.5 max-w-[160px]" />
          </div>
        </Section>

        <Section icon={Camera} title={`Photos (max ${MAX_MOVING_PHOTOS})`}>
          <p className="text-xs text-muted-foreground">
            Autorisez jusqu&apos;à {MAX_MOVING_PHOTOS} photos HD. Le client peut photographier les meubles, cartons, électroménagers et objets fragiles pour un devis plus précis.
          </p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-sm font-semibold text-primary">
            <Camera className="h-4 w-4" /> Ajouter des photos
            <input type="file" accept="image/*" multiple capture="environment" className="hidden"
              onChange={(e) => { addPhotos(e.target.files); e.currentTarget.value = ""; }} />
          </label>
          {uploadingPhotos && (
            <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" /> Téléchargement des photos en cours…
            </div>
          )}
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {previews.map((src, i) => (
                <div key={src} className="relative aspect-square overflow-hidden rounded-xl border">
                  <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                  <button type="button" aria-label="Supprimer la photo"
                    onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/70 text-background">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section icon={Package} title="Commentaires">
          <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Précisions utiles pour notre équipe…" />
        </Section>

        <Section icon={Package} title="Calcul du devis">
          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Aucun prix automatique ne sera affiché.</p>
            <p className="mt-1">Après validation, une demande de devis sera créée et notre équipe vous répondra avec un devis personnalisé.</p>
          </div>
        </Section>

        <Button type="submit" disabled={submitting} className="h-12 w-full rounded-2xl text-base font-bold">
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <>Créer une demande de devis <ArrowRight className="ml-2 h-4 w-4" /></>
          )}
        </Button>
      </form>

      <ClientNav />
    </div>
  );
}
