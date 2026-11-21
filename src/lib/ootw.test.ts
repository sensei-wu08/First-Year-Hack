import { describe, expect, test } from 'vitest'
import { outfitOfTheWeekAwards } from './ootw'
import type { BattleFacts, BattleResult } from './types'

// Week Mon 2026-11-16 to Sun 2026-11-22 (GMT, TZ=Europe/London in vitest).
function played(id: string, a: string, b: string, votesA: number, votesB: number, resolvedAt: Date) {
  const total = votesA + votesB
  const facts: BattleFacts = {
    battle: {
      id,
      groupId: 'g',
      seasonId: null,
      playerA: a,
      playerB: b,
      revealAt: new Date(resolvedAt.getTime() - 9 * 3600_000),
      postDeadline: new Date(resolvedAt.getTime() - 6 * 3600_000),
      resultsAt: resolvedAt,
      closedAt: null,
      voidedAt: null,
      shareCode: id,
    },
    mediaA: 'a.jpg',
    mediaB: 'b.jpg',
    votesA,
    votesB,
  }
  const aWins = votesA > votesB
  const draw = votesA === votesB
  const result: BattleResult = {
    battleId: id,
    resolvedAt,
    kind: 'played',
    outcomes: { [a]: draw ? 'D' : aWins ? 'W' : 'L', [b]: draw ? 'D' : aWins ? 'L' : 'W' },
    points: { [a]: draw ? 1 : aWins ? 3 : 0, [b]: draw ? 1 : aWins ? 0 : 3 },
    share: total === 0 ? { a: 0.5, b: 0.5 } : { a: votesA / total, b: votesB / total },
  }
  return { facts, result }
}

const forfeit = (id: string, poster: string, absent: string, resolvedAt: Date) => {
  const base = played(id, poster, absent, 0, 0, resolvedAt)
  const result: BattleResult = {
    ...base.result,
    kind: 'forfeit',
    outcomes: { [poster]: 'W', [absent]: 'F' },
    points: { [poster]: 3, [absent]: -1 },
    share: null,
  }
  return { facts: base.facts, result }
}

const wed = new Date(2026, 10, 18, 18, 0)
const thu = new Date(2026, 10, 19, 18, 0)
const sun = new Date(2026, 10, 22, 18, 0)
const afterWeek = new Date(2026, 10, 23, 12, 0)

function run(items: { facts: BattleFacts; result: BattleResult }[], now: Date) {
  return outfitOfTheWeekAwards(
    items.map((i) => i.facts),
    items.map((i) => i.result),
    now,
  )
}

describe('outfitOfTheWeekAwards', () => {
  test('highest share wins', () => {
    const awards = run([played('b1', 'ana', 'ben', 9, 1, wed), played('b2', 'cal', 'dee', 2, 1, thu)], afterWeek)
    expect(awards).toHaveLength(1)
    expect(awards[0]).toMatchObject({ profileId: 'ana', battleId: 'b1', weekStart: '2026-11-16' })
    expect(awards[0].share).toBeCloseTo(0.9)
  })

  test('needs at least 3 votes', () => {
    const awards = run([played('b1', 'ana', 'ben', 1, 0, wed), played('b2', 'cal', 'dee', 3, 1, thu)], afterWeek)
    expect(awards.map((a) => a.profileId)).toEqual(['cal'])
  })

  test('forfeit wins never qualify', () => {
    const awards = run([forfeit('b1', 'ana', 'ben', wed), played('b2', 'cal', 'dee', 3, 1, thu)], afterWeek)
    expect(awards.map((a) => a.profileId)).toEqual(['cal'])
    expect(run([forfeit('b1', 'ana', 'ben', wed)], afterWeek)).toEqual([])
  })

  test('ties all get it', () => {
    const awards = run([played('b1', 'ana', 'ben', 3, 1, wed), played('b2', 'cal', 'dee', 6, 2, thu)], afterWeek)
    expect(awards.map((a) => a.profileId).sort()).toEqual(['ana', 'cal'])
  })

  test('each week has its own winner', () => {
    const nextTue = new Date(2026, 10, 24, 18, 0)
    const awards = run(
      [played('b1', 'ana', 'ben', 9, 1, wed), played('b2', 'cal', 'dee', 3, 1, nextTue)],
      new Date(2026, 10, 30, 9, 0),
    )
    expect(awards.map((a) => [a.profileId, a.weekStart])).toEqual([
      ['ana', '2026-11-16'],
      ['cal', '2026-11-23'],
    ])
  })

  test('not awarded before Sunday', () => {
    const items = [played('b1', 'ana', 'ben', 9, 1, wed)]
    expect(run(items, new Date(2026, 10, 21, 20, 0))).toEqual([])
    const atSundayStart = run(items, new Date(2026, 10, 22, 0, 0))
    expect(atSundayStart).toHaveLength(1)
    expect(atSundayStart[0].awardedAt).toEqual(new Date(2026, 10, 22, 0, 0))
  })

  test('waits while a battle in the week is still unresolved', () => {
    const sat = played('b1', 'ana', 'ben', 9, 1, new Date(2026, 10, 21, 18, 0))
    const pending = played('b2', 'cal', 'dee', 2, 1, sun)
    // Sunday's battle has no result yet (resolveAll leaves it out), but its facts are passed in.
    const facts = [sat.facts, pending.facts]
    expect(outfitOfTheWeekAwards(facts, [sat.result], new Date(2026, 10, 22, 12, 0))).toEqual([])
    const awards = outfitOfTheWeekAwards(facts, [sat.result, pending.result], sun)
    expect(awards.map((a) => a.profileId)).toEqual(['ana'])
    expect(awards[0].awardedAt).toEqual(sun)
  })

  test('one award per profile per week even if both their outfits tie for top', () => {
    const awards = run([played('b1', 'ana', 'ben', 3, 0, wed), played('b2', 'cal', 'ana', 0, 3, thu)], afterWeek)
    expect(awards.map((a) => a.profileId)).toEqual(['ana'])
  })
})
