/** Drapeau du Gabon en SVG (les emojis drapeaux ne s'affichent pas sur Android/Windows). */
export function FlagGabon({ className = "h-5 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 9 6"
      role="img"
      aria-label="Drapeau du Gabon"
      className={`shrink-0 rounded-[2px] shadow-sm ring-1 ring-black/10 ${className}`}
      preserveAspectRatio="none"
    >
      <rect width="9" height="2" y="0" fill="#009e60" />
      <rect width="9" height="2" y="2" fill="#fcd116" />
      <rect width="9" height="2" y="4" fill="#3a75c4" />
    </svg>
  );
}
