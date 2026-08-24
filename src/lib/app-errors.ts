/**
 * Traduction des erreurs techniques (Postgres, Supabase, réseau) en messages
 * humains. Les détails techniques restent dans la console développeur.
 */

const RULES: Array<{ match: RegExp; title: string; description: string }> = [
  {
    match: /ALREADY_TAKEN|already assigned/i,
    title: "Course déjà attribuée",
    description: "Cette course vient d'être acceptée par un autre chauffeur.",
  },
  {
    match: /ALREADY_PROCESSED/i,
    title: "Demande déjà traitée",
    description: "Cette demande a déjà été validée ou refusée.",
  },
  {
    match: /ALREADY_PAID/i,
    title: "Déjà payé",
    description: "Cette réservation a déjà été réglée.",
  },
  {
    match: /INSUFFICIENT_FUNDS|INSUFFICIENT_POINTS/i,
    title: "Solde insuffisant",
    description: "Le montant demandé dépasse votre solde disponible.",
  },
  {
    match: /MIN_AMOUNT/i,
    title: "Montant trop faible",
    description: "Le montant minimum de retrait est de 1 000 FCFA.",
  },
  {
    match: /INVALID_DEPOSIT_NUMBER/i,
    title: "Numéro invalide",
    description: "Vérifiez le numéro de dépôt saisi (au moins 8 chiffres).",
  },
  {
    match: /CATEGORY_MISMATCH/i,
    title: "Course non compatible",
    description: "Cette course ne correspond pas à votre catégorie de véhicule.",
  },
  {
    match: /DRIVER_NOT_AVAILABLE/i,
    title: "Position non à jour",
    description: "Repassez en ligne puis réessayez pour recevoir les courses.",
  },
  {
    match: /NOT_AUTHENTICATED|JWT|session/i,
    title: "Session expirée",
    description: "Reconnectez-vous pour continuer.",
  },
  {
    match: /FORBIDDEN|row-level security|permission denied|not authorized/i,
    title: "Action non autorisée",
    description: "Vous n'avez pas les droits nécessaires pour cette action.",
  },
  {
    match: /duplicate key|unique constraint/i,
    title: "Action déjà enregistrée",
    description: "Cette opération a déjà été effectuée.",
  },
  {
    match: /Failed to fetch|NetworkError|network request failed|timeout|trop lente/i,
    title: "Connexion impossible",
    description: "Vérifiez votre connexion internet puis réessayez.",
  },
];

const FALLBACK = {
  title: "Une erreur est survenue",
  description: "Réessayez dans quelques instants. Si le problème persiste, contactez le support.",
};

export function describeError(err: unknown): { title: string; description: string } {
  const raw =
    typeof err === "string"
      ? err
      : (err as { message?: string; error_description?: string })?.message ??
        (err as { error_description?: string })?.error_description ??
        "";

  if (import.meta.env.DEV) console.error("[app-error]", err);
  else console.warn("[app-error]", raw);

  const rule = RULES.find((r) => r.match.test(raw));
  return rule ? { title: rule.title, description: rule.description } : FALLBACK;
}
