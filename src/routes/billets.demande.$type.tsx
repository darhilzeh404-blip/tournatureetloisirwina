import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Send, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PartnerAgenciesShowcase } from "@/components/PartnerAgenciesShowcase";
import { isManagedTicketType, TICKET_TYPE_META } from "@/lib/ticket-quotes";

export const Route = createFileRoute("/billets/demande/$type")({ component: ManagedTicketRequest });

function ManagedTicketRequest() {
  const { type } = Route.useParams();
  const navigate = useNavigate();
  const ticketType = isManagedTicketType(type) ? type : null;
  const meta = ticketType ? TICKET_TYPE_META[ticketType] : null;
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ origin: "", destination: "", tripType: "one_way", departureDate: "", returnDate: "", adults: 1, children: 0, contactName: "", contactPhone: "", contactEmail: "", preference: "", note: "" });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: profile } = await (supabase.from("profiles") as any).select("full_name,phone").eq("id", data.user.id).maybeSingle();
      setForm((old) => ({ ...old, contactName: (profile as any)?.full_name ?? "", contactPhone: (profile as any)?.phone ?? "", contactEmail: data.user?.email ?? "" }));
    })();
  }, []);

  if (!ticketType || !meta) return <main className="p-8">Type de billet invalide.</main>;
  const update = (field: string, value: string | number) => setForm((old) => ({ ...old, [field]: value }));
  const submit = async () => {
    if (!form.origin.trim() || !form.destination.trim() || !form.departureDate || !form.contactName.trim() || !form.contactPhone.trim()) {
      toast.error("Départ, arrivée, date, nom et téléphone sont requis."); return;
    }
    if (form.tripType === "round_trip" && !form.returnDate) { toast.error("Indiquez la date de retour."); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { toast.error("Connectez-vous pour envoyer la demande."); navigate({ to: "/connexion" }); return; }
    setSending(true);
    const { data, error } = await (supabase as any).from("ticket_quote_requests").insert({
      user_id: auth.user.id, ticket_type: ticketType, contact_name: form.contactName.trim(), contact_phone: form.contactPhone.trim(), contact_email: form.contactEmail.trim() || null,
      origin: form.origin.trim(), destination: form.destination.trim(), trip_type: form.tripType, departure_date: form.departureDate,
      return_date: form.tripType === "round_trip" ? form.returnDate : null,
      passengers: [{ type: "adult", count: Number(form.adults) }, { type: "child", count: Number(form.children) }],
      form_data: { preference: form.preference.trim() || null }, client_note: form.note.trim() || null,
    }).select("id").single();
    setSending(false);
    if (error) { console.error("[ticket request]", error); toast.error(error.message.includes("ticket_quote_requests") ? "La billetterie n’est pas encore activée dans la base de données." : error.message); return; }
    toast.success("Demande envoyée. Un conseiller vous proposera un billet.");
    navigate({ to: "/demandes-billets/$requestId", params: { requestId: (data as any).id } });
  };

  return <main className="min-h-screen bg-background"><div className="mx-auto max-w-3xl px-5 py-8">
    <div className="flex justify-between gap-3"><Link to="/billets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Billetterie</Link><Link to="/demandes-billets" className="text-sm font-semibold text-primary">Mes demandes</Link></div>
    <header className="mt-6 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Ticket className="h-6 w-6" /></div><div><h1 className="text-2xl font-bold">Demande de {meta.label}</h1><p className="text-sm text-muted-foreground">Envoyez votre besoin, puis validez l’offre avant tout paiement.</p></div></header>
    <PartnerAgenciesShowcase category={ticketType === "flight" ? "avion" : ticketType === "boat" ? "bateau" : "train"} />
    <section className="mt-6 rounded-3xl border bg-card p-5 shadow-sm"><div className="grid gap-3 sm:grid-cols-2"><div><Label>Départ</Label><Input placeholder="Libreville" value={form.origin} onChange={(e) => update("origin", e.target.value)} /></div><div><Label>Arrivée</Label><Input placeholder="Ville ou gare d’arrivée" value={form.destination} onChange={(e) => update("destination", e.target.value)} /></div></div>
      <div className="mt-3 grid grid-cols-2 gap-2">{(["one_way", "round_trip"] as const).map((v) => <button type="button" key={v} onClick={() => update("tripType", v)} className={`rounded-xl border p-3 text-sm font-semibold ${form.tripType === v ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{v === "one_way" ? "Aller simple" : "Aller-retour"}</button>)}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><Label>Date de départ</Label><Input type="date" value={form.departureDate} onChange={(e) => update("departureDate", e.target.value)} /></div>{form.tripType === "round_trip" && <div><Label>Date de retour</Label><Input type="date" value={form.returnDate} onChange={(e) => update("returnDate", e.target.value)} /></div>}</div>
      <div className="mt-3 grid grid-cols-2 gap-3"><div><Label>Adultes</Label><Input type="number" min="1" value={form.adults} onChange={(e) => update("adults", Math.max(1, Number(e.target.value)))} /></div><div><Label>Enfants</Label><Input type="number" min="0" value={form.children} onChange={(e) => update("children", Math.max(0, Number(e.target.value)))} /></div></div>
      <div className="mt-3"><Label>Préférence (optionnel)</Label><Input placeholder={ticketType === "flight" ? "Classe, compagnie, bagages…" : "Classe, cabine, horaire…"} value={form.preference} onChange={(e) => update("preference", e.target.value)} /></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><div><Label>Nom complet</Label><Input value={form.contactName} onChange={(e) => update("contactName", e.target.value)} /></div><div><Label>Téléphone</Label><Input value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} /></div></div><div className="mt-3"><Label>Email (optionnel)</Label><Input type="email" value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} /></div><div className="mt-3"><Label>Précisions (optionnel)</Label><Textarea value={form.note} onChange={(e) => update("note", e.target.value)} /></div>
      <Button className="mt-5 w-full" onClick={submit} disabled={sending}>{sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Envoyer ma demande</Button><p className="mt-3 text-center text-xs text-muted-foreground">Aucun débit n’est lancé avant votre validation de l’offre.</p>
    </section>
  </div></main>;
}
