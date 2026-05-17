import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

interface ServiceCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  image: string;
  to: string;
  badge?: string;
}

export function ServiceCard({ title, description, icon, image, to, badge }: ServiceCardProps) {
  return (
    <Link to={to} className="group card-hover block overflow-hidden rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]">
      <div className="relative h-48 overflow-hidden">
        <img src={image} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
        {badge && (
          <span className="absolute right-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            {badge}
          </span>
        )}
        <div className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/90 text-primary-foreground">
          {icon}
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold text-card-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
          Réserver maintenant
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
