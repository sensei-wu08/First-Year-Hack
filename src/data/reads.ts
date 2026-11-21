import type { BattleRecord, BattleView, Group, Member, PostView, Season, Tally } from '../lib/types'
import { supabase } from './supabase'

// Rows come back from PostgREST untyped (no generated DB types in this project).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

export function publicUrl(path: string): string {
  return supabase.storage.from('outfits').getPublicUrl(path).data.publicUrl
}

function toGroup(r: Row): Group {
  return {
    id: r.id,
    name: r.name,
    inviteCode: r.invite_code,
    adminId: r.admin_id,
    revealTime: r.reveal_time,
    postDeadlineTime: r.post_deadline_time,
    resultsTime: r.results_time,
    battlesPerDay: r.battles_per_day,
    allowShareVoting: r.allow_share_voting,
    commentsEnabled: r.comments_enabled,
  }
}

function toSeason(r: Row): Season {
  return { id: r.id, groupId: r.group_id, number: r.number, startsOn: r.starts_on, endsOn: r.ends_on }
}

function toRecord(r: Row): BattleRecord {
  return {
    id: r.id,
    groupId: r.group_id,
    seasonId: r.season_id,
    playerA: r.player_a,
    playerB: r.player_b,
    revealAt: new Date(r.reveal_at),
    postDeadline: new Date(r.post_deadline),
    resultsAt: new Date(r.results_at),
    closedAt: r.closed_at ? new Date(r.closed_at) : null,
    voidedAt: r.voided_at ? new Date(r.voided_at) : null,
    shareCode: r.share_code,
  }
}

function toPost(r: Row): PostView {
  return { profileId: r.profile_id, mediaPath: r.media_path, mediaUrl: publicUrl(r.media_path), mediaType: r.media_type }
}

async function tallyMap(ids: string[]): Promise<Map<string, Tally>> {
  const map = new Map<string, Tally>()
  if (ids.length === 0) return map
  const { data, error } = await supabase.from('battle_tallies').select('*').in('battle_id', ids)
  fail(error)
  for (const t of (data ?? []) as Row[]) {
    map.set(t.battle_id, { total: Number(t.total ?? 0), votesA: t.votes_a ?? null, votesB: t.votes_b ?? null })
  }
  return map
}

const noTally: Tally = { total: 0, votesA: null, votesB: null }

function toView(r: Row, tallies: Map<string, Tally>): BattleView {
  return {
    record: toRecord(r),
    posts: ((r.posts ?? []) as Row[]).map(toPost),
    tally: tallies.get(r.id) ?? noTally,
  }
}

export async function getGroup(id: string): Promise<Group> {
  const { data, error } = await supabase.from('groups').select('*').eq('id', id).maybeSingle()
  fail(error)
  if (!data) throw new Error('not_member')
  return toGroup(data)
}

export async function listMembers(groupId: string): Promise<(Member & { leftAt: Date | null })[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('left_at, profiles(id, name, emoji)')
    .eq('group_id', groupId)
  fail(error)
  return ((data ?? []) as Row[]).flatMap((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    if (!p) return []
    return [{ id: p.id, name: p.name, emoji: p.emoji, leftAt: m.left_at ? new Date(m.left_at) : null }]
  })
}

export async function listBattles(groupId: string, seasonId?: string | null): Promise<BattleView[]> {
  let q = supabase.from('battles').select('*, posts(*)').eq('group_id', groupId)
  if (seasonId) q = q.eq('season_id', seasonId)
  const { data, error } = await q.order('reveal_at', { ascending: true })
  fail(error)
  const rows = (data ?? []) as Row[]
  const tallies = await tallyMap(rows.map((r) => r.id))
  return rows.map((r) => toView(r, tallies))
}

export async function getBattle(id: string): Promise<BattleView | null> {
  const { data, error } = await supabase.from('battles').select('*, posts(*)').eq('id', id).maybeSingle()
  fail(error)
  if (!data) return null
  const tallies = await tallyMap([id])
  return toView(data, tallies)
}

export async function currentSeason(groupId: string): Promise<Season | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('group_id', groupId)
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle()
  fail(error)
  return data ? toSeason(data) : null
}

export async function listSeasons(groupId: string): Promise<Season[]> {
  const { data, error } = await supabase.from('seasons').select('*').eq('group_id', groupId).order('number')
  fail(error)
  return (data ?? []).map(toSeason)
}
