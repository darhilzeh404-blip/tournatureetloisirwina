import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Package, ShieldCheck, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const EMPTY_PARCEL = {
  origin: "", destination: "", sender_name: "", sender_phone: "",
  recipient_name: "", recipient_phone: "", parcel_nature: "", description: "",
  weight_kg: "", dimensions: "",
};

const EMPTY_FUNERAL = {
  origin: "", destination: "", contact_name: "", contact_phone: "",
  deceased_name: "", transport_type: "", documents: "", comments: "",
};

type Props = { agencyId: string; acceptsParcel?: boolean; acceptsFuneral?: boolean };

export function BusQuoteForms({ agencyId, acceptsParcel, acceptsFuneral }: Props) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState<"parcel" | "funeral" | null>(null);
  const [parcel, setParcel] = useState({ ...EMPTY_PARCEL });
  const [funeral, setFuneral] = useState({ ...EMPTY_FUNERAL });
  const [saving, setSaving] = useState(false);

  if (!acceptsParcel && !acceptsFuneral) return null;

  const requireAuth = () => {
    if (!isAuthenticated || !user) {
      toast.error("Connectez-vous pour envoyer une demande");
      navigate({ to: "/connexion" });
      return false;
    }
    return true;
  };

  const submitParcel = async () => {
    if (!requireAuth()) return;
    for (const [k, label] of [["origin", "Ville de départ"], ["destination", "Destination"],
      ["sender_name", "Nom expéditeur"], ["sender_phone", "Téléphone expéditeur"],
      ["recipient_name", "Nom destinataire"], ["recipient_phone", "Téléphone destinataire"],
      ["parcel_nature", "Nature du colis"]] as const) {
      if (!String((parcel as any)[k]).trim()) return toast.error(`${label} requis`);
    }
    setSaving(true);
    const { error } = await supabase.from("bus_parcel_requests" as any).insert({
      ...parcel, weight_kg: Number(parcel.weight_kg) || 0, agency_id: agencyId, user_id: user!.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Demande de devis envoyée — suivez-la dans « Colis »");
    setParcel({ ...EMPTY_PARCEL });
    setOpen(null);
  };

  const submitFuneral = async () => {
    if (!requireAuth()) return;
    for (const [k, label] of [["origin", "Ville de départ"], ["destination", "Destination"],
      ["contact_name", "Nom du contact"], ["contact_phone", "Téléphone"],
      ["deceased_name", "Nom du défunt"], ["transport_type", "Type de transport"]] as const) {
      if (!String((funeral as any)[k]).trim()) return toast.error(`${label} requis`);
    }
    setSaving(true);
    const { error } = await supabase.from("bus_funeral_requests" as any).insert({
      ...funeral, agency_id: agencyId, user_id: user!.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Demande de devis envoyée — suivez-la dans « Transport funéraire »");
    setFuneral({ ...EMPTY_FUNERAL });
    setOpen(null);
  };

  return (
    <section className="mt-4 space-y-3">
      {acceptsParcel && (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <button type="button" onClick={() => setOpen(open === "parcel" ? null : "parcel")}
            className="flex w-full items-center gap-2 p-4 text-left text-sm font-bold">
            <Package className="h-4 w-4 text-primary" /> Expédition de colis — demander un devis
            <ChevronDown className={`ml-auto h-4 w-4 transition ${open === "parcel" ? "rotate-180" : ""}`} />
          </button>
          {open === "parcel" && (
            <div className="space-y-2 border-t p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Ville de départ *" value={parcel.origin} onChange={(e) => setParcel({ ...parcel, origin: e.target.value })} />
                <Input placeholder="Destination *" value={parcel.destination} onChange={(e) => setParcel({ ...parcel, destination: e.target.value })} />
                <Input placeholder="Nom expéditeur *" value={parcel.sender_name} onChange={(e) => setParcel({ ...parcel, sender_name: e.target.value })} />
                <Input placeholder="Téléphone expéditeur *" value={parcel.sender_phone} onChange={(e) => setParcel({ ...parcel, sender_phone: e.target.value })} />
                <Input placeholder="Nom destinataire *" value={parcel.recipient_name} onChange={(e) => setParcel({ ...parcel, recipient_name: e.target.value })} />
                <Input placeholder="Téléphone destinataire *" value={parcel.recipient_phone} onChange={(e) => setParcel({ ...parcel, recipient_phone: e.target.value })} />
                <Input placeholder="Nature du colis *" value={parcel.parcel_nature} onChange={(e) => setParcel({ ...parcel, parcel_nature: e.target.value })} />
                <Input type="number" min={0} placeholder="Poids (kg)" value={parcel.weight_kg} onChange={(e) => setParcel({ ...parcel, weight_kg: e.target.value })} />
                <Input placeholder="Dimensions (L × l × H)" value={parcel.dimensions} onChange={(e) => setParcel({ ...parcel, dimensions: e.target.value })} />
              </div>
              <Textarea placeholder="Description du colis" value={parcel.description} onChange={(e) => setParcel({ ...parcel, description: e.target.value })} />
              <Button className="w-full" disabled={saving} onClick={() => void submitParcel()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Demander un devis"}
              </Button>
            </div>
          )}
        </div>
      )}

      {acceptsFuneral && (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <button type="button" onClick={() => setOpen(open === "funeral" ? null : "funeral")}
            className="flex w-full items-center gap-2 p-4 text-left text-sm font-bold">
            <ShieldCheck className="h-4 w-4 text-primary" /> Transport funéraire — demander un devis
            <ChevronDown className={`ml-auto h-4 w-4 transition ${open === "funeral" ? "rotate-180" : ""}`} />
          </button>
          {open === "funeral" && (
            <div className="space-y-2 border-t p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Ville de départ *" value={funeral.origin} onChange={(e) => setFuneral({ ...funeral, origin: e.target.value })} />
                <Input placeholder="Destination *" value={funeral.destination} onChange={(e) => setFuneral({ ...funeral, destination: e.target.value })} />
                <Input placeholder="Nom du contact *" value={funeral.contact_name} onChange={(e) => setFuneral({ ...funeral, contact_name: e.target.value })} />
                <Input placeholder="Téléphone du contact *" value={funeral.contact_phone} onChange={(e) => setFuneral({ ...funeral, contact_phone: e.target.value })} />
                <Input placeholder="Nom du défunt *" value={funeral.deceased_name} onChange={(e) => setFuneral({ ...funeral, deceased_name: e.target.value })} />
                <Input placeholder="Type de transport *" value={funeral.transport_type} onChange={(e) => setFuneral({ ...funeral, transport_type: e.target.value })} />
              </div>
              <Textarea placeholder="Documents disponibles (certificat de décès, autorisation…)" value={funeral.documents} onChange={(e) => setFuneral({ ...funeral, documents: e.target.value })} />
              <Textarea placeholder="Commentaires" value={funeral.comments} onChange={(e) => setFuneral({ ...funeral, comments: e.target.value })} />
              <Button className="w-full" disabled={saving} onClick={() => void submitFuneral()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Demander un devis"}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
