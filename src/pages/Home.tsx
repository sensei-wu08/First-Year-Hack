import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { APP_NAME } from '../brand'
import Avatar from '../components/Avatar'
import { useProfile } from '../data/auth'
import { listMyGroups } from '../data/groups'
import type { Group } from '../lib/types'

export default function Home() {
  const { profile, loading } = useProfile()
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    setError(null)
    listMyGroups()
      .then((g) => {
        if (!cancelled) setGroups(g)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your groups.')
      })
    return () => {
      cancelled = true
    }
  }, [profile, tick])

  if (loading) {
    return (
      <div className="screen app-col">
        <p className="sub">Loading</p>
      </div>
    )
  }
  if (!profile) return <Navigate to="/onboard?next=%2F" replace />

  return (
    <div className="set-today">
      <div className="screen app-col">
        <header className="flex items-center justify-between">
          <h1 className="h-display">{APP_NAME}</h1>
          <Link to="/me" aria-label="Your profile">
            <Avatar emoji={profile.emoji} size={44} />
          </Link>
        </header>
        <h2 className="text-title font-bold">Your groups</h2>
        {error ? (
          <>
            <p className="panel" role="alert">{error}</p>
            <button className="btn" onClick={() => setTick((t) => t + 1)}>Try again</button>
          </>
        ) : groups === null ? (
          <p className="sub">Loading your groups</p>
        ) : groups.length === 0 ? (
          <p className="panel">You're not in a group yet. Create one, or open an invite link from a friend.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {groups.map((g) => (
              <li key={g.id}>
                <Link to={`/g/${g.id}`} className="panel flex items-center justify-between no-underline text-ink">
                  <span className="text-title font-bold">{g.name}</span>
                  <span aria-hidden="true">Open</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link to="/new" className="btn">Create group</Link>
      </div>
    </div>
  )
}
