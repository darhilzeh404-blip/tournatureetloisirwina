import { Bus, Phone, Mail, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Bus className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">Agence Wina</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Votre partenaire de transport et tourisme au Gabon. Sécurité, confort et ponctualité.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">Services</h4>
            <div className="flex flex-col gap-2">
              <Link to="/transport-scolaire" className="text-sm text-muted-foreground hover:text-foreground">Transport Scolaire</Link>
              <Link to="/location-bus" className="text-sm text-muted-foreground hover:text-foreground">Location de Bus</Link>
              <Link to="/circuits" className="text-sm text-muted-foreground hover:text-foreground">Circuits Touristiques</Link>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">Contact</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> +241 XX XX XX XX</div>
              <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> contact@agencewina.ga</div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Libreville, Gabon</div>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">Informations</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span>Réservation min. 48h avant</span>
              <span>Paiement 50% à la réservation</span>
              <span>Confirmation par l'admin</span>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Agence Wina. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
