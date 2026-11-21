import { describe, expect, test, vi } from 'vitest'
import type { OotwAward } from './ootw'
import { resolveAll } from './scoring'
import { buildTable, buildTableWithMovement, leagueTable } from './table'
import type { BattleFacts, BattleResult, Member, Outcome } from './types'

// leagueTable is wired to resolveAll; stub it so these tests don't depend on S1.
vi.mock('./scoring', () => ({ resolveAll: vi.fn(), scoreBattle: vi.fn() }))

const m = (id: string): Member => ({ id, name: id[0].toUpperCase() + id.slice(1), emoji: '🙂' })
const ana = m('ana')
const ben = m('ben')
const cal = m('cal')

let n = 0
function res(
  kind: BattleResult['kind'],
  outcomes: Record<string, Outcome>,
  points: Record<string, number>,
  resolvedAt = new Date(2026, 10, 16, 18, n),
): BattleResult {
  n += 1
  return { battleId: `b${n}`, resolvedAt, kind, outcomes, points, share: null }
}
const win = (w: string, l: string, at?: Date) => res('played', { [w]: 'W', [l]: 'L' }, { [w]: 3, [l]: 0 }, at)

const row = (rows: ReturnType<typeof buildTable>, id: string) => rows.find((r) => r.profileId === id)!

describe('buildTable', () => {
  test('sorts by points then win% then name', () => {
    const results = [
      win('ana', 'x1'),
      win('ana', 'x2'),
      win('ben', 'x3'),
      win('ben', 'x4'),
      win('x5', 'ben'),
      win('cal', 'x6'),
      win('cal', 'x7'),
    ]
    const rows = buildTable([ben, cal, ana], results, [])
    expect(rows.map((r) => r.name)).toEqual(['Ana', 'Cal', 'Ben'])
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3])
    expect(rows.map((r) => r.points)).toEqual([6, 6, 6])
    expect(row(rows, 'ben')).toMatchObject({ played: 3, won: 2, lost: 1, winPct: 67 })
    expect(rows.every((r) => r.movement === 0)).toBe(true)
  })

  test('forfeit counts as played and lost', () => {
    const rows = buildTable([ana, ben], [res('forfeit', { ana: 'W', ben: 'F' }, { ana: 3, ben: -1 })], [])
    expect(row(rows, 'ben')).toMatchObject({ played: 1, won: 0, drawn: 0, lost: 1, points: -1, winPct: 0 })
    expect(row(rows, 'ana')).toMatchObject({ played: 1, won: 1, points: 3, winPct: 100 })
  })

  test('void_both gives -1 but no played', () => {
    const rows = buildTable([ana, ben], [res('void_both', { ana: 'F', ben: 'F' }, { ana: -1, ben: -1 })], [])
    expect(row(rows, 'ana')).toMatchObject({ played: 0, won: 0, lost: 0, points: -1, winPct: 0 })
    expect(row(rows, 'ben')).toMatchObject({ played: 0, points: -1 })
  })

  test('draws count as played', () => {
    const rows = buildTable([ana, ben], [res('played', { ana: 'D', ben: 'D' }, { ana: 1, ben: 1 })], [])
    expect(row(rows, 'ana')).toMatchObject({ played: 1, drawn: 1, points: 1, winPct: 0 })
  })

  test('winPct rounds and is 0 with no games', () => {
    const rows = buildTable([ana, ben], [win('ana', 'ben'), win('ana', 'ben'), win('ben', 'ana')], [])
    expect(row(rows, 'ana').winPct).toBe(67)
    expect(buildTable([cal], [], [])[0].winPct).toBe(0)
  })

  test('adds Outfit of the Week +2', () => {
    const award: OotwAward = {
      profileId: 'ana',
      battleId: 'b1',
      weekStart: '2026-11-16',
      share: 0.9,
      awardedAt: new Date(2026, 10, 22),
    }
    const rows = buildTable([ana, ben], [win('ana', 'ben')], [award])
    expect(row(rows, 'ana')).toMatchObject({ ootw: 1, points: 5 })
    expect(row(rows, 'ben').ootw).toBe(0)
  })

  test('member with no battles shows at 0', () => {
    const rows = buildTable([ana, cal], [win('ana', 'x')], [])
    expect(row(rows, 'cal')).toMatchObject({ played: 0, won: 0, drawn: 0, lost: 0, points: 0, winPct: 0, ootw: 0, rank: 2 })
  })

  test('only lists the members it is given', () => {
    expect(buildTable([ana], [win('ana', 'ghost')], [])).toHaveLength(1)
  })
})

describe('buildTableWithMovement', () => {
  test('movement after latest results', () => {
    const early = win('ana', 'ben', new Date(2026, 10, 16, 18, 0))
    const latest = win('ben', 'ana', new Date(2026, 10, 17, 18, 0))
    const latest2 = win('ben', 'cal', new Date(2026, 10, 17, 18, 0))
    const rows = buildTableWithMovement([ana, ben, cal], [early, latest, latest2], [])
    expect(rows.map((r) => r.name)).toEqual(['Ben', 'Ana', 'Cal'])
    expect(row(rows, 'ben').movement).toBe(1)
    expect(row(rows, 'ana').movement).toBe(-1)
    expect(row(rows, 'cal').movement).toBe(0)
  })

  test('no movement when there is nothing before the latest results', () => {
    const rows = buildTableWithMovement([ana, ben], [win('ben', 'ana')], [])
    expect(rows.map((r) => r.movement)).toEqual([0, 0])
  })

  test('an Outfit of the Week award can move people too', () => {
    const results = [win('ana', 'x', new Date(2026, 10, 16, 18)), win('ben', 'x', new Date(2026, 10, 17, 18))]
    const award: OotwAward = {
      profileId: 'ben',
      battleId: 'b',
      weekStart: '2026-11-16',
      share: 0.9,
      awardedAt: new Date(2026, 10, 22),
    }
    // Before the award: Ana and Ben level on 3 (Ana first by name). The award lifts Ben to the top.
    const rows = buildTableWithMovement([ana, ben], results, [award])
    expect(rows[0].name).toBe('Ben')
    expect(row(rows, 'ben').movement).toBe(1)
    expect(row(rows, 'ana').movement).toBe(-1)
  })
})

describe('leagueTable', () => {
  test('wires resolveAll, awards and movement', () => {
    const early = win('ana', 'ben', new Date(2026, 10, 16, 18, 0))
    const latest = win('ben', 'cal', new Date(2026, 10, 17, 18, 0))
    vi.mocked(resolveAll).mockReturnValue([early, latest])
    const facts: BattleFacts[] = []
    const now = new Date(2026, 10, 18, 9, 0)
    const rows = leagueTable([ana, ben, cal], facts, now)
    expect(resolveAll).toHaveBeenCalledWith(facts, now)
    expect(rows.map((r) => [r.name, r.points, r.movement])).toEqual([
      ['Ana', 3, 0],
      ['Ben', 3, 0],
      ['Cal', 0, 0],
    ])
  })
})
