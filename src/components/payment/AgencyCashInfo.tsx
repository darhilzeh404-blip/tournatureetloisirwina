import { MapPin, Phone, Clock, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AGENCY_INFO, agencyMapsUrl, telHref } from "@/lib/payment-methods";

export function AgencyCashInfo({ intro }: { intro?: string }) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold">💵 Paiement en agence</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {intro ??
              "Vous avez choisi le paiement en espèces. Veuillez vous rendre dans une agence WINA TOUR pour effectuer le règlement de votre réservation."}
          </p>
        </div>

        <div className="rounded-xl border bg-background p-4 space-y-3 text-sm">
          <p className="font-bold">{AGENCY_INFO.name}</p>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{AGENCY_INFO.address}</span>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="flex flex-col">
              {AGENCY_INFO.phones.map((p) => (
                <a key={p} href={telHref(p)} className="font-medium hover:underline">
                  {p}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{AGENCY_INFO.hours}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" className="h-11">
            <a href={telHref(AGENCY_INFO.phones[0])}>
              <Phone className="mr-2 h-4 w-4" /> Appeler
            </a>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <a href={agencyMapsUrl()} target="_blank" rel="noreferrer">
              <Navigation className="mr-2 h-4 w-4" /> Itinéraire
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
