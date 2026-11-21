import type { BattleResult, BattleView, CommentView, Member, Side } from '../lib/types'
import { CommentList } from './CommentList'
import { FitSide, VersusSeam } from './VersusSeam'

function pointsText(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `−${Math.abs(n)}`
  return '0'
}

/**
 * The results moment: bars fill out from the seam, then the winner's side expands and the stamp lands.
 * The motion is pure CSS (see theme.css) and is skipped under prefers-reduced-motion.
 */
export function ResultsReveal({
  view,
  players,
  result,
  comments,
}: {
  view: BattleView
  players: Member[]
  result: BattleResult | null
  comments: CommentView[]
}) {
  const { playerA, playerB } = view.record
  const member = (id: string): Member => players.find((p) => p.id === id) ?? { id, name: 'Player', emoji: '🙂' }
  const people: Record<Side, Member> = { a: member(playerA), b: member(playerB) }
  const postOf = (id: string) => view.posts.find((p) => p.profileId === id) ?? null

  const votesA = view.tally.votesA ?? 0
  const votesB = view.tally.votesB ?? 0
  const total = view.tally.total
  // result.share is {a, b} as fractions of 1 (e.g. 0.625); fall back to the raw counts when it is null.
  const fracA = result?.share ? result.share.a : total > 0 ? votesA / total : 0
  const hasSplit = result?.share != null || total > 0
  const pctA = hasSplit ? Math.round(100 * fracA) : 0
  const pctB = hasSplit ? 100 - pctA : 0

  const kind = result?.kind ?? 'played'
  const winner: Side | null =
    result?.outcomes[playerA] === 'W' ? 'a' : result?.outcomes[playerB] === 'W' ? 'b' : null
  const forfeited = (['a', 'b'] as Side[]).filter((s) => result?.outcomes[people[s].id] === 'F')
  const stampPoints = winner && result ? result.points[people[winner].id] : null
  const showScore = kind === 'played'

  function sideNode(side: Side) {
    const m = people[side]
    const post = postOf(m.id)
    const forfeit = forfeited.includes(side)
    return (
      <>
        <FitSide
          member={m}
          post={post}
          label={winner === side ? `${m.name} wins` : m.name}
          note={forfeit ? "Didn't post in time" : 'No fit posted'}
        />
        {winner === side && stampPoints !== null && (
          <span className={`reveal-stamp reveal-stamp-${side}`}>{pointsText(stampPoints)}</span>
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="h-display">{kind === 'void' || kind === 'void_both' ? 'No contest' : 'Full time'}</h1>
        <span className="chip bg-lime">
          {total} {total === 1 ? 'person' : 'people'} voted
        </span>
      </div>

      {showScore ? (
        <div className="tile bg-white">
          <div className="flex items-center justify-between gap-2">
            <span className="vr-score vr-score-home">{votesA}</span>
            <span className="vr-vs-names">
              {people.a.name}
              <br />
              vs {people.b.name}
            </span>
            <span className="vr-score vr-score-away">{votesB}</span>
          </div>
          <div className={`reveal-bars${hasSplit ? "" : " reveal-bars-still"}`} role="img" aria-label={`${people.a.name} ${pctA} percent, ${people.b.name} ${pctB} percent`}>
            <div className="reveal-bar reveal-bar-home" style={{ width: `${pctA}%` }} />
            <div className="reveal-bar reveal-bar-away" style={{ width: `${pctB}%` }} />
          </div>
          <div className="flex justify-between vr-pct">
            <span>{pctA}%</span>
            <span>{pctB}%</span>
          </div>
          {total === 0 ? (
            <p className="sub mt-1">No votes, so it counts as a draw.</p>
          ) : (
            !winner && <p className="sub mt-1">It's a draw.</p>
          )}
        </div>
      ) : (
        <div className="tile bg-white">
          {kind === 'forfeit' && forfeited.length > 0 ? (
            forfeited.map((s) => (
              <p key={s} className="h-tile">
                {people[s].name} didn't post in time
              </p>
            ))
          ) : kind === 'void_both' ? (
            <p className="h-tile">Neither fit was posted, so this battle is void</p>
          ) : (
            <p className="h-tile">This battle was voided</p>
          )}
        </div>
      )}

      <VersusSeam left={sideNode('a')} right={sideNode('b')} badge="vs" winner={winner} />

      {result && (
        <ul className="grid grid-cols-2 gap-2" aria-label="Points">
          {(['a', 'b'] as Side[]).map((s) => {
            const pts = result.points[people[s].id] ?? 0
            return (
              <li key={s} className="tile tile-sm bg-white vr-points">
                <span className="vr-points-name">
                  {people[s].emoji} {people[s].name}
                </span>
                <span className={`vr-points-value${pts < 0 ? ' vr-down' : ''}`}>{pointsText(pts)}</span>
              </li>
            )
          })}
        </ul>
      )}

      <CommentList comments={comments} />
    </div>
  )
}
