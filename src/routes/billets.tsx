import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/billets")({
  head: () => ({
    meta: [
      { title: "Billets — Agence Wina" },
      { name: "description", content: "Achetez vos billets de bus, train, avion, bateau et événements au Gabon." },
    ],
  }),
  component: BilletsLayout,
});

function BilletsLayout() {
  return <Outlet />;
}