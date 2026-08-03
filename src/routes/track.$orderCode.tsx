import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/track/$orderCode')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/track/$orderCode"!</div>
}
