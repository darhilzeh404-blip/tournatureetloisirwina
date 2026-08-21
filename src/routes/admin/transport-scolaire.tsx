import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NumberInput } from "@/components/ui/number-input";
import { NumericTextField } from "@/components/ui/numeric-text-field";

export const Route = createFileRoute("/admin/transport-scolaire")({
  head: () => ({
    meta: [
      { title: "Transport scolaire — Administration Wina Tour" },
      { name: "description", content: "Gérez les établissements, itinéraires et tarifs du transport scolaire Wina Tour." },
      { property: "og:title", content: "Transport scolaire — Administration Wina Tour" },
      { property: "og:description", content: "Gérez les établissements, itinéraires et tarifs du transport scolaire Wina Tour." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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

type SchoolLevel = "maternelle" | "primaire" | "college" | "lycee";

const SCHOOL_LEVELS: { value: SchoolLevel; label: string }[] = [
  { value: "maternelle", label: "Maternelle" },
  { value: "primaire", label: "Primaire" },
  { value: "college", label: "Collège" },
  { value: "lycee", label: "Lycée" },
];

type School = {
  id: string;
  name: string;
  address: string | null;
  level: SchoolLevel;
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
  is_active: boolean;
};

function TransportScolaireAdmin() {
  const [tariffs, setTariffs] = useState<SchoolTariff[]>([]);
  const [activities, setActivities] = useState<ExtraActivity[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [routes, setRoutes] = useState<SchoolRoute[]>([]);

  const [schoolForm, setSchoolForm] = useState({
    name: "",
    address: "",
    level: "primaire" as SchoolLevel,
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
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [editingRoute, setEditingRoute] = useState<SchoolRoute | null>(null);

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

    setSchools((data ?? []) as unknown as School[]);
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
      level: schoolForm.level,
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
      level: "primaire",
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

  async function saveSchool(school: School, patch: Partial<School>) {
    const { data, error } = await supabase
      .from("schools")
      .update(patch as never)
      .eq("id", school.id)
      .select("id,name,address,level,is_active")
      .maybeSingle();
    if (error) {
      alert(`Erreur modification établissement : ${error.message}`);
      return;
    }
    if (!data) {
      alert("Modification refusée : vérifiez que votre compte possède toujours le rôle administrateur.");
      return;
    }
    setEditingSchool(null);
    await loadSchools();
    alert("Établissement modifié");
  }

  async function deleteSchool(school: School) {
    if (
      !confirm(
        `Supprimer « ${school.name} » ? Ses itinéraires seront aussi supprimés.`,
      )
    )
      return;
    await supabase.from("school_routes").delete().eq("school_id", school.id);
    const { error } = await supabase.from("schools").delete().eq("id", school.id);
    if (error) {
      alert(`Erreur suppression : ${error.message}`);
      return;
    }
    loadSchools();
    loadRoutes();
  }

  async function saveRoute(route: SchoolRoute, patch: Partial<SchoolRoute>) {
    const { data, error } = await supabase
      .from("school_routes")
      .update(patch as never)
      .eq("id", route.id)
      .select("id")
      .maybeSingle();
    if (error) {
      alert(`Erreur modification itinéraire : ${error.message}`);
      return;
    }
    if (!data) {
      alert("Modification refusée : vérifiez que votre compte possède toujours le rôle administrateur.");
      return;
    }
    setEditingRoute(null);
    await loadRoutes();
    alert("Itinéraire modifié");
  }

  async function deleteRoute(route: SchoolRoute) {
    if (!confirm(`Supprimer l'itinéraire « ${route.name} » ?`)) return;
    const { error } = await supabase
      .from("school_routes")
      .delete()
      .eq("id", route.id);
    if (error) {
      alert(`Erreur suppression : ${error.message}`);
      return;
    }
    loadRoutes();
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
          <select
            value={schoolForm.level}
            onChange={(e) =>
              setSchoolForm((f) => ({ ...f, level: e.target.value as SchoolLevel }))
            }
            className="w-full rounded border bg-background p-3 text-foreground md:w-56"
          >
            {SCHOOL_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
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
            {schools.map((school) =>
              editingSchool?.id === school.id ? (
                <div key={school.id} className="space-y-3 rounded-lg border p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      className="rounded border bg-background p-2 text-foreground"
                      value={editingSchool.name}
                      onChange={(e) =>
                        setEditingSchool({ ...editingSchool, name: e.target.value })
                      }
                    />
                    <input
                      className="rounded border bg-background p-2 text-foreground"
                      placeholder="Adresse"
                      value={editingSchool.address ?? ""}
                      onChange={(e) =>
                        setEditingSchool({ ...editingSchool, address: e.target.value })
                      }
                    />
                    <select
                      className="rounded border bg-background p-2 text-foreground"
                      value={editingSchool.level}
                      onChange={(e) =>
                        setEditingSchool({
                          ...editingSchool,
                          level: e.target.value as SchoolLevel,
                        })
                      }
                    >
                      {SCHOOL_LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editingSchool.is_active}
                        onChange={(e) =>
                          setEditingSchool({
                            ...editingSchool,
                            is_active: e.target.checked,
                          })
                        }
                      />
                      Actif (visible côté client)
                    </label>
                    <button
                      className="rounded bg-primary px-3 py-1 text-primary-foreground"
                      onClick={() =>
                        saveSchool(school, {
                          name: editingSchool.name,
                          address: editingSchool.address,
                          level: editingSchool.level,
                          is_active: editingSchool.is_active,
                        })
                      }
                    >
                      Enregistrer
                    </button>
                    <button
                      className="rounded border px-3 py-1"
                      onClick={() => setEditingSchool(null)}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={school.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{school.name}</p>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {SCHOOL_LEVELS.find((l) => l.value === school.level)?.label ?? "Primaire"}
                      </span>
                    </div>
                    {school.address && (
                      <p className="text-sm text-muted-foreground">
                        {school.address}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm ${
                        school.is_active ? "text-green-600" : "text-muted-foreground"
                      }`}
                    >
                      {school.is_active ? "Actif" : "Inactif"}
                    </span>
                    <button
                      className="rounded border px-3 py-1 text-sm"
                      onClick={() => setEditingSchool(school)}
                    >
                      Modifier
                    </button>
                    <button
                      className="rounded bg-destructive px-3 py-1 text-sm text-destructive-foreground"
                      onClick={() => deleteSchool(school)}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ),
            )}
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

          <NumberInput
            placeholder="Prix mensuel (FCFA)"
            value={routeForm.monthly_price}
            onChange={(v: number) =>
              setRouteForm((f) => ({
                ...f,
                monthly_price: v,
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
                      <div className="flex gap-2">
                        <button
                          className="rounded border px-3 py-1 text-sm"
                          onClick={() => setEditingRoute(route)}
                        >
                          Modifier
                        </button>
                        <button
                          className="rounded bg-destructive px-3 py-1 text-sm text-destructive-foreground"
                          onClick={() => deleteRoute(route)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>

                  {editingRoute?.id === route.id && (
                    <div className="mt-3 grid gap-3 border-t pt-3 md:grid-cols-2">
                      <select
                        className="rounded border bg-background p-2 text-foreground"
                        value={editingRoute.school_id}
                        onChange={(e) =>
                          setEditingRoute({ ...editingRoute, school_id: e.target.value })
                        }
                      >
                        {schools.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className="rounded border bg-background p-2 text-foreground"
                        value={editingRoute.name}
                        onChange={(e) =>
                          setEditingRoute({ ...editingRoute, name: e.target.value })
                        }
                      />
                      <input
                        className="rounded border bg-background p-2 text-foreground"
                        value={editingRoute.departure_point}
                        onChange={(e) =>
                          setEditingRoute({
                            ...editingRoute,
                            departure_point: e.target.value,
                          })
                        }
                      />
                      <input
                        className="rounded border bg-background p-2 text-foreground"
                        value={editingRoute.arrival_point}
                        onChange={(e) =>
                          setEditingRoute({
                            ...editingRoute,
                            arrival_point: e.target.value,
                          })
                        }
                      />
                      <input
                        type="time"
                        className="rounded border bg-background p-2 text-foreground"
                        value={editingRoute.departure_time ?? ""}
                        onChange={(e) =>
                          setEditingRoute({
                            ...editingRoute,
                            departure_time: e.target.value,
                          })
                        }
                      />
                      <input
                        type="time"
                        className="rounded border bg-background p-2 text-foreground"
                        value={editingRoute.return_time ?? ""}
                        onChange={(e) =>
                          setEditingRoute({
                            ...editingRoute,
                            return_time: e.target.value,
                          })
                        }
                      />
                      <NumberInput
                        className="rounded border bg-background p-2 text-foreground"
                        value={editingRoute.monthly_price}
                        onChange={(v: number) =>
                          setEditingRoute({
                            ...editingRoute,
                            monthly_price: v,
                          })
                        }
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editingRoute.is_active}
                          onChange={(e) =>
                            setEditingRoute({
                              ...editingRoute,
                              is_active: e.target.checked,
                            })
                          }
                        />
                        Actif (visible côté client)
                      </label>
                      <div className="flex gap-2">
                        <button
                          className="rounded bg-primary px-3 py-1 text-primary-foreground"
                          onClick={() =>
                            saveRoute(route, {
                              school_id: editingRoute.school_id,
                              name: editingRoute.name,
                              departure_point: editingRoute.departure_point,
                              arrival_point: editingRoute.arrival_point,
                              departure_time: editingRoute.departure_time || "",
                              return_time: editingRoute.return_time || "",
                              monthly_price: Number(editingRoute.monthly_price),
                              is_active: editingRoute.is_active,
                            })
                          }
                        >
                          Enregistrer
                        </button>
                        <button
                          className="rounded border px-3 py-1"
                          onClick={() => setEditingRoute(null)}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
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

          <NumericTextField
            value={tariffAmount}
            onChange={setTariffAmount}
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

          <NumericTextField
            value={activityPrice}
            onChange={setActivityPrice}
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