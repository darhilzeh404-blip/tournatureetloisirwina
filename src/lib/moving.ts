import { supabase } from "@/integrations/supabase/client";

export type HousingType =
  | "CHAMBRE" | "STUDIO" | "APPARTEMENT" | "MAISON"
  | "VILLA" | "BUREAU" | "COMMERCE" | "ENTREPOT";

export type MovingServiceType = "CAMION_SEUL" | "CLASSIQUE" | "COMPLET";
export type MovingVolume = "PETIT" | "MOYEN" | "GRAND" | "TRES_GRAND";
export type FloorLevel = "RDC" | "1" | "2" | "3" | "4" | "5+";
export type PackingType = "AUCUN" | "PARTIEL" | "COMPLET";

export type MovingStatus =
  | "NOUVELLE" | "ANALYSE" | "DEVIS_ENVOYE" | "ACCEPTE"
  | "REFUSE" | "MODIFICATION_DEMANDEE" | "EN_COURS" | "TERMINE" | "ANNULE";

export type QuoteStatus = "ENVOYE" | "ACCEPTE" | "REFUSE" | "MODIFICATION_DEMANDEE" | "ANNULE";

export const HOUSING_TYPES: { value: HousingType; label: string }[] = [
  { value: "CHAMBRE", label: "Chambre" },
  { value: "STUDIO", label: "Studio" },
  { value: "APPARTEMENT", label: "Appartement" },
  { value: "MAISON", label: "Maison" },
  { value: "VILLA", label: "Villa" },
  { value: "BUREAU", label: "Bureau" },
  { value: "COMMERCE", label: "Commerce" },
  { value: "ENTREPOT", label: "Entrepôt" },
];

export const SERVICE_TYPES: { value: MovingServiceType; label: string; desc: string }[] = [
  { value: "CAMION_SEUL", label: "Location de camion uniquement", desc: "Vous chargez, nous transportons." },
  { value: "CLASSIQUE", label: "Déménagement classique", desc: "Transport avec l'aide de nos déménageurs." },
  {
    value: "COMPLET",
    label: "Déménagement complet",
    desc: "Comprend : emballage, démontage, remontage, transport et installation.",
  },
];

export const VOLUMES: { value: MovingVolume; label: string }[] = [
  { value: "PETIT", label: "Petit" },
  { value: "MOYEN", label: "Moyen" },
  { value: "GRAND", label: "Grand" },
  { value: "TRES_GRAND", label: "Très grand" },
];

export const FLOORS: FloorLevel[] = ["RDC", "1", "2", "3", "4", "5+"];

export const MOVERS_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Aucun" },
  { value: 2, label: "2 déménageurs" },
  { value: 4, label: "4 déménageurs" },
  { value: 6, label: "6 déménageurs" },
  { value: 8, label: "8 déménageurs" },
];

export const PACKING_OPTIONS: { value: PackingType; label: string }[] = [
  { value: "AUCUN", label: "Aucun" },
  { value: "PARTIEL", label: "Emballage partiel" },
  { value: "COMPLET", label: "Emballage complet" },
];

export const FURNITURE_ITEMS = [
  "Lit", "Armoire", "Dressing", "Bureau", "Table", "Cuisine", "Meuble TV", "Autres",
];

export const HEAVY_ITEMS = [
  "Coffre-fort", "Piano", "Réfrigérateur américain", "Groupe électrogène",
  "Billard", "Machine industrielle", "Autres",
];

export const MOVING_STATUS_LABELS: Record<MovingStatus, string> = {
  NOUVELLE: "Nouvelle demande",
  ANALYSE: "Analyse",
  DEVIS_ENVOYE: "Devis envoyé",
  ACCEPTE: "Accepté",
  REFUSE: "Refusé",
  MODIFICATION_DEMANDEE: "Modification demandée",
  EN_COURS: "En cours",
  TERMINE: "Terminé",
  ANNULE: "Annulé",
};

/** Statuts modifiables par l'administrateur. */
export const ADMIN_STATUSES: MovingStatus[] = [
  "NOUVELLE", "ANALYSE", "DEVIS_ENVOYE", "ACCEPTE", "REFUSE",
  "MODIFICATION_DEMANDEE", "EN_COURS", "TERMINE", "ANNULE",
];

export function movingStatusClass(status: MovingStatus): string {
  switch (status) {
    case "NOUVELLE": return "bg-primary/10 text-primary";
    case "ANALYSE": return "bg-accent/20 text-accent-foreground";
    case "DEVIS_ENVOYE": return "bg-amber-500/15 text-amber-600";
    case "ACCEPTE": return "bg-green-500/15 text-green-600";
    case "EN_COURS": return "bg-blue-500/15 text-blue-600";
    case "TERMINE": return "bg-green-600/15 text-green-700";
    case "REFUSE":
    case "ANNULE": return "bg-destructive/10 text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
}

export const MAX_MOVING_PHOTOS = 15;

export interface MovingRequest {
  id: string;
  user_id: string;
  reference_code: string;
  full_name: string;
  phone: string;
  email: string | null;
  from_address: string;
  from_quartier: string | null;
  from_commune: string | null;
  from_lat: number | null;
  from_lng: number | null;
  to_address: string;
  to_quartier: string | null;
  to_commune: string | null;
  to_lat: number | null;
  to_lng: number | null;
  desired_date: string;
  desired_time: string | null;
  housing_type: HousingType;
  service_type: MovingServiceType;
  volume: MovingVolume;
  from_floor: FloorLevel;
  to_floor: FloorLevel;
  from_elevator: boolean;
  to_elevator: boolean;
  movers_count: number;
  ac_dismount: boolean;
  ac_units: number;
  reassembly: boolean;
  packing: PackingType;
  boxes_count: number;
  comment: string | null;
  status: MovingStatus;
  paid: boolean;
  paid_amount: number;
  paid_at: string | null;
  created_at: string;
}

export interface MovingItem {
  id: string;
  request_id: string;
  kind: "MEUBLE" | "LOURD";
  label: string;
  quantity: number;
}

export interface MovingPhoto {
  id: string;
  request_id: string;
  storage_path: string;
}

export interface MovingQuote {
  id: string;
  request_id: string;
  price: number;
  details: string | null;
  conditions: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  admin_note: string | null;
  status: QuoteStatus;
  client_message: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface MovingHistoryEntry {
  id: string;
  request_id: string;
  status: string;
  note: string | null;
  created_at: string;
}

const db = supabase as unknown as {
  from: (t: string) => any;
  rpc: (n: string, p?: unknown) => Promise<{ data: unknown; error: unknown }>;
};

export async function fetchMyMovingRequests(userId: string): Promise<MovingRequest[]> {
  const { data } = await db.from("moving_requests").select("*")
    .eq("user_id", userId).order("created_at", { ascending: false });
  return (data ?? []) as MovingRequest[];
}

export async function fetchAllMovingRequests(): Promise<MovingRequest[]> {
  const { data } = await db.from("moving_requests").select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as MovingRequest[];
}

export async function fetchMovingRequest(id: string): Promise<MovingRequest | null> {
  const { data } = await db.from("moving_requests").select("*").eq("id", id).maybeSingle();
  return (data ?? null) as MovingRequest | null;
}

export async function fetchMovingItems(requestId: string): Promise<MovingItem[]> {
  const { data } = await db.from("moving_request_items").select("*").eq("request_id", requestId);
  return (data ?? []) as MovingItem[];
}

export async function fetchMovingPhotos(requestId: string): Promise<MovingPhoto[]> {
  const { data } = await db.from("moving_request_photos").select("*").eq("request_id", requestId);
  return (data ?? []) as MovingPhoto[];
}

export async function fetchMovingQuotes(requestId: string): Promise<MovingQuote[]> {
  const { data } = await db.from("moving_quotes").select("*")
    .eq("request_id", requestId).order("created_at", { ascending: false });
  return (data ?? []) as MovingQuote[];
}

export async function fetchMovingHistory(requestId: string): Promise<MovingHistoryEntry[]> {
  const { data } = await db.from("moving_status_history").select("*")
    .eq("request_id", requestId).order("created_at", { ascending: false });
  return (data ?? []) as MovingHistoryEntry[];
}

export async function respondMovingQuote(
  quoteId: string,
  action: "accept" | "refuse" | "modify",
  message?: string,
): Promise<void> {
  const { error } = await db.rpc("respond_moving_quote", {
    _quote_id: quoteId,
    _action: action,
    _message: message ?? null,
  });
  if (error) throw error;
}

/** URL signée (bucket privé) pour afficher une photo de déménagement. */
export async function signedPhotoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("moving-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function googleMapsLink(lat: number | null, lng: number | null, address: string): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export const formatFcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
