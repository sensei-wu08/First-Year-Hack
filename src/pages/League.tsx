import { useEffect, useState } from 'react'
import LeagueTable, { formatPoints } from '../components/LeagueTable'
import { useGroupContext } from '../components/GroupLayout'
import { useProfile } from '../data/auth'
import { friendlyError } from '../data/groups'
import { postedOf, toFacts } from '../data/mappers'
import { currentSeason, listBattles } from '../data/reads'
import { localDateKey, shortDate } from '../lib/time'
import { leagueTable, type TableRow } from '../lib/table'
import type { Season } from '../lib/types'

function daysBetween(from: string, to: string): number {
  const utc = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return Date.UTC(y, m - 1, day)
  }
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

function seasonLabel(season: Season | null, now: Date): string {
  if (!season) return 'Event battles'
  const total = daysBetween(season.startsOn, season.endsOn) + 1
  const today = localDateKey(now)
  if (today > season.endsOn) return `Season ${season.number} · Final table`
  if (today < season.startsOn) return `Season ${season.number} · Starts ${shortDate(season.startsOn)}`
  const day = Math.min(total, daysBetween(season.startsOn, today) + 1)
  return `Season ${season.number} · Day ${day} of ${total}`
}

const PODIUM_COLOURS = ['bg-lime', 'bg-pink', 'bg-sky']
const PODIUM_PLACES = ['1st', '2nd', '3rd']

interface Loaded {
  rows: TableRow[]
  label: string
}

export default function League() {
  const { group, members } = useGroupContext()
  const { uid } = useProfile()
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    let inFlight = false
    let loadedOnce = false
    setError(null)
    // Polls every 15 s (skipped while the tab is hidden or a load is pending) so a reveal shows up without a refresh.
    const load = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const season = await currentSeason(group.id)
        const battles = await listBattles(group.id, season?.id ?? null)
        if (cancelled) return
        // A just-revealed battle counts even if this phone's clock is behind the server's.
        const latestClosed = battles.reduce((t, b) => Math.max(t, b.record.closedAt?.getTime() ?? 0), 0)
        const now = new Date(Math.max(Date.now(), latestClosed))
        // Everyone still in the group, plus anyone who left but has battles in this table.
        const inBattles = new Set(battles.flatMap((b) => [b.record.playerA, b.record.playerB]))
        const tableMembers = members.filter((m) => !m.leftAt || inBattles.has(m.id))
        // Both fits posted but the split isn't back yet (this phone's clock is ahead of the server's): wait for the next poll.
        const facts = battles
          .filter((b) => {
            const p = postedOf(b)
            return !(p.a && p.b && b.tally.votesA === null && b.record.voidedAt === null)
          })
          .map(toFacts)
        setData({ rows: leagueTable(tableMembers, facts, now), label: seasonLabel(season, now) })
        setError(null)
        loadedOnce = true
      } catch (e) {
        // A failed background poll keeps the table on screen.
        if (!cancelled && !loadedOnce) setError(friendlyError(e, 'Check your connection and try again.'))
      } finally {
        inFlight = false
      }
    }
    void load()
    const timer = setInterval(() => {
      if (!document.hidden) void load()
    }, 15000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [group.id, members, tick])

  const podium = data && data.rows.some((r) => r.played > 0) ? data.rows.slice(0, 3) : []

  return (
    <div className="screen">
      <header className="flex items-center justify-between gap-2.5">
        <h1 className="h-display">League</h1>
        {data && <span className="chip">{data.label}</span>}
      </header>
      {error ? (
        <>
          <p className="panel">Couldn't load the table. {error}</p>
          <button className="btn" onClick={() => setTick((t) => t + 1)}>
            Try again
          </button>
        </>
      ) : !data ? (
        <p className="sub">Loading the table</p>
      ) : data.rows.length === 0 ? (
        <p className="panel">No one is in this league yet. Invite your friends from the Group tab.</p>
      ) : (
        <>
          {podium.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {podium.map((r, i) => (
                <div key={r.profileId} className={`tile tile-sm ${PODIUM_COLOURS[i]}`}>
                  <small className="block">{PODIUM_PLACES[i]}</small>
                  <b className="block font-display text-ui font-extrabold wrap-anywhere">{r.name}</b>
                  <small className="block">{formatPoints(r.points)} pts</small>
                </div>
              ))}
            </div>
          )}
          <div className="tile tile-sm bg-ink">
            <LeagueTable rows={data.rows} highlightId={uid} />
          </div>
        </>
      )}
    </div>
  )
}
