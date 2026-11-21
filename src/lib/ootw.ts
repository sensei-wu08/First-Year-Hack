import { addDays, atLocalTime, mondayOf } from './time'
import type { BattleFacts, BattleResult } from './types'

export interface OotwAward {
  profileId: string
  battleId: string
  weekStart: string
  share: number
  awardedAt: Date
}

const MIN_VOTES = 3

interface Candidate {
  profileId: string
  battleId: string
  share: number
}

/**
 * Outfit of the Week: per Monday-Sunday week, the outfit with the highest vote share among
 * played battles with at least 3 votes. Ties all win. Forfeits never qualify.
 * Awarded at the later of the week's last result and Sunday 00:00, and only once `now` has reached that.
 * A week waits until every battle scheduled in it (by `resultsAt`, from the full `facts`) has resolved,
 * so a still-pending Sunday battle can't be missed. At most one award per profile per week.
 */
export function outfitOfTheWeekAwards(facts: BattleFacts[], results: BattleResult[], now: Date): OotwAward[] {
  const factsById = new Map(facts.map((f) => [f.battle.id, f]))
  const weeks = new Map<string, { latest: Date; candidates: Candidate[] }>()

  const resolvedIds = new Set(results.map((r) => r.battleId))
  const pendingWeeks = new Set(
    facts.filter((f) => !resolvedIds.has(f.battle.id)).map((f) => mondayOf(f.battle.resultsAt)),
  )

  for (const r of results) {
    const weekStart = mondayOf(r.resolvedAt)
    const week = weeks.get(weekStart) ?? { latest: r.resolvedAt, candidates: [] }
    if (r.resolvedAt > week.latest) week.latest = r.resolvedAt
    weeks.set(weekStart, week)

    const f = factsById.get(r.battleId)
    if (r.kind !== 'played' || !r.share || !f) continue
    if (f.votesA + f.votesB < MIN_VOTES) continue
    week.candidates.push({ profileId: f.battle.playerA, battleId: r.battleId, share: r.share.a })
    week.candidates.push({ profileId: f.battle.playerB, battleId: r.battleId, share: r.share.b })
  }

  const awards: OotwAward[] = []
  for (const [weekStart, week] of weeks) {
    if (week.candidates.length === 0 || pendingWeeks.has(weekStart)) continue
    const sunday = atLocalTime(addDays(weekStart, 6), '00:00')
    const awardedAt = week.latest > sunday ? week.latest : sunday
    if (awardedAt > now) continue
    const top = Math.max(...week.candidates.map((c) => c.share))
    const awarded = new Set<string>()
    for (const c of week.candidates) {
      if (c.share < top - 1e-9 || awarded.has(c.profileId)) continue
      awarded.add(c.profileId)
      awards.push({ ...c, weekStart, awardedAt })
    }
  }
  return awards.sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}
