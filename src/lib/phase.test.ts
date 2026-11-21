import { describe, expect, test } from 'vitest'
import { battlePhase, closeAt, voteEligibility } from './phase'
import type { BattleRecord } from './types'

const at = (hh: number, mm = 0, ms = 0) => new Date(2026, 10, 21, hh, mm, 0, ms)

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

const none = { a: false, b: false }
const one = { a: true, b: false }
const both = { a: true, b: true }

describe('closeAt', () => {
  test('resultsAt when not closed early', () => {
    expect(closeAt(mk())).toEqual(at(18))
  })
  test('closedAt when earlier than resultsAt', () => {
    expect(closeAt(mk({ closedAt: at(15) }))).toEqual(at(15))
  })
  test('resultsAt when closedAt is later', () => {
    expect(closeAt(mk({ closedAt: at(20) }))).toEqual(at(18))
  })
})

describe('battlePhase', () => {
  test('upcoming before reveal', () => {
    expect(battlePhase(mk(), none, at(8, 59))).toBe('upcoming')
  })
  test('posting after reveal with one post', () => {
    expect(battlePhase(mk(), one, at(10))).toBe('posting')
    expect(battlePhase(mk(), none, at(9))).toBe('posting')
  })
  test('voting as soon as both posted (10:30)', () => {
    expect(battlePhase(mk(), both, at(10, 30))).toBe('voting')
  })
  test('awaiting_results after deadline with one post', () => {
    expect(battlePhase(mk(), one, at(13))).toBe('awaiting_results')
    expect(battlePhase(mk(), one, at(12))).toBe('awaiting_results')
  })
  test('results at exactly resultsAt', () => {
    expect(battlePhase(mk(), both, at(18))).toBe('results')
    expect(battlePhase(mk(), both, new Date(at(18).getTime() - 1))).toBe('voting')
  })
  test('early closedAt makes results', () => {
    const b = mk({ closedAt: at(15) })
    expect(battlePhase(b, both, at(14, 59))).toBe('voting')
    expect(battlePhase(b, both, at(15))).toBe('results')
    expect(battlePhase(mk({ closedAt: at(11) }), one, at(11))).toBe('results')
  })
  test('voided wins over everything', () => {
    const b = mk({ voidedAt: at(10), closedAt: at(11) })
    expect(battlePhase(b, both, at(8))).toBe('void')
    expect(battlePhase(b, both, at(19))).toBe('void')
  })
})

describe('voteEligibility', () => {
  const base = {
    phase: 'voting' as const,
    viewerId: 'C',
    battle: mk(),
    isMember: true,
    shareVotingAllowed: false,
    alreadyVoted: false,
  }
  test('battler A is blocked even with share on', () => {
    expect(voteEligibility({ ...base, viewerId: 'A', shareVotingAllowed: true })).toBe('battler')
    expect(voteEligibility({ ...base, viewerId: 'B', phase: 'results' })).toBe('battler')
  })
  test('non-member with share off is not_allowed', () => {
    expect(voteEligibility({ ...base, isMember: false })).toBe('not_allowed')
  })
  test('non-member with share on during voting is ok', () => {
    expect(voteEligibility({ ...base, isMember: false, shareVotingAllowed: true })).toBe('ok')
  })
  test('member during posting is not_open', () => {
    expect(voteEligibility({ ...base, phase: 'posting' })).toBe('not_open')
    expect(voteEligibility({ ...base, phase: 'upcoming' })).toBe('not_open')
    expect(voteEligibility({ ...base, phase: 'awaiting_results' })).toBe('not_open')
  })
  test('closed once results or void', () => {
    expect(voteEligibility({ ...base, phase: 'results' })).toBe('closed')
    expect(voteEligibility({ ...base, phase: 'void' })).toBe('closed')
    expect(voteEligibility({ ...base, phase: 'results', alreadyVoted: true })).toBe('closed')
  })
  test('already voted', () => {
    expect(voteEligibility({ ...base, alreadyVoted: true })).toBe('already_voted')
  })
  test('member during voting is ok', () => {
    expect(voteEligibility(base)).toBe('ok')
  })
})
