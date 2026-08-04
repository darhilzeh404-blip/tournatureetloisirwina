
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/transport-scolaire")({
  component: TransportScolaireAdmin,
});


type SchoolTariff = {
  id: string;
  standing: string;
  formule: string;
  amount: number;
};


type ExtraActivity = {
  id: string;
  code: string;
  label: string;
  description?: string | null;
  price: number;
  is_active: boolean;
};



function TransportScolaireAdmin() {

  const [tariffs, setTariffs] = useState<SchoolTariff[]>([]);
  const [activities, setActivities] = useState<ExtraActivity[]>([]);

  const [loading, setLoading] = useState(true);


  const [editingTariff, setEditingTariff] =
    useState<SchoolTariff | null>(null);

  const [tariffAmount, setTariffAmount] =
    useState("");



  const [editingActivity, setEditingActivity] =
    useState<ExtraActivity | null>(null);

  const [activityPrice, setActivityPrice] =
    useState("");




  useEffect(() => {

    loadTariffs();
    loadActivities();

  }, []);





  async function loadTariffs() {

    setLoading(true);


    const { data, error } = await supabase
      .from("school_monthly_tariffs")
      .select("*")
      .order("standing");


    if (error) {

      console.error(error);
      return;

    }


    setTariffs((data ?? []) as SchoolTariff[]);
    setLoading(false);

  }





  async function loadActivities() {


    const { data, error } = await supabase
      .from("extra_activities")
      .select("*")
      .order("sort_order");


    if (error) {

      console.error(error);
      return;

    }


    setActivities((data ?? []) as unknown as ExtraActivity[]);

  }







  async function updateTariff() {


    if (!editingTariff) return;


    const newAmount = Number(tariffAmount);


    if (!newAmount || newAmount <= 0) {

      alert("Montant invalide");
      return;

    }



    const { error } = await supabase
      .from("school_monthly_tariffs")
      .update({
        amount: newAmount,
      })
      .eq("id", editingTariff.id);



    if (error) {

      console.error(error);
      alert("Erreur modification tarif");
      return;

    }



    setTariffs((prev)=>
      prev.map((item)=>
        item.id === editingTariff.id
          ? {...item, amount:newAmount}
          : item
      )
    );


    setEditingTariff(null);
    setTariffAmount("");

    alert("Tarif scolaire modifié");

  }







  async function updateActivity() {


    if (!editingActivity) return;



    const newPrice = Number(activityPrice);



    if (!newPrice || newPrice <= 0) {

      alert("Prix invalide");
      return;

    }




    const { error } = await supabase
      .from("extra_activities")
      .update({
        price:newPrice,
      })
      .eq("id", editingActivity.id);



    if(error){

      console.error(error);
      alert("Erreur modification activité");
      return;

    }




    setActivities((prev)=>

      prev.map((item)=>

        item.id === editingActivity.id

          ? {
              ...item,
              price:newPrice
            }

          : item

      )

    );



    setEditingActivity(null);
    setActivityPrice("");

    alert("Activité modifiée");

  }







  return (

    <div className="space-y-8 p-4 lg:p-8">


      <div>

        <h1 className="text-2xl font-bold">
          Transport scolaire
        </h1>

        <p className="text-sm text-muted-foreground">
          Gestion des tarifs et activités scolaires
        </p>

      </div>





      {/* TARIFS SCOLAIRES */}

      <section className="rounded-lg border p-5">


        <h2 className="mb-4 text-lg font-semibold">
          Tarifs mensuels scolaires
        </h2>



        {loading ? (

          <p>Chargement...</p>

        ) : (

          <div className="space-y-3">


          {tariffs.map((tarif)=>(


            <div
              key={tarif.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >


              <div>

                <p className="font-semibold">
                  {tarif.standing.toUpperCase()}
                </p>


                <p className="text-sm text-muted-foreground">
                  {tarif.formule === "simple"
                    ? "Aller simple"
                    : "Aller-retour"}
                </p>

              </div>



              <div className="flex items-center gap-3">


                <span className="font-bold">
                  {tarif.amount.toLocaleString()} FCFA
                </span>



                <button
                  className="rounded bg-primary px-3 py-1 text-white"
                  onClick={()=>{

                    setEditingTariff(tarif);
                    setTariffAmount(
                      String(tarif.amount)
                    );

                  }}
                >

                  Modifier

                </button>


              </div>


            </div>


          ))}


          </div>

        )}


      </section>









      {/* ACTIVITES EXTRA SCOLAIRES */}


      <section className="rounded-lg border p-5">


        <h2 className="mb-4 text-lg font-semibold">
          Activités extra-scolaires
        </h2>



        <div className="space-y-3">


        {activities.map((activity)=>(


          <div
            key={activity.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >


            <div>

              <p className="font-semibold">
                {activity.label}
              </p>


              <p className="text-sm text-muted-foreground">
                {activity.description}
              </p>


            </div>



            <div className="flex items-center gap-3">


              <span className="font-bold">
                {activity.price.toLocaleString()} FCFA
              </span>



              <button

                className="rounded bg-primary px-3 py-1 text-white"

                onClick={()=>{

                  setEditingActivity(activity);

                  setActivityPrice(
                    String(activity.price)
                  );

                }}

              >

                Modifier

              </button>


            </div>



          </div>


        ))}


        </div>


      </section>









      {/* FORMULAIRE TARIF */}


      {editingTariff && (

        <section className="rounded-lg border p-5 space-y-4">


          <h2 className="font-semibold">
            Modifier tarif scolaire
          </h2>


          <input
            type="number"
            value={tariffAmount}
            onChange={(e)=>
              setTariffAmount(e.target.value)
            }
            className="w-full rounded border p-3"
          />


          <button
            className="rounded bg-primary px-4 py-2 text-white"
            onClick={updateTariff}
          >

            Enregistrer

          </button>


        </section>

      )}









      {/* FORMULAIRE ACTIVITE */}


      {editingActivity && (

        <section className="rounded-lg border p-5 space-y-4">


          <h2 className="font-semibold">
            Modifier activité
          </h2>


          <p>
            {editingActivity.label}
          </p>



          <input

            type="number"

            value={activityPrice}

            onChange={(e)=>
              setActivityPrice(e.target.value)
            }

            className="w-full rounded border p-3"

          />



          <button

            className="rounded bg-primary px-4 py-2 text-white"

            onClick={updateActivity}

          >

            Enregistrer

          </button>


        </section>

      )}




    </div>

  );

}
