import { closeAt } from './phase'
import type { BattleFacts, BattleResult } from './types'

const WIN = 3
const DRAW = 1
const LOSS = 0
const FORFEIT = -1

/**
 * The result of a battle at `now`, or null while it is still open.
 * Resolves at `closeAt` (inclusive); a voided battle resolves at `voidedAt` with no points.
 */
export function scoreBattle(f: BattleFacts, now: Date): BattleResult | null {
  const { battle } = f

  if (battle.voidedAt !== null) {
    return { battleId: battle.id, resolvedAt: battle.voidedAt, kind: 'void', outcomes: {}, points: {}, share: null }
  }

  const resolvedAt = closeAt(battle)
  if (now.getTime() < resolvedAt.getTime()) return null

  const { playerA: a, playerB: b } = battle
  const postedA = f.mediaA !== null
  const postedB = f.mediaB !== null

  if (!postedA && !postedB) {
    return {
      battleId: battle.id,
      resolvedAt,
      kind: 'void_both',
      outcomes: { [a]: 'F', [b]: 'F' },
      points: { [a]: FORFEIT, [b]: FORFEIT },
      share: null,
    }
  }

  if (postedA !== postedB) {
    const [winner, loser] = postedA ? [a, b] : [b, a]
    return {
      battleId: battle.id,
      resolvedAt,
      kind: 'forfeit',
      outcomes: { [winner]: 'W', [loser]: 'F' },
      points: { [winner]: WIN, [loser]: FORFEIT },
      share: null,
    }
  }

  const total = f.votesA + f.votesB
  const share = total > 0 ? { a: f.votesA / total, b: f.votesB / total } : null
  if (f.votesA === f.votesB) {
    return {
      battleId: battle.id,
      resolvedAt,
      kind: 'played',
      outcomes: { [a]: 'D', [b]: 'D' },
      points: { [a]: DRAW, [b]: DRAW },
      share,
    }
  }
  const [winner, loser] = f.votesA > f.votesB ? [a, b] : [b, a]
  return {
    battleId: battle.id,
    resolvedAt,
    kind: 'played',
    outcomes: { [winner]: 'W', [loser]: 'L' },
    points: { [winner]: WIN, [loser]: LOSS },
    share,
  }
}

/** Every resolved battle's result, oldest resolution first. */
export function resolveAll(facts: BattleFacts[], now: Date): BattleResult[] {
  return facts
    .map((f) => scoreBattle(f, now))
    .filter((r): r is BattleResult => r !== null)
    .sort((x, y) => x.resolvedAt.getTime() - y.resolvedAt.getTime())
}
