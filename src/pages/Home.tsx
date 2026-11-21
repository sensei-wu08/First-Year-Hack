import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { APP_NAME } from '../brand'
import Avatar from '../components/Avatar'
import { useProfile } from '../data/auth'
import { listMyGroups } from '../data/groups'
import type { Group } from '../lib/types'

const TILE_COLOURS = ['bg-pink', 'bg-sky', 'bg-mint', 'bg-tangerine', 'bg-lavender']

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
      <div className="set-today">
        <div className="screen app-col">
          <p className="sub">Loading</p>
        </div>
      </div>
    )
  }
  // Home isn't wrapped in RequireProfile by the router, so it sends new visitors to onboarding itself.
  if (!profile) return <Navigate to="/onboard?next=%2F" replace />

  return (
    <div className="set-today">
      <div className="screen app-col pb-6">
        <header className="flex items-center justify-between">
          <h1 className="h-display">{APP_NAME}</h1>
          <Link to="/me" aria-label="Your profile">
            <Avatar emoji={profile.emoji} size={44} />
          </Link>
        </header>
        <h2 className="h-tile mt-2">Your groups</h2>
        {error ? (
          <>
            <p className="tile" role="alert">{error}</p>
            <button className="btn" onClick={() => setTick((t) => t + 1)}>Try again</button>
          </>
        ) : groups === null ? (
          <p className="sub">Loading your groups</p>
        ) : groups.length === 0 ? (
          <p className="tile bg-lavender">You're not in a group yet. Create one, or open an invite link from a friend.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {groups.map((g, i) => (
              <li key={g.id}>
                <Link
                  to={`/g/${g.id}`}
                  className={`tile flex items-center justify-between no-underline ${TILE_COLOURS[i % TILE_COLOURS.length]}`}
                >
                  <span className="h-tile">{g.name}</span>
                  <span className="chip bg-white" aria-hidden="true">Open</span>
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
