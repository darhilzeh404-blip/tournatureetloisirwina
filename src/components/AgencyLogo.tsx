import { cn } from "@/lib/utils";

/**
 * Displays an agency / ticket logo without cropping the source image.
 * Works for square, round, triangular or diamond-shaped logos:
 * the image is contained (never covered) inside a neutral rounded frame,
 * so nothing gets cut off and quality is preserved.
 */
export function AgencyLogo({
  src,
  alt = "",
  size = 56,
  className,
  rounded = "full",
}: {
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
  rounded?: "full" | "xl" | "2xl";
}) {
  const radius =
    rounded === "full" ? "rounded-full" : rounded === "2xl" ? "rounded-2xl" : "rounded-xl";

  return (
    <div
      className={cn(
        "shrink-0 grid place-items-center overflow-hidden border bg-white",
        radius,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="max-h-full max-w-full object-contain p-1.5"
          style={{ imageRendering: "auto" }}
        />
      ) : (
        <span className="text-xs text-muted-foreground">Logo</span>
      )}
    </div>
  );
}
