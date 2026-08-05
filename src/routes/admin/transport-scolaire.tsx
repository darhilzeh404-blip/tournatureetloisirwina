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

type School = {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
};

type SchoolRoute = {
  id: string;
  school_id: string;
  name: string;
  departure_point: string;
  arrival_point: string;
  departure_time: string;
  return_time: string;
  monthly_price: number;
};

function TransportScolaireAdmin() {
  const [tariffs, setTariffs] = useState<SchoolTariff[]>([]);
  const [activities, setActivities] = useState<ExtraActivity[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [routes, setRoutes] = useState<SchoolRoute[]>([]);

  const [schoolForm, setSchoolForm] = useState({
    name: "",
    address: "",
  });

  const [routeForm, setRouteForm] = useState({
    school_id: "",
    name: "",
    departure_point: "",
    arrival_point: "",
    departure_time: "",
    return_time: "",
    monthly_price: 0,
  });

  const [loading, setLoading] = useState(true);

  const [editingTariff, setEditingTariff] = useState<SchoolTariff | null>(null);
  const [tariffAmount, setTariffAmount] = useState("");

  const [editingActivity, setEditingActivity] =
    useState<ExtraActivity | null>(null);
  const [activityPrice, setActivityPrice] = useState("");

  useEffect(() => {
    loadTariffs();
    loadActivities();
    loadSchools();
    loadRoutes();
  }, []);

  async function loadSchools() {
    const { data, error } = await supabase
      .from("schools")
      .select("*")
      .order("name");

    if (error) {
      console.error("Erreur chargement établissements :", error);
      return;
    }

    setSchools(data ?? []);
  }

  async function loadRoutes() {
    const { data, error } = await supabase
      .from("school_routes")
      .select("*")
      .order("name");

    if (error) {
      console.error("Erreur chargement itinéraires :", error);
      return;
    }

    setRoutes(data ?? []);
  }

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

  async function createSchool() {
    if (!schoolForm.name) {
      alert("Nom établissement obligatoire");
      return;
    }

    const { error } = await supabase.from("schools").insert({
      name: schoolForm.name,
      address: schoolForm.address,
      is_active: true,
    });

    if (error) {
      console.error(error);
      alert(`Erreur création établissement : ${error.message}`);
      return;
    }

    setSchoolForm({
      name: "",
      address: "",
    });

    loadSchools();

    alert("Etablissement créé");
  }

  async function createRoute() {
    if (!routeForm.school_id || !routeForm.name) {
      alert("Informations manquantes");
      return;
    }

    const { error } = await supabase.from("school_routes").insert({
      school_id: routeForm.school_id,
      name: routeForm.name,
      departure_point: routeForm.departure_point,
      arrival_point: routeForm.arrival_point,
      departure_time: routeForm.departure_time,
      return_time: routeForm.return_time,
      monthly_price: Number(routeForm.monthly_price),
    });

    if (error) {
      console.error("Erreur création itinéraire :", error);
      alert(`Erreur création itinéraire : ${error.message}`);
      return;
    }

    setRouteForm({
      school_id: "",
      name: "",
      departure_point: "",
      arrival_point: "",
      departure_time: "",
      return_time: "",
      monthly_price: 0,
    });

    loadRoutes();

    alert("Itinéraire créé");
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

    setTariffs((prev) =>
      prev.map((item) =>
        item.id === editingTariff.id ? { ...item, amount: newAmount } : item
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
        price: newPrice,
      })
      .eq("id", editingActivity.id);

    if (error) {
      console.error(error);
      alert("Erreur modification activité");
      return;
    }

    setActivities((prev) =>
      prev.map((item) =>
        item.id === editingActivity.id ? { ...item, price: newPrice } : item
      )
    );

    setEditingActivity(null);
    setActivityPrice("");

    alert("Activité modifiée");
  }

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Transport scolaire</h1>
        <p className="text-sm text-muted-foreground">
          Gestion des tarifs, activités, établissements et itinéraires
        </p>
      </div>

      {/* ÉTABLISSEMENTS SCOLAIRES */}
      <section className="rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-semibold">Établissements scolaires</h2>

        {/* Formulaire création école */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            placeholder="Nom de l'établissement"
            value={schoolForm.name}
            onChange={(e) =>
              setSchoolForm((f) => ({ ...f, name: e.target.value }))
            }
            className="w-full rounded border p-3"
          />
          <input
            type="text"
            placeholder="Adresse (optionnel)"
            value={schoolForm.address}
            onChange={(e) =>
              setSchoolForm((f) => ({ ...f, address: e.target.value }))
            }
            className="w-full rounded border p-3"
          />
          <button
            className="rounded bg-primary px-4 py-2 text-white"
            onClick={createSchool}
          >
            Créer
          </button>
        </div>

        {/* Liste des écoles */}
        {schools.length === 0 ? (
          <p className="text-muted-foreground">Aucun établissement trouvé.</p>
        ) : (
          <div className="space-y-3">
            {schools.map((school) => (
              <div
                key={school.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-semibold">{school.name}</p>
                  {school.address && (
                    <p className="text-sm text-muted-foreground">
                      {school.address}
                    </p>
                  )}
                </div>

                <span
                  className={`text-sm ${
                    school.is_active
                      ? "text-green-600"
                      : "text-muted-foreground"
                  }`}
                >
                  {school.is_active ? "Actif" : "Inactif"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ITINÉRAIRES */}
      <section className="rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-semibold">Itinéraires</h2>

        {/* Formulaire création itinéraire */}
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            value={routeForm.school_id}
            onChange={(e) =>
              setRouteForm((f) => ({ ...f, school_id: e.target.value }))
            }
            className="w-full rounded border p-3"
          >
            <option value="">Sélectionner une école</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Nom de l'itinéraire"
            value={routeForm.name}
            onChange={(e) =>
              setRouteForm((f) => ({ ...f, name: e.target.value }))
            }
            className="w-full rounded border p-3"
          />

          <input
            type="text"
            placeholder="Point de départ"
            value={routeForm.departure_point}
            onChange={(e) =>
              setRouteForm((f) => ({ ...f, departure_point: e.target.value }))
            }
            className="w-full rounded border p-3"
          />

          <input
            type="text"
            placeholder="Point d'arrivée"
            value={routeForm.arrival_point}
            onChange={(e) =>
              setRouteForm((f) => ({ ...f, arrival_point: e.target.value }))
            }
            className="w-full rounded border p-3"
          />

          <input
            type="time"
            value={routeForm.departure_time}
            onChange={(e) =>
              setRouteForm((f) => ({ ...f, departure_time: e.target.value }))
            }
            className="w-full rounded border p-3"
          />

          <input
            type="time"
            value={routeForm.return_time}
            onChange={(e) =>
              setRouteForm((f) => ({ ...f, return_time: e.target.value }))
            }
            className="w-full rounded border p-3"
          />

          <input
            type="number"
            placeholder="Prix mensuel (FCFA)"
            value={routeForm.monthly_price || ""}
            onChange={(e) =>
              setRouteForm((f) => ({
                ...f,
                monthly_price: Number(e.target.value),
              }))
            }
            className="w-full rounded border p-3"
          />

          <button
            className="rounded bg-primary px-4 py-2 text-white"
            onClick={createRoute}
          >
            Créer
          </button>
        </div>

        {/* Liste des itinéraires */}
        {routes.length === 0 ? (
          <p className="text-muted-foreground">Aucun itinéraire trouvé.</p>
        ) : (
          <div className="space-y-3">
            {routes.map((route) => {
              const school = schools.find((s) => s.id === route.school_id);
              return (
                <div key={route.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{route.name}</p>
                      <p className="text-sm text-muted-foreground">
                        École : {school?.name ?? "Inconnue"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {route.departure_point} → {route.arrival_point}
                      </p>
                      {(route.departure_time || route.return_time) && (
                        <p className="text-sm text-muted-foreground">
                          {route.departure_time &&
                            `Départ: ${route.departure_time}`}
                          {route.departure_time && route.return_time && " • "}
                          {route.return_time && `Retour: ${route.return_time}`}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="font-bold">
                        {route.monthly_price.toLocaleString()} FCFA / mois
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* TARIFS SCOLAIRES */}
      <section className="rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-semibold">Tarifs mensuels scolaires</h2>

        {loading ? (
          <p>Chargement...</p>
        ) : (
          <div className="space-y-3">
            {tariffs.map((tarif) => (
              <div
                key={tarif.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-semibold">{tarif.standing.toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground">
                    {tarif.formule === "simple" ? "Aller simple" : "Aller-retour"}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-bold">
                    {tarif.amount.toLocaleString()} FCFA
                  </span>

                  <button
                    className="rounded bg-primary px-3 py-1 text-white"
                    onClick={() => {
                      setEditingTariff(tarif);
                      setTariffAmount(String(tarif.amount));
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
        <h2 className="mb-4 text-lg font-semibold">Activités extra-scolaires</h2>

        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <p className="font-semibold">{activity.label}</p>
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
                  onClick={() => {
                    setEditingActivity(activity);
                    setActivityPrice(String(activity.price));
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
          <h2 className="font-semibold">Modifier tarif scolaire</h2>

          <input
            type="number"
            value={tariffAmount}
            onChange={(e) => setTariffAmount(e.target.value)}
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
          <h2 className="font-semibold">Modifier activité</h2>

          <p>{editingActivity.label}</p>

          <input
            type="number"
            value={activityPrice}
            onChange={(e) => setActivityPrice(e.target.value)}
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