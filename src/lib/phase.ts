import { notImplemented } from './notImplemented'
import type { BattleRecord, Phase, VoteBlock } from './types'

// Stubs: replaced by S1. Keep the signatures.
export function closeAt(b: BattleRecord): Date {
  void b
  return notImplemented('closeAt')
}

export function battlePhase(b: BattleRecord, posted: { a: boolean; b: boolean }, now: Date): Phase {
  void b
  void posted
  void now
  return notImplemented('battlePhase')
}

export function voteEligibility(a: {
  phase: Phase
  viewerId: string
  battle: BattleRecord
  isMember: boolean
  shareVotingAllowed: boolean
  alreadyVoted: boolean
}): VoteBlock {
  void a
  return notImplemented('voteEligibility')
}
