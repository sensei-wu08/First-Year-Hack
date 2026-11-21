import { shuffle } from './rng'
import { addDays, atLocalTime } from './time'

export interface DayTimes {
  reveal: string
  postDeadline: string
  results: string
}

export interface ScheduledBattle {
  playerA: string
  playerB: string
  date: string
  revealAt: Date
  postDeadline: Date
  resultsAt: Date
}

type Pair = [string, string]

/** Battles per day for a group of `memberCount` (0 when there is nobody to pair). */
export function defaultBattlesPerDay(memberCount: number): number {
  if (memberCount < 2) return 0
  if (memberCount <= 14) return Math.ceil((memberCount * (memberCount - 1)) / 2 / 28)
  if (memberCount <= 25) return 2
  if (memberCount <= 40) return 3
  return 4
}

/** Circle-method round robin: every pair exactly once, grouped into rounds. A bye is added for odd counts and dropped. */
function circleRounds(players: string[]): Pair[][] {
  const BYE = '\0bye'
  const ring = players.length % 2 === 1 ? [...players, BYE] : players.slice()
  const n = ring.length
  const rounds: Pair[][] = []
  for (let r = 0; r < n - 1; r++) {
    const round: Pair[] = []
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i]
      const b = ring[n - 1 - i]
      if (a !== BYE && b !== BYE) round.push([a, b])
    }
    rounds.push(round)
    // keep ring[0] fixed, rotate the rest by one
    ring.splice(1, 0, ring.pop() as string)
  }
  return rounds
}

/** Greedy: each day takes pairs from the front of the queue whose players are free, up to `perDay`. */
function packIntoDays(pairs: Pair[], perDay: number): Pair[][] {
  const limit = Math.max(1, Math.floor(perDay))
  const queue = pairs.slice()
  const days: Pair[][] = []
  while (queue.length > 0) {
    const used = new Set<string>()
    const day: Pair[] = []
    for (let i = 0; i < queue.length && day.length < limit; ) {
      const [a, b] = queue[i]
      if (used.has(a) || used.has(b)) {
        i++
      } else {
        used.add(a).add(b)
        day.push(queue[i])
        queue.splice(i, 1)
      }
    }
    days.push(day)
  }
  return days
}

function stamp(date: string, times: DayTimes) {
  return {
    date,
    revealAt: atLocalTime(date, times.reveal),
    postDeadline: atLocalTime(date, times.postDeadline),
    resultsAt: atLocalTime(date, times.results),
  }
}

export function scheduleSeason(a: {
  memberIds: string[]
  startDate: string
  battlesPerDay: number
  times: DayTimes
  rng: () => number
}): ScheduledBattle[] {
  if (a.memberIds.length < 2) return []
  const rounds = shuffle(circleRounds(shuffle(a.memberIds, a.rng)), a.rng).map((r) => shuffle(r, a.rng))
  const days = packIntoDays(rounds.flat(), a.battlesPerDay)
  return days.flatMap((day, i) =>
    day.map(([playerA, playerB]) => ({ playerA, playerB, ...stamp(addDays(a.startDate, i), a.times) })),
  )
}

export function redateRemaining(a: {
  battles: { id: string; playerA: string; playerB: string }[]
  fromDate: string
  battlesPerDay: number
  times: DayTimes
}): { id: string; date: string; revealAt: Date; postDeadline: Date; resultsAt: Date }[] {
  const byPair = new Map<Pair, string>()
  const pairs = a.battles.map((b) => {
    const p: Pair = [b.playerA, b.playerB]
    byPair.set(p, b.id)
    return p
  })
  return packIntoDays(pairs, a.battlesPerDay).flatMap((day, i) =>
    day.map((p) => ({ id: byPair.get(p) as string, ...stamp(addDays(a.fromDate, i), a.times) })),
  )
}
