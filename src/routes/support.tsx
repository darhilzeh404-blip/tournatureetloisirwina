import { createFileRoute, Link } from "@tanstack/react-router";
import { Headphones, Phone, Mail, MessageCircle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — Agence Wina" },
      { name: "description", content: "Contactez l'équipe Agence Wina pour toute question ou assistance." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
        <header className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Headphones className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Support client</h1>
            <p className="text-sm text-muted-foreground">Nous sommes là pour vous aider</p>
          </div>
        </header>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <a href="tel:+24100000000" className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md">
            <Phone className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">Téléphone</div>
              <div className="text-xs text-muted-foreground">+241 00 00 00 00</div>
            </div>
          </a>
          <a href="https://wa.me/24100000000" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md">
            <MessageCircle className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">WhatsApp</div>
              <div className="text-xs text-muted-foreground">Chat instantané</div>
            </div>
          </a>
          <a href="mailto:contact@agencewina.com" className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md sm:col-span-2">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">Email</div>
              <div className="text-xs text-muted-foreground">contact@agencewina.com</div>
            </div>
          </a>
        </div>
      </div>
    </main>
  );
}
