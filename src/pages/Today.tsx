import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { InviteQr } from '../components/InviteQr'
import { useGroupContext } from '../components/GroupLayout'
import PhaseBadge from '../components/PhaseBadge'
import { useProfile } from '../data/auth'
import { postedOf } from '../data/mappers'
import { listBattles, listSeasons } from '../data/reads'
import { battlePhase } from '../lib/phase'
import { localDateKey } from '../lib/time'
import type { BattleView, Member, Phase, Season } from '../lib/types'

const POLL_MS = 10_000

const hhmm = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

interface Row {
  view: BattleView
  phase: Phase
}

function Side({ view, member, side }: { view: BattleView; member: Member | undefined; side: 'a' | 'b' }) {
  const playerId = side === 'a' ? view.record.playerA : view.record.playerB
  const post = view.posts.find((p) => p.profileId === playerId)
  const cls = side === 'a' ? 'fixture-side fixture-home' : 'fixture-side fixture-away'
  return (
    <div className={cls}>
      <div className="fixture-photo photo">
        {post ? (
          <img src={post.mediaUrl} alt={`${member?.name ?? 'Player'}'s fit`} loading="lazy" />
        ) : (
          <span className="fixture-empty">{member ? <Avatar emoji={member.emoji} size={48} /> : null}</span>
        )}
      </div>
      <p className="fixture-name">{member?.name ?? 'Player'}</p>
      <p className="fixture-note">{post ? 'Posted' : 'Not posted yet'}</p>
    </div>
  )
}

function Fixture({ row, members }: { row: Row; members: Map<string, Member> }) {
  const { view, phase } = row
  const a = members.get(view.record.playerA)
  const b = members.get(view.record.playerB)
  return (
    <Link to={`/b/${view.record.id}`} className="fixture" aria-label={`${a?.name ?? 'Player'} versus ${b?.name ?? 'Player'}`}>
      <div className="fixture-head">
        <PhaseBadge phase={phase} />
      </div>
      <div className="fixture-sides">
        <Side view={view} member={a} side="a" />
        <span className="fixture-vs" aria-hidden="true">vs</span>
        <Side view={view} member={b} side="b" />
      </div>
    </Link>
  )
}

function Hidden({ row }: { row: Row }) {
  const r = row.view.record
  return (
    <div className="panel flex items-center justify-between gap-3">
      <span className="font-bold">Match revealed at {hhmm(r.revealAt)}</span>
      <span className="sub">{dayLabel(r.revealAt)}</span>
    </div>
  )
}

function PastRow({ row, members }: { row: Row; members: Map<string, Member> }) {
  const { view, phase } = row
  const a = members.get(view.record.playerA)?.name ?? 'Player'
  const b = members.get(view.record.playerB)?.name ?? 'Player'
  const { votesA, votesB } = view.tally
  const score = phase === 'results' && votesA !== null && votesB !== null ? `${votesA}–${votesB}` : 'vs'
  return (
    <Link to={`/b/${view.record.id}`} className="panel flex items-center justify-between gap-3 text-ink no-underline">
      <span className="font-bold">
        {a} {score} {b}
      </span>
      <span className="sub">{dayLabel(view.record.revealAt)}</span>
    </Link>
  )
}

export default function Today() {
  const { group, members } = useGroupContext()
  const { uid } = useProfile()
  const [battles, setBattles] = useState<BattleView[] | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      Promise.all([listBattles(group.id), listSeasons(group.id)])
        .then(([b, s]) => {
          if (cancelled) return
          setBattles(b)
          setSeasons(s)
          setError(null)
          setNow(new Date())
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load battles.')
        })
    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [group.id, tick])

  const memberMap = new Map(members.map((m) => [m.id, m]))
  const today = localDateKey(now)
  const isAdmin = uid !== null && uid === group.adminId

  const rows: Row[] = (battles ?? []).map((view) => ({
    view,
    phase: battlePhase(view.record, postedOf(view), now),
  }))
  const dateOf = (r: Row) => localDateKey(r.view.record.revealAt)
  const finished = (r: Row) => r.phase === 'results' || r.phase === 'void'
  // Today's fixtures, plus anything from an earlier day that is still unresolved.
  const todays = rows.filter((r) => dateOf(r) === today || (dateOf(r) < today && !finished(r)))
  const upcoming = rows
    .filter((r) => dateOf(r) > today)
    .sort((x, y) => x.view.record.revealAt.getTime() - y.view.record.revealAt.getTime())
  const past = rows
    .filter((r) => dateOf(r) < today && finished(r))
    .sort((x, y) => y.view.record.revealAt.getTime() - x.view.record.revealAt.getTime())

  const endedSeason = seasons.filter((s) => s.endsOn < today).sort((x, y) => y.number - x.number)[0]

  return (
    <div className="screen">
      <header className="flex items-end justify-between gap-3">
        <h1 className="h-display">Today</h1>
        <span className="pill">{group.name}</span>
      </header>

      {endedSeason && (
        <Link to={`/g/${group.id}/wrapped/${endedSeason.id}`} className="wrapped-banner">
          <span className="font-bold">Season {endedSeason.number} Wrapped is ready</span>
          <span aria-hidden="true">See it</span>
        </Link>
      )}

      {error && (
        <div className="flex flex-col gap-2">
          <p className="panel" role="alert">{error}</p>
          <button className="btn" onClick={() => setTick((t) => t + 1)}>Try again</button>
        </div>
      )}

      {!error && battles === null && <p className="sub">Loading today's battles</p>}

      {battles !== null && (
        <>
          <section className="flex flex-col gap-2.5" aria-label="Today's battles">
            {todays.length === 0 ? (
              <p className="panel">No battle today. Check back at {group.revealTime}.</p>
            ) : (
              todays.map((r) =>
                r.phase === 'upcoming' ? (
                  <Hidden key={r.view.record.id} row={r} />
                ) : (
                  <Fixture key={r.view.record.id} row={r} members={memberMap} />
                ),
              )
            )}
          </section>

          {upcoming.length > 0 && (
            <section className="flex flex-col gap-2.5" aria-label="Upcoming battles">
              <h2 className="text-title font-bold">Coming up</h2>
              {upcoming.map((r) => (
                <Hidden key={r.view.record.id} row={r} />
              ))}
            </section>
          )}

          {past.length > 0 && (
            <section className="flex flex-col gap-2.5" aria-label="Past results">
              <h2 className="text-title font-bold">Past results</h2>
              {past.map((r) => (
                <PastRow key={r.view.record.id} row={r} members={memberMap} />
              ))}
            </section>
          )}
        </>
      )}

      {isAdmin && (
        <section className="flex flex-col gap-3" aria-label="Admin">
          <Link to={`/g/${group.id}/new-battle`} className="btn">New battle</Link>
          <InviteQr url={`${window.location.origin}/j/${group.inviteCode}`} label={`Invite friends to ${group.name}`} />
        </section>
      )}
    </div>
  )
}
