import { outfitOfTheWeekAwards } from './ootw'
import { resolveAll } from './scoring'
import { buildTable, type TableRow } from './table'
import { monthKey } from './time'
import type { BattleFacts, BattleResult, CommentView, Member, Side } from './types'

export interface WrappedInput {
  members: Member[]
  facts: BattleFacts[]
  comments: CommentView[]
  now: Date
}

/** `mediaPath` is whatever the facts carry for the photo (`toFacts` gives a public URL), ready to use as an image src. */
export interface OutfitRef {
  profileId: string
  battleId: string
  mediaPath: string
  votes: number
  share: number
}

export interface GroupWrapped {
  champion: TableRow | null
  finalTable: TableRow[]
  rivalry: { a: string; b: string; votesA: number; votesB: number; battleId: string } | null
  ghost: { profileId: string; forfeits: number } | null
  topOutfit: OutfitRef | null
  commentOfSeason: CommentView | null
  totalVotes: number
  battlesPlayed: number
}

export interface PersonalWrapped {
  month: string
  record: { w: number; d: number; l: number; f: number; points: number }
  perGroup: {
    groupId: string
    groupName: string
    rank: number
    of: number
    w: number
    d: number
    l: number
    f: number
    points: number
  }[]
  bestOutfit: OutfitRef | null
  bestComment: CommentView | null
  votesReceived: number
}

interface Outfit extends OutfitRef {
  side: Side
  resolvedAt: number
}

/** Every outfit that got votes in a played battle. */
function outfitsOf(facts: BattleFacts[], results: BattleResult[]): Outfit[] {
  const factsById = new Map(facts.map((f) => [f.battle.id, f]))
  const out: Outfit[] = []
  for (const r of results) {
    const f = factsById.get(r.battleId)
    if (r.kind !== 'played' || !f) continue
    const total = f.votesA + f.votesB
    if (total === 0) continue
    const sides: [Side, string, string | null, number][] = [
      ['a', f.battle.playerA, f.mediaA, f.votesA],
      ['b', f.battle.playerB, f.mediaB, f.votesB],
    ]
    for (const [side, profileId, media, votes] of sides) {
      if (media === null) continue
      out.push({
        profileId,
        battleId: f.battle.id,
        mediaPath: media,
        votes,
        share: votes / total,
        side,
        resolvedAt: r.resolvedAt.getTime(),
      })
    }
  }
  return out
}

/** Most votes, then higher share, then earliest. */
function bestOutfit(outfits: Outfit[]): Outfit | null {
  let best: Outfit | null = null
  for (const o of outfits) {
    if (
      best === null ||
      o.votes > best.votes ||
      (o.votes === best.votes && (o.share > best.share || (o.share === best.share && o.resolvedAt < best.resolvedAt)))
    ) {
      best = o
    }
  }
  return best
}

function toRef(o: Outfit | null): OutfitRef | null {
  return o && { profileId: o.profileId, battleId: o.battleId, mediaPath: o.mediaPath, votes: o.votes, share: o.share }
}

/** The earliest comment on the outfit's battle, from its side. */
function commentFor(o: Outfit | null, comments: CommentView[]): CommentView | null {
  if (!o) return null
  let best: CommentView | null = null
  for (const c of comments) {
    if (c.battleId !== o.battleId || c.side !== o.side) continue
    if (best === null || c.createdAt.getTime() < best.createdAt.getTime()) best = c
  }
  return best
}

export function groupWrapped(i: WrappedInput): GroupWrapped {
  const results = resolveAll(i.facts, i.now)
  const awards = outfitOfTheWeekAwards(i.facts, results, i.now)
  const finalTable = buildTable(i.members, results, awards)
  const factsById = new Map(i.facts.map((f) => [f.battle.id, f]))
  const names = new Map(i.members.map((m) => [m.id, m.name]))
  const nameOf = (id: string) => names.get(id) ?? id

  const played = results.filter((r) => r.kind === 'played')

  // Rivalry: the closest battle that had votes, then the bigger one, then the latest.
  let rivalry: GroupWrapped['rivalry'] = null
  let rivalryKey: { gap: number; total: number; at: number } | null = null
  for (const r of played) {
    const f = factsById.get(r.battleId)
    if (!f) continue
    const total = f.votesA + f.votesB
    if (total === 0) continue
    const key = { gap: Math.abs(f.votesA - f.votesB), total, at: r.resolvedAt.getTime() }
    const better =
      rivalryKey === null ||
      key.gap < rivalryKey.gap ||
      (key.gap === rivalryKey.gap && (key.total > rivalryKey.total || (key.total === rivalryKey.total && key.at > rivalryKey.at)))
    if (better) {
      rivalryKey = key
      rivalry = { a: f.battle.playerA, b: f.battle.playerB, votesA: f.votesA, votesB: f.votesB, battleId: f.battle.id }
    }
  }

  // Ghost: most forfeits, ties by name.
  const forfeits = new Map<string, number>()
  for (const r of results) {
    for (const [id, outcome] of Object.entries(r.outcomes)) {
      if (outcome === 'F') forfeits.set(id, (forfeits.get(id) ?? 0) + 1)
    }
  }
  let ghost: GroupWrapped['ghost'] = null
  for (const [profileId, count] of forfeits) {
    if (ghost === null || count > ghost.forfeits || (count === ghost.forfeits && nameOf(profileId).localeCompare(nameOf(ghost.profileId)) < 0)) {
      ghost = { profileId, forfeits: count }
    }
  }

  const top = bestOutfit(outfitsOf(i.facts, results))

  return {
    champion: finalTable.find((r) => r.played > 0) ? finalTable[0] : null,
    finalTable,
    rivalry,
    ghost,
    topOutfit: toRef(top),
    commentOfSeason: commentFor(top, i.comments),
    totalVotes: i.facts.reduce((sum, f) => sum + f.votesA + f.votesB, 0),
    battlesPlayed: played.length,
  }
}

export function personalWrapped(
  profileId: string,
  month: string,
  groups: { id: string; name: string; input: WrappedInput }[],
): PersonalWrapped {
  const record = { w: 0, d: 0, l: 0, f: 0, points: 0 }
  const perGroup: PersonalWrapped['perGroup'] = []
  const mine: Outfit[] = []
  const allComments: CommentView[] = []

  for (const g of groups) {
    const { members, facts, comments, now } = g.input
    const allResults = resolveAll(facts, now)
    const results = allResults.filter((r) => monthKey(r.resolvedAt) === month)
    // Awards need the whole season to know when a week is done. File each under the month its own
    // battle resolved, so a week that ends in the next month still counts where the battle was fought.
    const resolvedMonth = new Map(allResults.map((r) => [r.battleId, monthKey(r.resolvedAt)]))
    const awards = outfitOfTheWeekAwards(facts, allResults, now).filter((a) => resolvedMonth.get(a.battleId) === month)

    const table = buildTable(members, results, awards)
    const row = table.find((r) => r.profileId === profileId)
    const counts = { w: 0, d: 0, l: 0, f: 0 }
    let involved = false
    for (const r of results) {
      const outcome = r.outcomes[profileId]
      if (!outcome) continue
      involved = true
      counts[outcome === 'W' ? 'w' : outcome === 'D' ? 'd' : outcome === 'L' ? 'l' : 'f'] += 1
    }
    if (awards.some((a) => a.profileId === profileId)) involved = true

    if (row && involved) {
      perGroup.push({
        groupId: g.id,
        groupName: g.name,
        rank: row.rank,
        of: table.length,
        ...counts,
        points: row.points,
      })
      record.w += counts.w
      record.d += counts.d
      record.l += counts.l
      record.f += counts.f
      record.points += row.points
    }

    mine.push(...outfitsOf(facts, results).filter((o) => o.profileId === profileId))
    allComments.push(...comments)
  }

  const best = bestOutfit(mine)
  return {
    month,
    record,
    perGroup,
    bestOutfit: toRef(best),
    bestComment: commentFor(best, allComments),
    votesReceived: mine.reduce((sum, o) => sum + o.votes, 0),
  }
}
