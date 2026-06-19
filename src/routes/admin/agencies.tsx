import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/agencies')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/agencies"!</div>
}
