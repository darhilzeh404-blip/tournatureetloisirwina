import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/agences/$id/billets")({
  component: AdminAgenceBillets,
});

function AdminAgenceBillets() {
  const { id } = Route.useParams();

  return (
    <div className="p-5">
      <h1 className="text-2xl font-bold">
        Gestion billets agence
      </h1>

      <p className="mt-3">
        ID agence : {id}
      </p>
    </div>
  );
}