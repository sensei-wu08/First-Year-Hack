import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useProfile, useSlowLoading } from '../data/auth'

/** Redirects to /onboard?next=<path> when the visitor has no profile yet. */
export default function RequireProfile({ children }: { children: ReactNode }) {
  const { profile, loading } = useProfile()
  const { pathname, search } = useLocation()
  const slow = useSlowLoading(loading)
  if (loading) {
    return (
      <div className="screen">
        <p className="sub">Loading</p>
        {slow && <p className="sub">Still connecting… check your connection</p>}
      </div>
    )
  }
  if (!profile) {
    return <Navigate to={`/onboard?next=${encodeURIComponent(pathname + search)}`} replace />
  }
  return <>{children}</>
}
