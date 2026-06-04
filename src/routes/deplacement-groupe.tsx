import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/deplacement-groupe")({
  component: () => <Outlet />,
});
