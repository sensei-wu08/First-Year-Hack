import type { Group } from '../lib/types'
import { ensureSession } from './auth'
import { supabase } from './supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

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

/** Creates a group (the caller becomes admin and first member). Returns the new group id. */
export async function createGroup(name: string): Promise<string> {
  await ensureSession()
  const { data, error } = await supabase.rpc('create_group', { p_name: name })
  if (error) throw new Error(error.message)
  return data as string
}

/** Looks up a group by invite code. Returns null when the code isn't valid. */
export async function getGroupByInvite(code: string): Promise<{ id: string; name: string; memberCount: number } | null> {
  await ensureSession()
  const { data, error } = await supabase.rpc('group_by_invite', { p_code: code })
  if (error) throw new Error(error.message)
  const row = (Array.isArray(data) ? data[0] : data) as Row | undefined
  if (!row) return null
  return { id: row.id, name: row.name, memberCount: Number(row.member_count ?? 0) }
}

/** Joins (or rejoins) the group with this invite code. Returns the group id. Throws 'bad_code' for a bad code. */
export async function joinGroup(code: string): Promise<string> {
  await ensureSession()
  const { data, error } = await supabase.rpc('join_group', { p_code: code })
  if (error) throw new Error(error.message)
  return data as string
}

/** Groups the signed-in user is an active member of, oldest membership first. */
export async function listMyGroups(): Promise<Group[]> {
  const uid = await ensureSession()
  const { data, error } = await supabase
    .from('memberships')
    .select('joined_at, groups(*)')
    .eq('profile_id', uid)
    .is('left_at', null)
    .order('joined_at', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Row[]).flatMap((m) => {
    const g = Array.isArray(m.groups) ? m.groups[0] : m.groups
    return g ? [toGroup(g)] : []
  })
}

/** Group admin only (enforced by RLS). Returns the new battle id. */
export async function createCustomBattle(i: {
  groupId: string
  playerA: string
  playerB: string
  revealAt: Date
  postDeadline: Date
  resultsAt: Date
}): Promise<string> {
  const { data, error } = await supabase
    .from('battles')
    .insert({
      group_id: i.groupId,
      player_a: i.playerA,
      player_b: i.playerB,
      reveal_at: i.revealAt.toISOString(),
      post_deadline: i.postDeadline.toISOString(),
      results_at: i.resultsAt.toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}
