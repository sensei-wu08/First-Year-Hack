import { useEffect, useState } from 'react'
import LeagueTable from '../components/LeagueTable'
import { useGroupContext } from '../components/GroupLayout'
import { useProfile } from '../data/auth'
import { toFacts } from '../data/mappers'
import { currentSeason, listBattles } from '../data/reads'
import { localDateKey } from '../lib/time'
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
  if (today < season.startsOn) return `Season ${season.number} · Starts ${season.startsOn}`
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
    setError(null)
    ;(async () => {
      try {
        const season = await currentSeason(group.id)
        const battles = await listBattles(group.id, season?.id ?? null)
        if (cancelled) return
        const now = new Date()
        // Everyone still in the group, plus anyone who left but has battles in this table.
        const inBattles = new Set(battles.flatMap((b) => [b.record.playerA, b.record.playerB]))
        const tableMembers = members.filter((m) => !m.leftAt || inBattles.has(m.id))
        setData({ rows: leagueTable(tableMembers, battles.map(toFacts), now), label: seasonLabel(season, now) })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })()
    return () => {
      cancelled = true
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
                  <small className="block">{r.points} pts</small>
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
