import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Bell, Eye, ImagePlus, Loader2, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "Notifications - Admin" }] }),
  component: AdminNotifications,
});

type Category = "information" | "promotion" | "alerte" | "evenement" | "mise_a_jour";
type Broadcast = { id: string; title: string; message: string; category: Category; image_url: string | null; created_at: string; sent_at: string; status: string };

const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: "information", label: "Information" },
  { value: "promotion", label: "Promotion" },
  { value: "alerte", label: "Alerte" },
  { value: "evenement", label: "Événement" },
  { value: "mise_a_jour", label: "Mise à jour" },
];

const categoryLabel = (category: Category) => CATEGORIES.find((item) => item.value === category)?.label ?? category;
const formatDate = (value: string) => new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function AdminNotifications() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Category>("information");
  const [imageUrl, setImageUrl] = useState("");
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("broadcast_notifications")
      .select("id,title,message,category,image_url,created_at,sent_at,status")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      const missingTable = /broadcast_notifications|schema cache|relation|404/i.test(error.message);
      setSchemaUnavailable(missingTable);
      toast.error(missingTable ? "Le module Notifications n'est pas encore installé dans Supabase." : `Impossible de charger l'historique : ${error.message}`);
    } else {
      setSchemaUnavailable(false);
      setHistory((data ?? []) as Broadcast[]);
    }
    setLoading(false);
  };

  useEffect(() => { void loadHistory(); }, []);

  const send = async () => {
    if (schemaUnavailable) {
      toast.error("Appliquez d'abord la migration Supabase des notifications.");
      return;
    }
    if (!title.trim() || !message.trim()) {
      toast.error("Le titre et le message sont obligatoires.");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.rpc("send_broadcast_notification", {
      _title: title,
      _message: message,
      _category: category,
      _image_url: imageUrl || null,
    });
    setSending(false);
    if (error) {
      toast.error(`Envoi impossible : ${error.message}`);
      return;
    }
    toast.success("Notification envoyée à tous les utilisateurs éligibles.");
    setTitle("");
    setMessage("");
    setImageUrl("");
    setCategory("information");
    setHistory((current) => [data as Broadcast, ...current]);
  };

  const remove = async (item: Broadcast) => {
    if (!window.confirm(`Supprimer la notification « ${item.title} » ?`)) return;
    const { error } = await supabase.from("broadcast_notifications").delete().eq("id", item.id);
    if (error) toast.error(`Suppression impossible : ${error.message}`);
    else { setHistory((current) => current.filter((entry) => entry.id !== item.id)); toast.success("Notification supprimée."); }
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bell className="h-5 w-5" /></div>
          <div><h1 className="text-2xl font-bold">Notifications</h1><p className="text-sm text-muted-foreground">Informez les utilisateurs, hors chauffeurs.</p></div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
        <Card>
          <CardHeader><CardTitle>Nouvelle notification</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><label htmlFor="notification-title" className="mb-1.5 block text-sm font-medium">Titre <span className="text-destructive">*</span></label><Input id="notification-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex. Nouvelle offre disponible" maxLength={120} /></div>
            <div><label htmlFor="notification-message" className="mb-1.5 block text-sm font-medium">Message <span className="text-destructive">*</span></label><Textarea id="notification-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Votre message..." rows={5} maxLength={1000} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="notification-category" className="mb-1.5 block text-sm font-medium">Catégorie</label><select id="notification-category" value={category} onChange={(event) => setCategory(event.target.value as Category)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div><label htmlFor="notification-image" className="mb-1.5 block text-sm font-medium">Image (URL facultative)</label><div className="relative"><ImagePlus className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="notification-image" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." className="pl-9" type="url" /></div></div>
            </div>
            <Button onClick={send} disabled={schemaUnavailable || sending || !title.trim() || !message.trim()} className="w-full sm:w-auto"><Send className="mr-2 h-4 w-4" />{sending ? "Envoi en cours..." : "Envoyer à tous les utilisateurs éligibles"}</Button>
            {schemaUnavailable && <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>La migration <code>20260914120000_admin_broadcast_notifications.sql</code> doit être appliquée dans Supabase pour activer l'envoi et l'historique.</p></div>}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-4 w-4" /> Aperçu</CardTitle></CardHeader>
          <CardContent><div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {imageUrl && <img src={imageUrl} alt="" className="max-h-48 w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
            <div className="space-y-2 p-4"><div className="flex items-center justify-between gap-2"><Badge variant="secondary">{categoryLabel(category)}</Badge><span className="text-xs text-muted-foreground">À l'instant</span></div><h2 className="font-bold">{title || "Titre de la notification"}</h2><p className="whitespace-pre-wrap text-sm text-muted-foreground">{message || "Le message apparaîtra ici."}</p></div>
          </div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Historique des envois</CardTitle></CardHeader>
        <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-4">Date</th><th className="p-4">Titre</th><th className="p-4">Catégorie</th><th className="p-4">Statut</th><th className="p-4 text-right">Action</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : history.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Aucune notification envoyée.</td></tr> : history.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="whitespace-nowrap p-4 text-muted-foreground">{formatDate(item.sent_at || item.created_at)}</td><td className="max-w-[20rem] p-4 font-medium">{item.title}</td><td className="p-4"><Badge variant="outline">{categoryLabel(item.category)}</Badge></td><td className="p-4"><Badge variant={item.status === "sent" ? "secondary" : "destructive"}>{item.status === "sent" ? "Envoyée" : "Échec"}</Badge></td><td className="p-4 text-right"><Button variant="ghost" size="icon" aria-label={`Supprimer ${item.title}`} onClick={() => void remove(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td></tr>)}
        </tbody></table></div></CardContent>
      </Card>
    </div>
  );
}