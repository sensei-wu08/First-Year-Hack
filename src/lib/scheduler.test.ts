import { describe, expect, test } from 'vitest'
import { mulberry32, shuffle } from './rng'
import { defaultBattlesPerDay, redateRemaining, scheduleSeason, type DayTimes } from './scheduler'
import { addDays, localDateKey } from './time'

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `m${i + 1}`)
const times: DayTimes = { reveal: '09:00', postDeadline: '12:00', results: '18:00' }
const pairKey = (a: string, b: string): string => [a, b].sort().join('|')

describe('rng', () => {
  test('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const xs = Array.from({ length: 50 }, () => a())
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()))
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
  })

  test('shuffle returns a permuted copy and leaves the input alone', () => {
    const input = ids(10)
    const out = shuffle(input, mulberry32(7))
    expect(input).toEqual(ids(10))
    expect(out).not.toBe(input)
    expect([...out].sort()).toEqual([...input].sort())
  })
})

test('defaultBattlesPerDay follows the member-count table', () => {
  expect([2, 3, 8, 10, 12, 14, 15, 25, 26, 40, 41].map(defaultBattlesPerDay)).toEqual([1, 1, 1, 2, 3, 4, 2, 2, 3, 3, 4])
  expect(defaultBattlesPerDay(1)).toBe(0)
  expect(defaultBattlesPerDay(0)).toBe(0)
})

describe('scheduleSeason', () => {
  test('8 members: 28 battles, every pair once, 28 consecutive days from startDate', () => {
    const s = scheduleSeason({ memberIds: ids(8), startDate: '2026-10-01', battlesPerDay: 1, times, rng: mulberry32(1) })
    expect(s).toHaveLength(28)
    const keys = s.map((b) => pairKey(b.playerA, b.playerB))
    expect(new Set(keys).size).toBe(28)
    expect(s.every((b) => b.playerA !== b.playerB)).toBe(true)
    expect(s.map((b) => b.date)).toEqual(Array.from({ length: 28 }, (_, i) => addDays('2026-10-01', i)))
  })

  test('7 members: 21 battles with a bye', () => {
    const s = scheduleSeason({ memberIds: ids(7), startDate: '2026-10-01', battlesPerDay: 1, times, rng: mulberry32(2) })
    expect(s).toHaveLength(21)
    expect(new Set(s.map((b) => pairKey(b.playerA, b.playerB))).size).toBe(21)
    expect(s.every((b) => ids(7).includes(b.playerA) && ids(7).includes(b.playerB))).toBe(true)
  })

  test('10 members at 2/day: nobody twice on a day', () => {
    const s = scheduleSeason({ memberIds: ids(10), startDate: '2026-10-01', battlesPerDay: 2, times, rng: mulberry32(3) })
    expect(s).toHaveLength(45)
    expect(new Set(s.map((b) => pairKey(b.playerA, b.playerB))).size).toBe(45)
    const byDay = new Map<string, string[]>()
    for (const b of s) byDay.set(b.date, [...(byDay.get(b.date) ?? []), b.playerA, b.playerB])
    for (const players of byDay.values()) {
      expect(new Set(players).size).toBe(players.length)
      expect(players.length / 2).toBeLessThanOrEqual(2)
    }
  })

  test('fewer than 2 members gives no battles', () => {
    expect(scheduleSeason({ memberIds: ids(1), startDate: '2026-10-01', battlesPerDay: 1, times, rng: mulberry32(1) })).toEqual([])
    expect(scheduleSeason({ memberIds: [], startDate: '2026-10-01', battlesPerDay: 1, times, rng: mulberry32(1) })).toEqual([])
  })

  test('keeps local times across DST', () => {
    const s = scheduleSeason({ memberIds: ids(8), startDate: '2026-10-01', battlesPerDay: 1, times, rng: mulberry32(1) })
    expect(s.some((b) => b.date === '2026-10-26')).toBe(true) // spans the 25 Oct clocks change
    expect(s.every((b) => b.revealAt.getHours() === 9 && b.resultsAt.getHours() === 18)).toBe(true)
    expect(s.every((b) => b.postDeadline.getHours() === 12 && localDateKey(b.revealAt) === b.date)).toBe(true)
  })

  test('same seed same schedule, different seed different order', () => {
    const run = (seed: number) =>
      scheduleSeason({ memberIds: ids(8), startDate: '2026-10-01', battlesPerDay: 1, times, rng: mulberry32(seed) })
    expect(run(5)).toEqual(run(5))
    const order = (seed: number) => run(seed).map((b) => `${b.playerA}${b.playerB}`)
    expect(order(5)).not.toEqual(order(6))
  })
})

describe('redateRemaining', () => {
  test('keeps pairs and order, re-dates from fromDate at new times', () => {
    const battles = ids(10).flatMap((a, i, all) => all.slice(i + 1).map((b) => ({ id: `${a}-${b}`, playerA: a, playerB: b })))
    const newTimes: DayTimes = { reveal: '10:30', postDeadline: '14:00', results: '20:00' }
    const out = redateRemaining({ battles, fromDate: '2026-11-01', battlesPerDay: 2, times: newTimes })
    expect(out).toHaveLength(45)
    expect(new Set(out.map((o) => o.id))).toEqual(new Set(battles.map((b) => b.id)))
    expect(out[0].date).toBe('2026-11-01')
    expect(out.every((o) => o.date >= '2026-11-01')).toBe(true)
    expect(out.every((o) => o.revealAt.getHours() === 10 && o.revealAt.getMinutes() === 30 && o.resultsAt.getHours() === 20)).toBe(true)
    // nobody twice on a day, and days never go backwards
    const byId = new Map(battles.map((b) => [b.id, b]))
    const used = new Map<string, Set<string>>()
    let last = ''
    for (const o of out) {
      expect(o.date >= last).toBe(true)
      last = o.date
      const s = used.get(o.date) ?? new Set<string>()
      const b = byId.get(o.id)!
      expect(s.has(b.playerA) || s.has(b.playerB)).toBe(false)
      s.add(b.playerA).add(b.playerB)
      used.set(o.date, s)
    }
  })

  test('packs in the given order: first pair is always on fromDate', () => {
    const battles = [
      { id: 'x', playerA: 'a', playerB: 'b' },
      { id: 'y', playerA: 'a', playerB: 'c' },
      { id: 'z', playerA: 'd', playerB: 'e' },
    ]
    const out = redateRemaining({ battles, fromDate: '2026-11-01', battlesPerDay: 2, times })
    expect(out.map((o) => [o.id, o.date])).toEqual([
      ['x', '2026-11-01'],
      ['z', '2026-11-01'],
      ['y', '2026-11-02'],
    ])
  })
})
