import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { ResultsReveal } from '../components/ResultsReveal'
import { FitSide, VersusSeam } from '../components/VersusSeam'
import { VoteSplit } from '../components/VoteSplit'
import { ensureSession, upsertProfile } from '../data/auth'
import { postedOf, toFacts } from '../data/mappers'
import {
  castVote,
  formatCountdown,
  formatWhen,
  getShareBattle,
  myVote,
  useNow,
  usePoll,
} from '../data/votes'
import type { ShareBattle } from '../data/votes'
import { battlePhase, voteEligibility } from '../lib/phase'
import { scoreBattle } from '../lib/scoring'
import type { Member, Side } from '../lib/types'
import { validateName } from '../lib/validate'

interface Loaded {
  share: ShareBattle
  uid: string
  mine: Side | null
}

async function loadShare(code: string): Promise<Loaded | null> {
  // Silent sign-in: share voters never see onboarding.
  const uid = await ensureSession()
  const share = await getShareBattle(code)
  if (!share) return null
  const mine = await myVote(share.view.record.id)
  return { share, uid, mine }
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

/** Public vote page for /v/:shareCode. No account, no onboarding, optional name. */
export default function ShareVote() {
  const { shareCode = '' } = useParams()
  const load = useCallback(() => loadShare(shareCode), [shareCode])
  const { data, error, loaded, reload } = usePoll(
    load,
    (d) => d === null || d.share.view.tally.votesA !== null || d.share.view.record.voidedAt !== null,
  )
  const now = useNow(1000)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)

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
          <p className="h-tile">{error ? "Couldn't open this battle" : "This battle isn't open to public voting."}</p>
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

  const { share, uid, mine } = data
  const { view, group, comments } = share
  const { record } = view
  const member = (id: string): Member => share.players.find((m) => m.id === id) ?? { id, name: 'Player', emoji: '🙂' }
  const players = [member(record.playerA), member(record.playerB)]
  const posted = postedOf(view)
  const phase = battlePhase(record, posted, now)
  const block = voteEligibility({
    phase,
    viewerId: uid,
    battle: record,
    isMember: false,
    shareVotingAllowed: true,
    alreadyVoted: mine !== null,
  })
  const postOf = (id: string) => view.posts.find((p) => p.profileId === id) ?? null
  const counting = phase === 'results' && view.tally.votesA === null && posted.a && posted.b

  async function handleVote(side: Side, comment: string | null) {
    try {
      if (name.trim()) {
        const v = validateName(name)
        if (!v.ok) {
          setNameError(v.error)
          throw new Error('name')
        }
        setNameError(null)
        await upsertProfile(v.value, '👀')
      }
      await castVote(record.id, side, comment)
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
    body = (
      <>
        {staticSeam}
        <div className="tile bg-lime">
          <p className="h-tile">The fits are being posted</p>
          <p className="sub mt-1">Voting opens when both fits are in. This page updates by itself.</p>
        </div>
      </>
    )
  } else if (phase === 'voting') {
    body = (
      <>
        {block === 'ok' && (
          <>
            <input
              className="input"
              aria-label="Your name"
              placeholder="Your name (optional, shown with your comment)"
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {nameError && (
              <p className="sub" role="alert">
                {nameError}
              </p>
            )}
          </>
        )}
        <VoteSplit
          view={view}
          players={players}
          block={block}
          commentsEnabled={group.commentsEnabled}
          mySide={mine}
          onVote={handleVote}
        />
      </>
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
      </div>
    )
  }

  return (
    <Frame>
      <p className="sub">{group.name}</p>
      {phase !== 'results' && (
        <h1 className="h-display">
          {players[0].name} vs {players[1].name}
        </h1>
      )}
      {body}
    </Frame>
  )
}
