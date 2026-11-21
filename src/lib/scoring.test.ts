import { describe, expect, test } from 'vitest'
import { resolveAll, scoreBattle } from './scoring'
import type { BattleFacts, BattleRecord } from './types'

const at = (hh: number, mm = 0, ms = 0) => new Date(2026, 10, 21, hh, mm, 0, ms)
const after = at(19)

function mk(over: Partial<BattleRecord> = {}): BattleRecord {
  return {
    id: 'b1',
    groupId: 'g1',
    seasonId: null,
    playerA: 'A',
    playerB: 'B',
    revealAt: at(9),
    postDeadline: at(12),
    resultsAt: at(18),
    closedAt: null,
    voidedAt: null,
    shareCode: 'share',
    ...over,
  }
}

function facts(over: Partial<Omit<BattleFacts, 'battle'>> & { battle?: Partial<BattleRecord> } = {}): BattleFacts {
  const { battle, ...rest } = over
  return { battle: mk(battle), mediaA: 'a.jpg', mediaB: 'b.jpg', votesA: 0, votesB: 0, ...rest }
}

describe('scoreBattle', () => {
  test('5-3 win', () => {
    const r = scoreBattle(facts({ votesA: 5, votesB: 3 }), after)!
    expect(r.kind).toBe('played')
    expect(r.points).toEqual({ A: 3, B: 0 })
    expect(r.outcomes).toEqual({ A: 'W', B: 'L' })
    expect(r.share).toEqual({ a: 0.625, b: 0.375 })
    expect(r.resolvedAt).toEqual(at(18))
    expect(r.battleId).toBe('b1')
  })
  test('B wins', () => {
    const r = scoreBattle(facts({ votesA: 1, votesB: 2 }), after)!
    expect(r.points).toEqual({ A: 0, B: 3 })
    expect(r.outcomes).toEqual({ A: 'L', B: 'W' })
  })
  test('4-4 draw', () => {
    const r = scoreBattle(facts({ votesA: 4, votesB: 4 }), after)!
    expect(r.points).toEqual({ A: 1, B: 1 })
    expect(r.outcomes).toEqual({ A: 'D', B: 'D' })
    expect(r.share).toEqual({ a: 0.5, b: 0.5 })
  })
  test('0-0 with both posted is a draw', () => {
    const r = scoreBattle(facts(), after)!
    expect(r.kind).toBe('played')
    expect(r.points).toEqual({ A: 1, B: 1 })
    expect(r.share).toBeNull()
  })
  test('only A posted: A wins 3, B forfeits -1', () => {
    const r = scoreBattle(facts({ mediaB: null }), after)!
    expect(r.kind).toBe('forfeit')
    expect(r.points).toEqual({ A: 3, B: -1 })
    expect(r.outcomes).toEqual({ A: 'W', B: 'F' })
    expect(r.share).toBeNull()
  })
  test('only B posted: B wins 3, A forfeits -1', () => {
    const r = scoreBattle(facts({ mediaA: null }), after)!
    expect(r.points).toEqual({ A: -1, B: 3 })
    expect(r.outcomes).toEqual({ A: 'F', B: 'W' })
  })
  test('neither posted: both -1, void_both', () => {
    const r = scoreBattle(facts({ mediaA: null, mediaB: null }), after)!
    expect(r.kind).toBe('void_both')
    expect(r.points).toEqual({ A: -1, B: -1 })
    expect(r.outcomes).toEqual({ A: 'F', B: 'F' })
    expect(r.share).toBeNull()
  })
  test('voidedAt: kind void, no points', () => {
    const r = scoreBattle(facts({ battle: { voidedAt: at(10) } }), after)!
    expect(r.kind).toBe('void')
    expect(r.points).toEqual({})
    expect(r.outcomes).toEqual({})
    expect(r.share).toBeNull()
    expect(r.resolvedAt).toEqual(at(10))
  })
  test('not resolved before close returns null', () => {
    expect(scoreBattle(facts({ votesA: 5 }), at(17, 59))).toBeNull()
    expect(scoreBattle(facts(), at(8))).toBeNull()
  })
  test('resolves early close during voting', () => {
    const r = scoreBattle(facts({ votesA: 2, votesB: 1, battle: { closedAt: at(15) } }), at(15, 5))!
    expect(r.outcomes).toEqual({ A: 'W', B: 'L' })
    expect(r.resolvedAt).toEqual(at(15))
  })
  test('resolves early close during posting as forfeit', () => {
    const r = scoreBattle(facts({ mediaA: null, battle: { closedAt: at(11) } }), at(11))!
    expect(r.kind).toBe('forfeit')
    expect(r.points).toEqual({ A: -1, B: 3 })
    expect(r.resolvedAt).toEqual(at(11))
  })
  test('boundary instants', () => {
    expect(scoreBattle(facts(), at(18))).not.toBeNull()
    expect(scoreBattle(facts(), new Date(at(18).getTime() - 1))).toBeNull()
    expect(scoreBattle(facts({ battle: { closedAt: at(15) } }), at(15))).not.toBeNull()
  })
})

describe('resolveAll', () => {
  test('returns resolved results sorted by resolvedAt ascending', () => {
    const late = facts({ battle: { id: 'late' }, votesA: 1 })
    const early = facts({ battle: { id: 'early', closedAt: at(14) }, votesB: 1 })
    const pending = facts({ battle: { id: 'pending', resultsAt: at(23) } })
    const voided = facts({ battle: { id: 'void', voidedAt: at(10) } })
    const out = resolveAll([late, early, pending, voided], after)
    expect(out.map((r) => r.battleId)).toEqual(['void', 'early', 'late'])
  })
  test('empty input', () => {
    expect(resolveAll([], after)).toEqual([])
  })
})
