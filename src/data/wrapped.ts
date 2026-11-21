import type { BattleView, CommentView, Member } from '../lib/types'
import type { WrappedInput } from '../lib/wrapped'
import { toFacts } from './mappers'
import { listMyGroups } from './groups'
import { listBattles, listMembers } from './reads'
import { supabase } from './supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const CHUNK = 50

/** Comments on closed battles, read straight from the `battle_comments` view. */
async function loadComments(battleIds: string[]): Promise<CommentView[]> {
  const out: CommentView[] = []
  for (let i = 0; i < battleIds.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('battle_comments')
      .select('battle_id, side, author_name, author_emoji, body, created_at')
      .in('battle_id', battleIds.slice(i, i + CHUNK))
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as Row[]) {
      out.push({
        battleId: r.battle_id,
        side: r.side,
        authorName: r.author_name,
        authorEmoji: r.author_emoji ?? null,
        body: r.body,
        createdAt: new Date(r.created_at),
      })
    }
  }
  return out
}

/** Everyone still in the group, plus anyone who left but has battles in the table. */
async function tableMembers(groupId: string, battles: BattleView[]): Promise<Member[]> {
  const members = await listMembers(groupId)
  const inBattles = new Set(battles.flatMap((b) => [b.record.playerA, b.record.playerB]))
  return members
    .filter((m) => !m.leftAt || inBattles.has(m.id))
    .map(({ id, name, emoji }) => ({ id, name, emoji }))
}

async function inputFor(groupId: string, seasonId: string | null): Promise<WrappedInput> {
  const battles = await listBattles(groupId, seasonId)
  const [members, comments] = await Promise.all([
    tableMembers(groupId, battles),
    loadComments(battles.map((b) => b.record.id)),
  ])
  return { members, facts: battles.map(toFacts), comments, now: new Date() }
}

/** One season's worth of a group's data. Pass 'none' (or '') for a group with no seasons: all its battles. */
export function loadSeasonInput(groupId: string, seasonId: string): Promise<WrappedInput> {
  return inputFor(groupId, seasonId && seasonId !== 'none' ? seasonId : null)
}

/** Every group I'm in, each with all its battles; `personalWrapped` filters to the month. */
export async function loadMonthInputs(_month: string): Promise<{ id: string; name: string; input: WrappedInput }[]> {
  const groups = await listMyGroups()
  return Promise.all(groups.map(async (g) => ({ id: g.id, name: g.name, input: await inputFor(g.id, null) })))
}
