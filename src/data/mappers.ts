import type { BattleFacts, BattleView } from '../lib/types'

export function postedOf(v: BattleView): { a: boolean; b: boolean } {
  return {
    a: v.posts.some((p) => p.profileId === v.record.playerA),
    b: v.posts.some((p) => p.profileId === v.record.playerB),
  }
}

export function toFacts(v: BattleView): BattleFacts {
  const mediaOf = (id: string) => v.posts.find((p) => p.profileId === id)?.mediaUrl ?? null
  return {
    battle: v.record,
    mediaA: mediaOf(v.record.playerA),
    mediaB: mediaOf(v.record.playerB),
    votesA: v.tally.votesA ?? 0,
    votesB: v.tally.votesB ?? 0,
  }
}
