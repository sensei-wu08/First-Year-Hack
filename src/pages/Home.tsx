import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { APP_NAME } from '../brand'
import Avatar from '../components/Avatar'
import { useProfile, useSlowLoading } from '../data/auth'
import { friendlyError, listMyGroups } from '../data/groups'
import type { Group } from '../lib/types'

const TILE_COLOURS = ['bg-pink', 'bg-sky', 'bg-mint', 'bg-tangerine', 'bg-lavender']
/** Invite code of the seeded demo group "The Fit Crew" (set by scripts/seed.ts). */
const EXAMPLE_CODE = 'fitcrew'

/** Accepts a bare code or a pasted invite link; returns the last path segment after /j/. */
function extractCode(raw: string): string {
  const t = raw.trim()
  const m = t.match(/\/j\/([^/?#\s]+)/)
  return (m ? m[1] : t.replace(/[/?#].*$/, '')).trim()
}

export default function Home() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const { profile, loading } = useProfile()
  const slow = useSlowLoading(loading)
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
        if (!cancelled) setError(friendlyError(e, 'Could not load your groups. Check your connection and try again.'))
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
          {slow && <p className="sub">Still connecting… check your connection</p>}
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
          <p className="tile">You're not in a group yet. Join a friend's group below, or start your own.</p>
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
        {groups !== null && !groups.some((g) => g.inviteCode === EXAMPLE_CODE) && (
          <Link to={`/j/${EXAMPLE_CODE}`} className="tile bg-lime flex items-center justify-between gap-3 no-underline">
            <span className="flex flex-col gap-1">
              <span className="h-tile">See an example group</span>
              <span className="text-small">The Fit Crew: six weeks of battles, a league table and Wrapped</span>
            </span>
            <span className="chip bg-ink text-white shrink-0 whitespace-nowrap" aria-hidden="true">Take a look</span>
          </Link>
        )}
        <form
          className="tile bg-lavender flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            const c = extractCode(code)
            if (c) navigate(`/j/${encodeURIComponent(c)}`)
          }}
        >
          <label htmlFor="invite-code" className="h-tile">Join a friend's group</label>
          <p className="text-small">
            Ask them for their invite code or link (it's in their Group tab), or scan their QR code with your phone camera. You can be in as many groups as you like.
          </p>
          <input
            id="invite-code"
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste a code or invite link"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="btn" type="submit" disabled={!extractCode(code)}>Join group</button>
        </form>
        <Link to="/new" className="btn btn-ghost">Start your own group</Link>
      </div>
    </div>
  )
}
