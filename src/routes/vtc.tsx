import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/vtc")({
  head: () => ({
    meta: [
      { title: "VTC & Mariage — Agence Wina" },
      { name: "description", content: "Réservez un VTC Standard, Confort, VIP ou un véhicule de mariage à Libreville, Akanda et Owendo. Tarifs fixes par zone." },
    ],
  }),
  component: VtcLayout,
});

function VtcLayout() {
  return <Outlet />;
}