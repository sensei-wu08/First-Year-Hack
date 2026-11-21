import type { BattleRecord, Phase, VoteBlock } from './types'

/** The instant voting ends: `closedAt` if it is earlier than `resultsAt`, else `resultsAt`. */
export function closeAt(b: BattleRecord): Date {
  return b.closedAt !== null && b.closedAt.getTime() < b.resultsAt.getTime() ? b.closedAt : b.resultsAt
}

export function battlePhase(b: BattleRecord, posted: { a: boolean; b: boolean }, now: Date): Phase {
  if (b.voidedAt !== null) return 'void'
  if (now.getTime() < b.revealAt.getTime()) return 'upcoming'
  if (now.getTime() >= closeAt(b).getTime()) return 'results'
  if (posted.a && posted.b) return 'voting'
  if (now.getTime() < b.postDeadline.getTime()) return 'posting'
  return 'awaiting_results'
}

export function voteEligibility(a: {
  phase: Phase
  viewerId: string
  battle: BattleRecord
  isMember: boolean
  shareVotingAllowed: boolean
  alreadyVoted: boolean
}): VoteBlock {
  if (a.viewerId === a.battle.playerA || a.viewerId === a.battle.playerB) return 'battler'
  if (!a.isMember && !a.shareVotingAllowed) return 'not_allowed'
  if (a.phase === 'results' || a.phase === 'void') return 'closed'
  if (a.phase !== 'voting') return 'not_open'
  if (a.alreadyVoted) return 'already_voted'
  return 'ok'
}
