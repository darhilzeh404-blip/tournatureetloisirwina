import { createFileRoute } from "@tanstack/react-router";
import { MovingPage as DetailedMovingPage } from "./demenagement.index";

export const Route = createFileRoute("/demenagement")({
  head: () => ({
    meta: [
      { title: "Déménagement — Agence Wina" },
      { name: "description", content: "Demandez un déménagement premium à Libreville, Owendo ou Akanda." },
    ],
  }),
  component: DetailedMovingPage,
});
