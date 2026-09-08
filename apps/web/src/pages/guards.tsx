import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '../api/queries'
import { Spinner } from '../components/ui'

/**
 * Client-side gating is a convenience, not a security boundary -- the API guards
 * are what actually enforce this. Its job is to avoid rendering a page that is
 * only going to 401, and to send people somewhere useful instead.
 */
export function RequireAuth({ admin = false }: { admin?: boolean }) {
  const { data, isPending } = useSession()
  const location = useLocation()

  if (isPending) return <Spinner />

  const user = data?.user ?? null

  if (!user) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (admin && !user.isAdmin) {
    return (
      <div role="alert" className="rounded-lg border border-line p-6">
        <h1 className="text-xl font-bold">Not allowed</h1>
        <p className="mt-2 text-ink-dim">The admin section is only for administrators.</p>
      </div>
    )
  }

  return <Outlet />
}
