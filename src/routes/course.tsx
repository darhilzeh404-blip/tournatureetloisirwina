import { createFileRoute, redirect } from "@tanstack/react-router";

// Compat: ancienne URL /course → redirige vers /mes-reservations
export const Route = createFileRoute("/course")({
  beforeLoad: () => {
    throw redirect({ to: "/mes-reservations" });
  },
});
