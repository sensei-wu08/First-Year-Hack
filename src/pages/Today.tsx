import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { InviteQr } from '../components/InviteQr'
import { useGroupContext } from '../components/GroupLayout'
import PhaseBadge from '../components/PhaseBadge'
import { useProfile } from '../data/auth'
import { friendlyError } from '../data/groups'
import { postedOf } from '../data/mappers'
import { listBattles, listSeasons } from '../data/reads'
import { battlePhase } from '../lib/phase'
import { localDateKey } from '../lib/time'
import type { BattleView, Member, Phase, Season } from '../lib/types'

const POLL_MS = 10_000
const DAY_MS = 86_400_000

const hhmm = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

interface Row {
  view: BattleView
  phase: Phase
}

function Side({ view, member, side }: { view: BattleView; member: Member | undefined; side: 'a' | 'b' }) {
  const playerId = side === 'a' ? view.record.playerA : view.record.playerB
  const post = view.posts.find((p) => p.profileId === playerId)
  const home = side === 'a'
  return (
    <div className={`${home ? 'versus-home bg-pink' : 'versus-away bg-sky'}`}>
      {post ? (
        <img
          src={post.mediaUrl}
          alt={`${member?.name ?? 'Player'}'s fit`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="grid h-full place-items-center">
          {member ? <Avatar emoji={member.emoji} size={64} /> : null}
        </span>
      )}
      <span className={`fixture-name absolute bottom-3 ${home ? 'left-3' : 'right-3'}`}>{member?.name ?? 'Player'}</span>
    </div>
  )
}

function ctaLabel(row: Row, viewerId: string | null): string {
  const { view, phase } = row
  const mine = viewerId === view.record.playerA ? 'a' : viewerId === view.record.playerB ? 'b' : null
  if (phase === 'posting' && mine && !postedOf(view)[mine]) return 'Post my fit'
  if (phase === 'voting' && !mine) return 'Vote now'
  if (phase === 'results') return 'See results'
  return 'Open battle'
}

function Fixture({ row, members, viewerId }: { row: Row; members: Map<string, Member>; viewerId: string | null }) {
  const { view, phase } = row
  const a = members.get(view.record.playerA)
  const b = members.get(view.record.playerB)
  const posted = postedOf(view)
  return (
    <div className="flex flex-col gap-2.5">
      <Link
        to={`/b/${view.record.id}`}
        className="versus block"
        aria-label={`${a?.name ?? 'Player'} versus ${b?.name ?? 'Player'}, ${phase}`}
      >
        <Side view={view} member={a} side="a" />
        <Side view={view} member={b} side="b" />
        <span className="vs-badge" aria-hidden="true">vs</span>
      </Link>
      <div className="tile tile-sm bg-ink flex flex-wrap items-center justify-between gap-2">
        <PhaseBadge phase={phase} />
        <span className="flex flex-wrap gap-1.5">
          <span className={`chip ${posted.a ? 'bg-lime' : ''}`}>
            {a?.name ?? 'Player'} {posted.a ? 'posted' : 'not posted'}
          </span>
          <span className={`chip ${posted.b ? 'bg-lime' : ''}`}>
            {b?.name ?? 'Player'} {posted.b ? 'posted' : 'not posted'}
          </span>
        </span>
      </div>
      <Link to={`/b/${view.record.id}`} className="btn">{ctaLabel(row, viewerId)}</Link>
    </div>
  )
}

function Hidden({ row }: { row: Row }) {
  const r = row.view.record
  return (
    <div className="tile tile-sm bg-tangerine flex items-center justify-between gap-3">
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
    <Link to={`/b/${view.record.id}`} className="tile tile-sm bg-lavender flex items-center justify-between gap-3 no-underline">
      <span className="font-bold">
        {a} {score} {b}
      </span>
      <span className="sub">{dayLabel(view.record.revealAt)}</span>
    </Link>
  )
}

export default function Today() {
  const { group, members, reload } = useGroupContext()
  const { uid } = useProfile()
  const [battles, setBattles] = useState<BattleView[] | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [tick, setTick] = useState(0)

  // Members may have joined since the group opened, so refetch them once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [])

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
          if (!cancelled) setError(friendlyError(e, 'Could not load battles. Check your connection and try again.'))
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
  const liveSeason = seasons.find((s) => s.startsOn <= today && today <= s.endsOn)
  const seasonDay = liveSeason
    ? Math.round((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${liveSeason.startsOn}T00:00:00Z`).getTime()) / DAY_MS) + 1
    : null

  return (
    <div className="screen pb-2">
      <header className="flex items-center justify-between gap-3">
        <h1 className="h-display">Today</h1>
        <span className="chip bg-lime">
          {liveSeason && seasonDay ? `Season ${liveSeason.number} · day ${seasonDay}` : group.name}
        </span>
      </header>

      {endedSeason && (
        <Link to={`/g/${group.id}/wrapped/${endedSeason.id}`} className="tile tile-sm bg-lime flex items-center justify-between gap-3 no-underline">
          <span className="font-bold">Season {endedSeason.number} Wrapped is ready</span>
          <span className="chip bg-ink" aria-hidden="true">See it</span>
        </Link>
      )}

      {error && (
        <div className="flex flex-col gap-2">
          <p className="tile" role="alert">{error}</p>
          <button className="btn" onClick={() => setTick((t) => t + 1)}>Try again</button>
        </div>
      )}

      {!error && battles === null && <p className="sub">Loading today's battles</p>}

      {battles !== null && (
        <>
          <section className="flex flex-col gap-2.5" aria-label="Today's battles">
            {todays.length === 0 ? (
              <p className="tile bg-lavender">No battle today. Matches come out at {group.revealTime}.</p>
            ) : (
              todays.map((r) =>
                r.phase === 'upcoming' ? (
                  <Hidden key={r.view.record.id} row={r} />
                ) : (
                  <Fixture key={r.view.record.id} row={r} members={memberMap} viewerId={uid} />
                ),
              )
            )}
          </section>

          <div className="grid grid-cols-3 gap-2" aria-label="Daily times">
            <div className="tile tile-sm bg-mint">
              <b className="block font-display text-name font-extrabold">{group.revealTime}</b>
              <small className="text-caption font-semibold">Matches out</small>
            </div>
            <div className="tile tile-sm bg-pink">
              <b className="block font-display text-name font-extrabold">{group.postDeadlineTime}</b>
              <small className="text-caption font-semibold">Post by</small>
            </div>
            <div className="tile tile-sm bg-sky">
              <b className="block font-display text-name font-extrabold">{group.resultsTime}</b>
              <small className="text-caption font-semibold">Results</small>
            </div>
          </div>

          {upcoming.length > 0 && (
            <section className="flex flex-col gap-2.5" aria-label="Upcoming battles">
              <h2 className="h-tile mt-2">Coming up</h2>
              {upcoming.map((r) => (
                <Hidden key={r.view.record.id} row={r} />
              ))}
            </section>
          )}

          {past.length > 0 && (
            <section className="flex flex-col gap-2.5" aria-label="Past results">
              <h2 className="h-tile mt-2">Past results</h2>
              {past.map((r) => (
                <PastRow key={r.view.record.id} row={r} members={memberMap} />
              ))}
            </section>
          )}
        </>
      )}

      {isAdmin && (
        <section className="flex flex-col gap-2.5" aria-label="Admin">
          <Link to={`/g/${group.id}/new-battle`} className="btn">New battle</Link>
          <InviteQr url={`${window.location.origin}/j/${group.inviteCode}`} label={`Invite friends to ${group.name}`} />
        </section>
      )}
    </div>
  )
}
