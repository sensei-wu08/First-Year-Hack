import { useState } from 'react'
import { TONE_RULE } from '../brand'
import { validateComment } from '../lib/validate'
import type { BattleView, Member, Side, VoteBlock } from '../lib/types'
import { FitSide, VersusSeam } from './VersusSeam'

export const BLOCK_MESSAGES: Record<Exclude<VoteBlock, 'ok'>, string> = {
  battler: "You're in this battle, so you can't vote in it",
  not_open: 'Voting opens when both fits are in',
  closed: 'Voting has closed on this battle',
  not_allowed: 'Only group members can vote on this battle',
  already_voted: "You've already voted in this battle",
}

function messageFor(code: string): string {
  if (code === 'name') return 'Check your name and try again'
  return code in BLOCK_MESSAGES
    ? BLOCK_MESSAGES[code as Exclude<VoteBlock, 'ok'>]
    : "Couldn't send your vote. Try again."
}

function votesLabel(total: number): string {
  return `${total} ${total === 1 ? 'vote' : 'votes'} so far`
}

/**
 * Side-by-side voting. Tap a side to pick it (it lifts and gets a ring), optionally comment, then vote.
 * After voting it shows who you backed and how many votes are in so far (never the split).
 */
export function VoteSplit({
  view,
  players,
  block,
  commentsEnabled,
  mySide,
  onVote,
}: {
  view: BattleView
  players: Member[]
  block: VoteBlock
  commentsEnabled: boolean
  mySide: Side | null
  onVote(side: Side, comment: string | null): Promise<void> | void
}) {
  const [picked, setPicked] = useState<Side | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justVoted, setJustVoted] = useState<Side | null>(null)

  const { playerA, playerB } = view.record
  const member = (id: string): Member => players.find((p) => p.id === id) ?? { id, name: 'Player', emoji: '🙂' }
  const people: Record<Side, Member> = { a: member(playerA), b: member(playerB) }
  const postOf = (id: string) => view.posts.find((p) => p.profileId === id) ?? null

  const voted = mySide ?? justVoted
  const canPick = block === 'ok' && !voted
  const shown = voted ?? picked
  const dim: Side | null = shown ? (shown === 'a' ? 'b' : 'a') : null

  function sideNode(side: Side) {
    const m = people[side]
    return (
      <>
        <FitSide member={m} post={postOf(m.id)} note="Waiting for this fit" />
        {voted === side && <span className="chip bg-ink versus-chip">Your pick</span>}
        {canPick && (
          <button
            type="button"
            className="versus-hit"
            aria-pressed={picked === side}
            aria-label={`Pick ${m.name}'s fit`}
            onClick={() => setPicked(side)}
          />
        )}
      </>
    )
  }

  async function submit() {
    if (!picked || busy) return
    setBusy(true)
    setError(null)
    try {
      await onVote(picked, commentsEnabled ? validateComment(comment) : null)
      setJustVoted(picked)
    } catch (e) {
      setError(messageFor(e instanceof Error ? e.message : ''))
    } finally {
      setBusy(false)
    }
  }

  const backed = voted ? people[voted] : null

  return (
    <div className="flex flex-col gap-3">
      {canPick && (
        <div className="tile bg-lime">
          <h2 className="h-tile">Who wore it better?</h2>
          <p className="sub mt-1">Tap a fit, then vote. Votes are anonymous.</p>
        </div>
      )}

      <VersusSeam
        left={sideNode('a')}
        right={sideNode('b')}
        badge="vs"
        dim={dim}
        picked={shown}
      />

      {voted ? (
        <div className="tile bg-white" role="status">
          <p className="h-tile">{backed ? `You voted for ${backed.name}` : "You've already voted"}</p>
          <p className="sub mt-1">{votesLabel(view.tally.total)}. Results come when voting closes.</p>
        </div>
      ) : block !== 'ok' ? (
        <div className="tile bg-white" role="status">
          <p className="h-tile">{BLOCK_MESSAGES[block]}</p>
          {view.tally.total > 0 && <p className="sub mt-1">{votesLabel(view.tally.total)}</p>}
        </div>
      ) : (
        <>
          {commentsEnabled && (
            <textarea
              className="input h-16"
              aria-label="Comment"
              placeholder={TONE_RULE}
              maxLength={280}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          )}
          {error && (
            <p className="tile bg-white" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="btn" disabled={!picked || busy} onClick={submit}>
            {busy ? 'Sending your vote' : picked ? `Vote for ${people[picked].name}` : 'Pick a fit to vote'}
          </button>
        </>
      )}
    </div>
  )
}
