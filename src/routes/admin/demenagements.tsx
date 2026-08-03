import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Truck, Phone, MapPin, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_STATUSES, HOUSING_TYPES, MOVING_STATUS_LABELS, SERVICE_TYPES, VOLUMES,
  fetchAllMovingRequests, fetchMovingItems, fetchMovingPhotos, fetchMovingQuotes,
  formatFcfa, movingStatusClass, signedPhotoUrl,
  type MovingItem, type MovingQuote, type MovingRequest, type MovingStatus,
} from "@/lib/moving";

export const Route = createFileRoute("/admin/demenagements")({
  head: () => ({
    meta: [
      { title: "Gestion des déménagements — Admin Wina" },
      { name: "description", content: "Traitez les demandes de déménagement, envoyez les devis et suivez les statuts." },
      { property: "og:title", content: "Gestion des déménagements — Admin Wina" },
      { property: "og:description", content: "Demandes, devis et suivi des déménagements Wina Tour." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminMoving,
});

const label = (list: { value: string; label: string }[], v: string) =>
  list.find((i) => i.value === v)?.label ?? v;

function AdminMoving() {
  const [requests, setRequests] = useState<MovingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MovingRequest | null>(null);
  const [items, setItems] = useState<MovingItem[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<MovingQuote[]>([]);
  const [saving, setSaving] = useState(false);

  const [price, setPrice] = useState("");
  const [details, setDetails] = useState("");
  const [conditions, setConditions] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setRequests(await fetchAllMovingRequests());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = async (r: MovingRequest) => {
    setSelected(r);
    setPrice(""); setDetails(""); setConditions(""); setNote("");
    setSchedDate(r.desired_date); setSchedTime(r.desired_time?.slice(0, 5) ?? "");
    const [it, ph, qs] = await Promise.all([
      fetchMovingItems(r.id), fetchMovingPhotos(r.id), fetchMovingQuotes(r.id),
    ]);
    setItems(it);
    setQuotes(qs);
    const urls = await Promise.all(ph.map((p) => signedPhotoUrl(p.storage_path)));
    setPhotos(urls.filter((u): u is string => Boolean(u)));
  };

  const setStatus = async (r: MovingRequest, status: MovingStatus) => {
    const db = supabase as unknown as { from: (t: string) => any };
    const { error } = await db.from("moving_requests").update({ status }).eq("id", r.id);
    if (error) { toast.error("Mise à jour impossible."); return; }
    toast.success(`Statut : ${MOVING_STATUS_LABELS[status]}`);
    await load();
    setSelected((s) => (s && s.id === r.id ? { ...s, status } : s));
  };

  const sendQuote = async () => {
    if (!selected) return;
    const value = Number(price);
    if (!value || value <= 0) { toast.error("Saisissez un prix valide."); return; }
    setSaving(true);
    try {
      const db = supabase as unknown as { from: (t: string) => any };
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await db.from("moving_quotes").insert({
        request_id: selected.id,
        price: Math.round(value),
        details: details.trim() || null,
        conditions: conditions.trim() || null,
        scheduled_date: schedDate || null,
        scheduled_time: schedTime || null,
        admin_note: note.trim() || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Devis envoyé au client.");
      setPrice(""); setDetails(""); setConditions(""); setNote("");
      await load();
      await open({ ...selected, status: "DEVIS_ENVOYE" });
    } catch {
      toast.error("Envoi du devis impossible.");
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Truck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Gestion des déménagements</h1>
          <p className="text-sm text-muted-foreground">{requests.length} demande(s)</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Numéro</th><th className="p-3">Date</th><th className="p-3">Client</th>
              <th className="p-3">Téléphone</th><th className="p-3">Départ</th><th className="p-3">Arrivée</th>
              <th className="p-3">Prestation</th><th className="p-3">Statut</th><th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-semibold">{r.reference_code}</td>
                <td className="p-3">{new Date(r.desired_date).toLocaleDateString("fr-FR")}</td>
                <td className="p-3">{r.full_name}</td>
                <td className="p-3">{r.phone}</td>
                <td className="max-w-[180px] truncate p-3">{r.from_address}</td>
                <td className="max-w-[180px] truncate p-3">{r.to_address}</td>
                <td className="p-3">{label(SERVICE_TYPES, r.service_type)}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${movingStatusClass(r.status)}`}>
                    {MOVING_STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="p-3">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => open(r)}>Ouvrir</Button>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Aucune demande pour l'instant.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setSelected(null)} role="dialog" aria-modal="true">
          <div onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border bg-card p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">{selected.reference_code}</h2>
                <p className="text-sm text-muted-foreground">{selected.full_name}</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Fermer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary"><Phone className="h-3.5 w-3.5" /> Contact</div>
                <div className="mt-1">{selected.phone}</div>
                {selected.email && <div className="text-xs text-muted-foreground">{selected.email}</div>}
              </div>
              <div className="rounded-2xl border p-3">
                <div className="text-xs font-semibold text-primary">Souhait</div>
                <div className="mt-1">
                  {new Date(selected.desired_date).toLocaleDateString("fr-FR")}
                  {selected.desired_time ? ` à ${selected.desired_time.slice(0, 5)}` : ""}
                </div>
              </div>
              <div className="rounded-2xl border p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary"><MapPin className="h-3.5 w-3.5" /> Départ</div>
                <div className="mt-1">{selected.from_address}</div>
                <div className="text-xs text-muted-foreground">
                  {[selected.from_quartier, selected.from_commune].filter(Boolean).join(" · ")} — Étage {selected.from_floor}
                  {selected.from_elevator ? " (ascenseur)" : ""}
                </div>
              </div>
              <div className="rounded-2xl border p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary"><MapPin className="h-3.5 w-3.5" /> Arrivée</div>
                <div className="mt-1">{selected.to_address}</div>
                <div className="text-xs text-muted-foreground">
                  {[selected.to_quartier, selected.to_commune].filter(Boolean).join(" · ")} — Étage {selected.to_floor}
                  {selected.to_elevator ? " (ascenseur)" : ""}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {[
                label(HOUSING_TYPES, selected.housing_type),
                label(SERVICE_TYPES, selected.service_type),
                `Volume ${label(VOLUMES, selected.volume)}`,
                selected.movers_count > 0 ? `${selected.movers_count} déménageurs` : "Sans déménageurs",
                selected.ac_dismount ? `Climatisation : ${selected.ac_units}` : "Sans climatisation",
                selected.reassembly ? "Remontage inclus" : "Sans remontage",
                `Emballage : ${selected.packing}`,
                `${selected.boxes_count} cartons`,
              ].map((t) => (
                <span key={t} className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">{t}</span>
              ))}
            </div>

            {items.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border p-3 text-sm">
                  <div className="text-xs font-semibold text-primary">Meubles à démonter</div>
                  <div className="mt-1 text-muted-foreground">
                    {items.filter((i) => i.kind === "MEUBLE").map((i) => i.label).join(", ") || "—"}
                  </div>
                </div>
                <div className="rounded-2xl border p-3 text-sm">
                  <div className="text-xs font-semibold text-primary">Objets lourds</div>
                  <div className="mt-1 text-muted-foreground">
                    {items.filter((i) => i.kind === "LOURD").map((i) => i.label).join(", ") || "—"}
                  </div>
                </div>
              </div>
            )}

            {selected.comment && (
              <div className="mt-3 rounded-2xl bg-muted p-3 text-sm">{selected.comment}</div>
            )}

            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {photos.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                    <img src={u} alt="Photo client" loading="lazy" className="aspect-square w-full rounded-xl border object-cover" />
                  </a>
                ))}
              </div>
            )}

            <div className="mt-4">
              <Label className="text-xs text-muted-foreground">Statut</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {ADMIN_STATUSES.map((s) => (
                  <button key={s} type="button" onClick={() => setStatus(selected, s)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected.status === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"
                    }`}>
                    {MOVING_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {quotes.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label className="text-xs text-muted-foreground">Devis envoyés</Label>
                {quotes.map((q) => (
                  <div key={q.id} className="rounded-2xl border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{formatFcfa(q.price)}</span>
                      <span className="text-xs text-muted-foreground">{q.status}</span>
                    </div>
                    {q.client_message && <p className="mt-1 text-xs text-muted-foreground">Client : {q.client_message}</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 space-y-3 rounded-2xl border bg-background p-4">
              <h3 className="text-sm font-bold">Envoyer un devis</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="price">Prix (FCFA)</Label>
                  <Input id="price" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="sdate">Date</Label>
                  <Input id="sdate" type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="stime">Heure</Label>
                  <Input id="stime" type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className="mt-1.5" />
                </div>
              </div>
              <Textarea rows={3} placeholder="Détails de la prestation" value={details} onChange={(e) => setDetails(e.target.value)} />
              <Textarea rows={2} placeholder="Conditions" value={conditions} onChange={(e) => setConditions(e.target.value)} />
              <Textarea rows={2} placeholder="Note pour le client" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button onClick={sendQuote} disabled={saving} className="w-full rounded-xl">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Send className="mr-2 h-4 w-4" /> Envoyer le devis</>)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
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
          .eq("service_type", "DEMENAGEMENT")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const rows = (data as Reservation[]) ?? [];
        setReservations(rows);
        const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
        if (userIds.length > 0) {
          const { data: profileRows } = await supabase
            .from("profiles")
            .select("user_id, full_name, email, phone")
            .in("user_id", userIds);
          const map: Record<string, Profile> = {};
          (profileRows ?? []).forEach((profile) => {
            map[profile.user_id] = profile as Profile;
          });
          setProfiles(map);
        }
      } catch (err) {
        console.error("[admin/demenagements]", err);
        toast.error("Impossible de charger les demandes de déménagement.");
      } finally {
        setLoading(false);
      }
    };
    load();
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
                  return (
                    <tr key={reservation.id} className="rounded-3xl border border-border/80 bg-card">
                      <td className="px-3 py-3 align-top text-sm font-semibold text-foreground">
                        {profile?.full_name || "Client inconnu"}
                        <div className="text-xs text-muted-foreground">{profile?.email || profile?.phone || reservation.user_id}</div>
                      </td>
                      <td className="px-3 py-3 align-top text-sm text-foreground">{reservation.reservation_date}</td>
                      <td className="px-3 py-3 align-top text-sm text-foreground">{formatXAF(reservation.total_amount)}</td>
                      <td className="px-3 py-3 align-top text-sm text-muted-foreground">
                        {details?.pickup_address ? `${details.pickup_address} → ${details.destination_address}` : "—"}
                        {details?.service_level ? ` · ${details.service_level}` : ""}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Badge variant={STATUS_LABEL[reservation.status].variant}>{STATUS_LABEL[reservation.status].label}</Badge>
                      </td>
                      <td className="px-3 py-3 align-top space-x-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={updatingId === reservation.id}
                          onClick={() => updateStatus(reservation.id, "CONFIRMED")}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={updatingId === reservation.id}
                          onClick={() => updateStatus(reservation.id, "REJECTED")}
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
