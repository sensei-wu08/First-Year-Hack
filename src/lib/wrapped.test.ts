import { describe, expect, test } from 'vitest'
import { atLocalTime } from './time'
import type { BattleFacts, CommentView, Member, Side } from './types'
import { groupWrapped, personalWrapped, type WrappedInput } from './wrapped'

const mk = (id: string, name: string): Member => ({ id, name, emoji: '🙂' })
const ana = mk('ana', 'Ana')
const ben = mk('ben', 'Ben')
const cal = mk('cal', 'Cal')
const dee = mk('dee', 'Dee')

const NOW = new Date(2026, 10, 30, 12, 0)

let counter = 0
function facts(
  date: string,
  a: string,
  b: string,
  votesA: number,
  votesB: number,
  opts: { postedA?: boolean; postedB?: boolean; id?: string } = {},
): BattleFacts {
  counter += 1
  const id = opts.id ?? `battle-${counter}`
  return {
    battle: {
      id,
      groupId: 'g',
      seasonId: null,
      playerA: a,
      playerB: b,
      revealAt: atLocalTime(date, '09:00'),
      postDeadline: atLocalTime(date, '12:00'),
      resultsAt: atLocalTime(date, '18:00'),
      closedAt: null,
      voidedAt: null,
      shareCode: id,
    },
    mediaA: opts.postedA === false ? null : `${id}-a.jpg`,
    mediaB: opts.postedB === false ? null : `${id}-b.jpg`,
    votesA,
    votesB,
  }
}

const comment = (battleId: string, side: Side, body: string, hhmm: string): CommentView => ({
  battleId,
  side,
  authorName: 'Someone',
  authorEmoji: null,
  body,
  createdAt: atLocalTime('2026-11-04', hhmm),
})

// Six battles in one week (Mon 2 Nov to Sat 7 Nov).
const b1 = facts('2026-11-02', 'ana', 'ben', 5, 4, { id: 'b1' }) // Ana wins 5-4
const b2 = facts('2026-11-03', 'cal', 'dee', 0, 0, { id: 'b2', postedB: false }) // Dee forfeits
const b3 = facts('2026-11-04', 'ana', 'cal', 1, 7, { id: 'b3' }) // Cal wins 7-1
const b4 = facts('2026-11-05', 'ben', 'dee', 4, 1, { id: 'b4' }) // Ben wins 4-1
const b5 = facts('2026-11-06', 'ana', 'dee', 4, 2, { id: 'b5' }) // Ana wins 4-2
const b6 = facts('2026-11-07', 'ben', 'cal', 2, 6, { id: 'b6' }) // Cal wins 6-2

const comments: CommentView[] = [
  comment('b1', 'b', 'Ben side, early', '18:01'),
  comment('b1', 'a', 'Ana side, second', '18:20'),
  comment('b1', 'a', 'Ana side, first', '18:05'),
  comment('b3', 'a', 'Ana side on the 7-1', '18:05'),
  comment('b3', 'b', 'Cal side, later', '18:20'),
  comment('b3', 'b', 'Cal side, earliest', '18:10'),
]

const input1: WrappedInput = {
  members: [ana, ben, cal, dee],
  facts: [b1, b2, b3, b4, b5, b6],
  comments,
  now: NOW,
}

describe('groupWrapped', () => {
  const w = groupWrapped(input1)

  test('champion is table top', () => {
    // Cal: forfeit win 3 + 3 + 3 + Outfit of the Week 2 = 11
    expect(w.champion?.profileId).toBe('cal')
    expect(w.champion?.points).toBe(11)
    expect(w.finalTable.map((r) => r.profileId)).toEqual(['cal', 'ana', 'ben', 'dee'])
  })

  test('rivalry is the 5-4 battle', () => {
    expect(w.rivalry).toEqual({ a: 'ana', b: 'ben', votesA: 5, votesB: 4, battleId: 'b1' })
  })

  test('rivalry ties go to the larger total, then the latest', () => {
    const closeSmall = facts('2026-11-03', 'ana', 'ben', 2, 1, { id: 'small' })
    const closeBig = facts('2026-11-04', 'cal', 'dee', 6, 5, { id: 'big' })
    const closeBigLater = facts('2026-11-05', 'ana', 'cal', 6, 5, { id: 'bigLater' })
    const r = groupWrapped({ ...input1, facts: [closeSmall, closeBig, closeBigLater], comments: [] }).rivalry
    expect(r?.battleId).toBe('bigLater')
    const r2 = groupWrapped({ ...input1, facts: [closeSmall, closeBig], comments: [] }).rivalry
    expect(r2?.battleId).toBe('big')
  })

  test('ghost is Dee with 1', () => {
    expect(w.ghost).toEqual({ profileId: 'dee', forfeits: 1 })
  })

  test('ghost is null with no forfeits and ties go by name', () => {
    expect(groupWrapped({ ...input1, facts: [b1, b3] }).ghost).toBeNull()
    const f1 = facts('2026-11-02', 'ben', 'cal', 0, 0, { id: 'f1', postedA: false })
    const f2 = facts('2026-11-03', 'ana', 'dee', 0, 0, { id: 'f2', postedA: false })
    expect(groupWrapped({ ...input1, facts: [f1, f2], comments: [] }).ghost).toEqual({ profileId: 'ana', forfeits: 1 })
  })

  test('topOutfit is the 7-vote outfit', () => {
    expect(w.topOutfit).toEqual({
      profileId: 'cal',
      battleId: 'b3',
      mediaPath: 'b3-b.jpg',
      votes: 7,
      share: 7 / 8,
    })
  })

  test('commentOfSeason is earliest comment on that side', () => {
    expect(w.commentOfSeason?.body).toBe('Cal side, earliest')
  })

  test('totalVotes sums all votes', () => {
    expect(w.totalVotes).toBe(5 + 4 + 1 + 7 + 4 + 1 + 4 + 2 + 2 + 6)
    expect(w.battlesPlayed).toBe(5)
  })

  test('empty season gives nulls', () => {
    const e = groupWrapped({ ...input1, facts: [], comments: [] })
    expect(e).toMatchObject({
      champion: null,
      rivalry: null,
      ghost: null,
      topOutfit: null,
      commentOfSeason: null,
      totalVotes: 0,
      battlesPlayed: 0,
    })
  })
})

// Group 2: Ana and Ben. One October battle, two November battles in different weeks.
const o1 = facts('2026-10-12', 'ana', 'ben', 1, 0, { id: 'o1' }) // Ana wins 1-0
const n1 = facts('2026-11-09', 'ana', 'ben', 1, 3, { id: 'n1' }) // Ben wins 3-1, Outfit of the Week to Ben
const n2 = facts('2026-11-16', 'ana', 'ben', 3, 1, { id: 'n2' }) // Ana wins 3-1, Outfit of the Week to Ana
const input2: WrappedInput = {
  members: [ana, ben],
  facts: [o1, n1, n2],
  comments: [comment('n2', 'a', 'Ana in group two', '18:05')],
  now: NOW,
}
const groups = [
  { id: 'g1', name: 'Flat 4B', input: input1 },
  { id: 'g2', name: 'Work', input: input2 },
]

describe('personalWrapped', () => {
  test('filters to the month', () => {
    const p = personalWrapped('ana', '2026-10', groups)
    expect(p.record).toEqual({ w: 1, d: 0, l: 0, f: 0, points: 3 })
    expect(p.perGroup.map((g) => g.groupId)).toEqual(['g2'])
    expect(p.votesReceived).toBe(1)
  })

  test('record aggregates two groups', () => {
    const p = personalWrapped('ana', '2026-11', groups)
    // Group 1: W (b1), L (b3), W (b5), 6 pts. Group 2: L (n1), W (n2) + Outfit of the Week, 5 pts.
    expect(p.record).toEqual({ w: 3, d: 0, l: 2, f: 0, points: 11 })
    expect(p.votesReceived).toBe(5 + 1 + 4 + 1 + 3)
  })

  test('counts forfeits apart from losses', () => {
    const p = personalWrapped('dee', '2026-11', groups)
    expect(p.record).toEqual({ w: 0, d: 0, l: 2, f: 1, points: -1 })
  })

  test('perGroup rank', () => {
    const p = personalWrapped('ana', '2026-11', groups)
    expect(p.perGroup).toEqual([
      { groupId: 'g1', groupName: 'Flat 4B', rank: 2, of: 4, w: 2, d: 0, l: 1, f: 0, points: 6 },
      { groupId: 'g2', groupName: 'Work', rank: 1, of: 2, w: 1, d: 0, l: 1, f: 0, points: 5 },
    ])
  })

  test('bestComment on own best outfit', () => {
    const p = personalWrapped('ana', '2026-11', groups)
    expect(p.bestOutfit).toEqual({ profileId: 'ana', battleId: 'b1', mediaPath: 'b1-a.jpg', votes: 5, share: 5 / 9 })
    expect(p.bestComment?.body).toBe('Ana side, first')
  })

  test('nulls when nothing played', () => {
    const p = personalWrapped('ana', '2026-09', groups)
    expect(p).toEqual({
      month: '2026-09',
      record: { w: 0, d: 0, l: 0, f: 0, points: 0 },
      perGroup: [],
      bestOutfit: null,
      bestComment: null,
      votesReceived: 0,
    })
  })
})
