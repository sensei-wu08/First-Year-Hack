import { memo, useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { InviteQr } from '../components/InviteQr'
import PhaseBadge from '../components/PhaseBadge'
import { PostPanel } from '../components/PostPanel'
import { ResultsReveal } from '../components/ResultsReveal'
import { FitSide, VersusSeam } from '../components/VersusSeam'
import { VoteSplit } from '../components/VoteSplit'
import { ensureSession } from '../data/auth'
import { postedOf, toFacts } from '../data/mappers'
import { getBattle, getGroup, listMembers } from '../data/reads'
import {
  castVote,
  formatCountdown,
  formatWhen,
  listComments,
  myVote,
  revealNow,
  useNow,
  usePoll,
} from '../data/votes'
import { battlePhase, voteEligibility } from '../lib/phase'
import { scoreBattle } from '../lib/scoring'
import type { BattleView, CommentView, Group, Member, Side } from '../lib/types'

const PostPanelMemo = memo(PostPanel)

interface Loaded {
  view: BattleView
  group: Group
  members: Member[]
  uid: string
  mine: Side | null
  comments: CommentView[]
}

async function loadBattle(id: string): Promise<Loaded | null> {
  const uid = await ensureSession()
  const view = await getBattle(id)
  if (!view) return null
  const [group, members, mine] = await Promise.all([
    getGroup(view.record.groupId),
    listMembers(view.record.groupId),
    myVote(id),
  ])
  // Split counts (and comments) only come back once the battle is closed.
  const closed = view.tally.votesA !== null
  const comments = closed && group.commentsEnabled ? await listComments([id]) : []
  return { view, group, members, uid, mine, comments }
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="set-vote">
      <div className="app-col">
        <div className="screen">{children}</div>
      </div>
    </div>
  )
}

/** Admin-only early close, with an inline confirm. Only rendered once the battle has opened. */
function RevealNow({ battleId, onDone }: { battleId: string; onDone(): void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true)
    setError(null)
    try {
      await revealNow(battleId)
      setConfirming(false)
      onDone()
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'not_admin'
          ? 'Only the group admin can do that'
          : "Couldn't reveal the results. Try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="btn" onClick={() => setConfirming(true)}>
        Reveal results now
      </button>
    )
  }
  return (
    <div className="tile bg-white" role="alertdialog" aria-label="Confirm reveal">
      <p className="h-tile">Reveal results now for everyone?</p>
      <p className="sub mt-1">Voting closes straight away and the points are counted.</p>
      {error && <p role="alert">{error}</p>}
      <div className="mt-3 flex flex-col gap-2">
        <button type="button" className="btn" disabled={busy} onClick={go}>
          {busy ? 'Revealing' : 'Yes, reveal now'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>
          Keep waiting
        </button>
      </div>
    </div>
  )
}

export default function Battle() {
  const { battleId = '' } = useParams()
  const load = useCallback(() => loadBattle(battleId), [battleId])
  const { data, error, loaded, reload } = usePoll(
    load,
    (d) => d === null || d.view.tally.votesA !== null || d.view.record.voidedAt !== null,
  )
  const now = useNow(1000)

  if (!loaded) {
    return (
      <Frame>
        <p className="sub">Loading the battle</p>
      </Frame>
    )
  }
  if (!data) {
    return (
      <Frame>
        <div className="tile bg-white">
          <p className="h-tile">{error ? "Couldn't open this battle" : "We can't find this battle"}</p>
          {error && <p className="sub mt-1">{error}</p>}
        </div>
        {error && (
          <button type="button" className="btn" onClick={() => void reload()}>
            Try again
          </button>
        )}
      </Frame>
    )
  }

  const { view, group, members, uid, mine, comments } = data
  const { record } = view
  const member = (id: string): Member => members.find((m) => m.id === id) ?? { id, name: 'Player', emoji: '🙂' }
  const players = [member(record.playerA), member(record.playerB)]
  const isBattler = uid === record.playerA || uid === record.playerB
  const isAdmin = uid === group.adminId
  const posted = postedOf(view)
  const phase = battlePhase(record, posted, now)
  const block = voteEligibility({
    phase,
    viewerId: uid,
    battle: record,
    isMember: true,
    shareVotingAllowed: group.allowShareVoting,
    alreadyVoted: mine !== null,
  })
  const postOf = (id: string) => view.posts.find((p) => p.profileId === id) ?? null
  // The phase flips on the clock, but split counts only arrive with the next poll.
  const counting = phase === 'results' && view.tally.votesA === null && posted.a && posted.b

  async function handleVote(side: Side, comment: string | null) {
    try {
      await castVote(battleId, side, comment)
    } finally {
      void reload()
    }
  }

  const staticSeam = (
    <VersusSeam
      left={<FitSide member={players[0]} post={postOf(players[0].id)} note="Not posted yet" />}
      right={<FitSide member={players[1]} post={postOf(players[1].id)} note="Not posted yet" />}
      badge="vs"
    />
  )

  let body: ReactNode
  if (phase === 'upcoming') {
    body = (
      <div className="tile bg-lime">
        <p className="h-tile">Fits drop at {formatWhen(record.revealAt, now)}</p>
        <p className="sub mt-1">That's in {formatCountdown(record.revealAt.getTime() - now.getTime())}.</p>
      </div>
    )
  } else if (phase === 'posting') {
    body = isBattler ? (
      <PostPanelMemo view={view} viewerId={uid} onPosted={() => void reload()} />
    ) : (
      <>
        {staticSeam}
        <div className="tile bg-lime">
          <p className="h-tile">The fits are being posted</p>
          <p className="sub mt-1">
            {players[0].name} {posted.a ? 'has posted' : "hasn't posted yet"}. {players[1].name}{' '}
            {posted.b ? 'has posted' : "hasn't posted yet"}. Voting opens when both fits are in.
          </p>
        </div>
      </>
    )
  } else if (phase === 'voting') {
    body = (
      <VoteSplit
        view={view}
        players={players}
        block={block}
        commentsEnabled={group.commentsEnabled}
        mySide={mine}
        onVote={handleVote}
      />
    )
  } else if (phase === 'awaiting_results') {
    body = (
      <>
        {staticSeam}
        <div className="tile bg-lime">
          <p className="h-tile">Voting is closed</p>
          <p className="sub mt-1">
            Results at {formatWhen(record.resultsAt, now)}, in{' '}
            {formatCountdown(record.resultsAt.getTime() - now.getTime())}.
          </p>
        </div>
      </>
    )
  } else if (phase === 'results') {
    body = counting ? (
      <div className="tile bg-lime">
        <p className="h-tile">Counting the votes</p>
      </div>
    ) : (
      <ResultsReveal view={view} players={players} result={scoreBattle(toFacts(view), now)} comments={comments} />
    )
  } else {
    body = (
      <div className="tile bg-white">
        <p className="h-tile">This battle was voided</p>
        <p className="sub mt-1">One of the players left the group before it finished.</p>
      </div>
    )
  }

  // Closing before the reveal would void the battle for both players (-1 each), so never offer it in 'upcoming'.
  const canRevealNow = isAdmin && (phase === 'posting' || phase === 'voting' || phase === 'awaiting_results')

  return (
    <Frame>
      <div className="flex items-center justify-between gap-2">
        <Link to={`/g/${group.id}`} className="chip">
          Back to {group.name}
        </Link>
        <PhaseBadge phase={phase} />
      </div>
      {phase !== 'results' && (
        <h1 className="h-display">
          {players[0].name} vs {players[1].name}
        </h1>
      )}

      {body}

      {canRevealNow && <RevealNow battleId={battleId} onDone={() => void reload()} />}
      {isAdmin && group.allowShareVoting && phase !== 'void' && (
        <InviteQr url={`${window.location.origin}/v/${record.shareCode}`} label="Public vote link" />
      )}
    </Frame>
  )
}
