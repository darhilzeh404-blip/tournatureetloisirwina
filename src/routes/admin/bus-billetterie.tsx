import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/admin/bus-billetterie")({
  component: BusBilletterieAdmin,
});

type Agency = {
  id: string;
  name: string;
  logo_url: string | null;
};

type BusTrip = {
  id: string;
  origin: string;
  destination: string;
  departure_date: string;
  seats_total: number;
  seats_available: number;
  price_adult: number;
  status: string;
  partner_agencies?: {
    name: string;
  };
};

type BusTripForm = {
  agency_id: string;

  origin: string;
  destination: string;

  start_date: string;
  end_date: string;

  seats_total: number;

  price_adult: number;
  price_child_7_11: number;
  price_child_0_6: number;

  baggage_included_kg: number;
  baggage_extra_price_per_kg: number;
  baggage_conditions: string;
};

function BusBilletterieAdmin() {
    const [loading, setLoading] = useState(false);

  const [agencies, setAgencies] = useState<Agency[]>([]);

  const [trips, setTrips] = useState<BusTrip[]>([]);

  const [form, setForm] = useState<BusTripForm>({
    agency_id: "",

    origin: "",
    destination: "",

    start_date: "",
    end_date: "",

    seats_total: 50,

    price_adult: 0,
    price_child_7_11: 0,
    price_child_0_6: 0,

    baggage_included_kg: 20,
    baggage_extra_price_per_kg: 1000,
    baggage_conditions: "",
  });
    const loadAgencies = async () => {

    const { data, error } = await supabase
      .from("partner_agencies")
      .select("id,name,logo_url")
      .eq("is_active", true)
      .eq("is_verified", true)
      .order("name");

    if (error) {
      toast.error(error.message);
      return;
    }

    setAgencies(data || []);
  };
    const loadTrips = async () => {

    const { data, error } = await supabase
      .from("bus_trips")
      .select(`
        id,
        origin,
        destination,
        departure_date,
        seats_total,
        seats_available,
        price_adult,
        status,
        partner_agencies(name)
      `)
      .order("departure_date");

    if (error) {
      toast.error(error.message);
      return;
    }

    setTrips(data || []);
  };
    useEffect(() => {

    loadAgencies();

    loadTrips();

  }, []);
  const createTrip = async () => {

  if (!form.agency_id) {
    toast.error("Choisissez une agence");
    return;
  }

  if (!form.origin) {
    toast.error("Ville de départ obligatoire");
    return;
  }

  if (!form.destination) {
    toast.error("Destination obligatoire");
    return;
  }

  if (!form.start_date || !form.end_date) {
    toast.error("Choisissez une période");
    return;
  }

  const start = new Date(form.start_date);
  const end = new Date(form.end_date);

  if (start > end) {
    toast.error("La date de début doit être avant la date de fin");
    return;
  }

  const difference =
    Math.floor(
      (end.getTime() - start.getTime()) /
      (1000 * 60 * 60 * 24)
    ) + 1;

  if (difference > 30) {
    toast.error("Maximum 30 jours");
    return;
  }

  setLoading(true);

  let current = new Date(start);

  while (current <= end) {

    const departureDate =
      current.toISOString().split("T")[0];

    const { error } = await supabase
      .from("bus_trips")
      .insert({

        agency_id: form.agency_id,

        origin: form.origin,
        destination: form.destination,

        departure_date: departureDate,

        seats_total: form.seats_total,
        seats_available: form.seats_total,

        price_adult: form.price_adult,
        price_child_7_11: form.price_child_7_11,
        price_child_0_6: form.price_child_0_6,

        baggage_included_kg:
          form.baggage_included_kg,

        baggage_extra_price_per_kg:
          form.baggage_extra_price_per_kg,

        baggage_conditions:
          form.baggage_conditions,

        status: "available",

      });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    current.setDate(current.getDate() + 1);

  }

  toast.success("Programmation créée avec succès");

  setForm({

    agency_id: "",

    origin: "",
    destination: "",

    start_date: "",
    end_date: "",

    seats_total: 50,

    price_adult: 0,
    price_child_7_11: 0,
    price_child_0_6: 0,

    baggage_included_kg: 20,
    baggage_extra_price_per_kg: 1000,
    baggage_conditions: "",

  });

  await loadTrips();

  setLoading(false);

};
if (loading) {
  return (
    <div className="p-8">
      Chargement...
    </div>
  );
}
return (

  <div className="space-y-6 p-6">

    <div>

      <h1 className="text-3xl font-bold">
        Billetterie Bus
      </h1>

      <p className="text-muted-foreground">
        Création des programmations de voyages
      </p>

    </div>

    <Card>

      <CardContent className="space-y-6 p-6">

        <div className="flex items-center gap-2">

          <Plus className="h-5 w-5"/>

          <h2 className="text-xl font-semibold">
            Nouvelle programmation
          </h2>

        </div>

        {/* Agence */}

        <div>

          <label className="font-medium">
            Agence partenaire
          </label>

          <select

            className="mt-2 h-11 w-full rounded-md border px-3"

            value={form.agency_id}

            onChange={(e)=>
              setForm({
                ...form,
                agency_id:e.target.value
              })
            }

          >

            <option value="">
              Choisir une agence
            </option>

            {agencies.map((agency)=>(
              <option
                key={agency.id}
                value={agency.id}
              >
                {agency.name}
              </option>
            ))}

          </select>

        </div>

        {/* Départ / Arrivée */}

        <div className="grid gap-4 md:grid-cols-2">

          <Input

            placeholder="Ville de départ"

            value={form.origin}

            onChange={(e)=>
              setForm({
                ...form,
                origin:e.target.value
              })
            }

          />

          <Input

            placeholder="Destination"

            value={form.destination}

            onChange={(e)=>
              setForm({
                ...form,
                destination:e.target.value
              })
            }

          />

        </div>

        {/* Calendrier */}

        <div className="grid gap-4 md:grid-cols-2">

          <div>

            <label className="font-medium">
              Date début
            </label>

            <Input

              type="date"

              min={new Date().toISOString().split("T")[0]}

              value={form.start_date}

              onChange={(e)=>
                setForm({
                  ...form,
                  start_date:e.target.value
                })
              }

            />

          </div>

          <div>

            <label className="font-medium">
              Date fin
            </label>

            <Input

              type="date"

              min={form.start_date || new Date().toISOString().split("T")[0]}

              value={form.end_date}

              onChange={(e)=>
                setForm({
                  ...form,
                  end_date:e.target.value
                })
              }

            />

          </div>

        </div>

        <p className="text-sm text-muted-foreground">

          Une programmation peut couvrir jusqu'à 30 jours.
          Un voyage sera créé automatiquement pour chaque journée.

        </p>

        {/* Places */}

        <Input

          type="number"

          placeholder="Nombre de places"

          value={form.seats_total}

          onChange={(e)=>
            setForm({
              ...form,
              seats_total:Number(e.target.value)
            })
          }

        />

        <h3 className="font-semibold">
          Tarifs
        </h3>

        <div className="grid gap-4 md:grid-cols-3">

          <Input

            type="number"

            placeholder="Adulte"

            value={form.price_adult}

            onChange={(e)=>
              setForm({
                ...form,
                price_adult:Number(e.target.value)
              })
            }

          />

          <Input

            type="number"

            placeholder="Enfant 7-11 ans"

            value={form.price_child_7_11}

            onChange={(e)=>
              setForm({
                ...form,
                price_child_7_11:Number(e.target.value)
              })
            }

          />

          <Input

            type="number"

            placeholder="Enfant 0-6 ans"

            value={form.price_child_0_6}

            onChange={(e)=>
              setForm({
                ...form,
                price_child_0_6:Number(e.target.value)
              })
            }

          />

        </div>
                {/* Bagages */}

        <h3 className="font-semibold">
          Gestion des bagages
        </h3>


        <div className="grid gap-4 md:grid-cols-2">

          <Input

            type="number"

            placeholder="Kg inclus"

            value={form.baggage_included_kg}

            onChange={(e)=>
              setForm({
                ...form,
                baggage_included_kg:Number(e.target.value)
              })
            }

          />


          <Input

            type="number"

            placeholder="Prix kg supplémentaire"

            value={form.baggage_extra_price_per_kg}

            onChange={(e)=>
              setForm({
                ...form,
                baggage_extra_price_per_kg:Number(e.target.value)
              })
            }

          />

        </div>


        <textarea

          className="min-h-28 w-full rounded-md border p-3"

          placeholder="Conditions des bagages"

          value={form.baggage_conditions}

          onChange={(e)=>
            setForm({
              ...form,
              baggage_conditions:e.target.value
            })
          }

        />


        {/* Bouton création */}

        <Button

          onClick={createTrip}

          className="w-full"

        >

          Créer les voyages

        </Button>


      </CardContent>

    </Card>



    {/* Liste des voyages */}

    <Card>

      <CardContent className="p-6 space-y-4">


        <h2 className="text-xl font-semibold">

          Voyages programmés

        </h2>



        <div className="space-y-3">


          {trips.length === 0 && (

            <p className="text-muted-foreground">

              Aucun voyage créé.

            </p>

          )}



          {trips.map((trip)=>(


            <div

              key={trip.id}

              className="rounded-lg border p-4"

            >


              <div className="flex flex-wrap justify-between gap-3">


                <div>


                  <p className="font-semibold">

                    {trip.origin} → {trip.destination}

                  </p>


                  <p className="text-sm text-muted-foreground">

                    {trip.partner_agencies?.name}

                  </p>


                </div>



                <div>


                  <p>

                    Date :{" "}

                    {trip.departure_date}

                  </p>


                  <p>

                    Places :{" "}

                    {trip.seats_available}

                    /

                    {trip.seats_total}

                  </p>


                </div>


              </div>



              <div className="mt-2">


                <p className="font-semibold">

                  Prix adulte : {trip.price_adult} FCFA

                </p>


                <p className="text-sm">

                  Statut : {trip.status}

                </p>


              </div>



            </div>


          ))}


        </div>


      </CardContent>


    </Card>


  </div>

); 
}    