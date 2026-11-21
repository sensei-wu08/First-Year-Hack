import { outfitOfTheWeekAwards, type OotwAward } from './ootw'
import { resolveAll } from './scoring'
import type { BattleFacts, BattleResult, Member } from './types'

export interface TableRow {
  profileId: string
  name: string
  emoji: string
  played: number
  won: number
  drawn: number
  lost: number
  points: number
  winPct: number
  rank: number
  /** +n means up n places since the previous results. */
  movement: number
  ootw: number
}

export const OOTW_POINTS = 2

/** Sorted and ranked table (movement 0). Pass every member, including people who have left. */
export function buildTable(members: Member[], results: BattleResult[], awards: OotwAward[]): TableRow[] {
  const rows = new Map<string, TableRow>(
    members.map((m) => [
      m.id,
      {
        profileId: m.id,
        name: m.name,
        emoji: m.emoji,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        points: 0,
        winPct: 0,
        rank: 0,
        movement: 0,
        ootw: 0,
      },
    ]),
  )

  for (const r of results) {
    for (const [id, pts] of Object.entries(r.points)) {
      const row = rows.get(id)
      if (row) row.points += pts
    }
    // A void-both battle scores -1 each but is not a game played.
    if (r.kind !== 'played' && r.kind !== 'forfeit') continue
    for (const [id, outcome] of Object.entries(r.outcomes)) {
      const row = rows.get(id)
      if (!row) continue
      row.played += 1
      if (outcome === 'W') row.won += 1
      else if (outcome === 'D') row.drawn += 1
      else row.lost += 1
    }
  }

  for (const a of awards) {
    const row = rows.get(a.profileId)
    if (!row) continue
    row.ootw += 1
    row.points += OOTW_POINTS
  }

  const sorted = [...rows.values()]
  for (const row of sorted) row.winPct = row.played === 0 ? 0 : Math.round((100 * row.won) / row.played)
  sorted.sort((a, b) => b.points - a.points || b.winPct - a.winPct || a.name.localeCompare(b.name))
  sorted.forEach((row, i) => {
    row.rank = i + 1
  })
  return sorted
}

/** The table, with movement against the same table minus the latest results instant. */
export function buildTableWithMovement(members: Member[], results: BattleResult[], awards: OotwAward[]): TableRow[] {
  const current = buildTable(members, results, awards)
  const instants = [...results.map((r) => r.resolvedAt.getTime()), ...awards.map((a) => a.awardedAt.getTime())]
  if (instants.length === 0) return current
  const latest = Math.max(...instants)
  const priorResults = results.filter((r) => r.resolvedAt.getTime() < latest)
  const priorAwards = awards.filter((a) => a.awardedAt.getTime() < latest)
  // Nothing happened before the latest results: every place is new, so show no arrows.
  if (priorResults.length === 0 && priorAwards.length === 0) return current
  const before = new Map(buildTable(members, priorResults, priorAwards).map((r) => [r.profileId, r.rank]))
  return current.map((r) => ({ ...r, movement: (before.get(r.profileId) ?? r.rank) - r.rank }))
}

export function leagueTable(members: Member[], facts: BattleFacts[], now: Date): TableRow[] {
  const results = resolveAll(facts, now)
  const awards = outfitOfTheWeekAwards(facts, results, now)
  return buildTableWithMovement(members, results, awards)
}
