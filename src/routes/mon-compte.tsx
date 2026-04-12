import { createFileRoute } from "@tanstack/react-router";
import { User, Mail, Phone, MapPin } from "lucide-react";

export const Route = createFileRoute("/mon-compte")({
  head: () => ({
    meta: [
      { title: "Mon Compte — Agence Wina" },
      { name: "description", content: "Gérez votre profil et vos préférences." },
    ],
  }),
  component: MonComptePage,
});

function MonComptePage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
      <h1 className="text-2xl font-bold">Mon Compte</h1>
      <p className="mt-1 text-sm text-muted-foreground">Gérez votre profil et vos informations personnelles.</p>

      <div className="mt-8 rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Connectez-vous</h2>
            <p className="text-sm text-muted-foreground">Pour accéder à votre compte et vos réservations.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium"><Mail className="h-4 w-4 text-muted-foreground" /> Email</label>
            <input type="email" placeholder="votre@email.com" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium"><Phone className="h-4 w-4 text-muted-foreground" /> Téléphone</label>
            <input type="tel" placeholder="+241 XX XX XX XX" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium"><MapPin className="h-4 w-4 text-muted-foreground" /> Adresse</label>
            <input type="text" placeholder="Votre adresse" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          </div>
          <button className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            Se connecter
          </button>
        </div>
      </div>
    </section>
  );
}
