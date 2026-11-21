import { defaultBattlesPerDay, redateRemaining, scheduleSeason, type DayTimes } from '../lib/scheduler'
import { mulberry32 } from '../lib/rng'
import { addDays, atLocalTime, localDateKey } from '../lib/time'
import type { Group, Season } from '../lib/types'
import { ensureSession } from './auth'
import { listBattles } from './reads'
import { supabase } from './supabase'

export type GroupSettingsPatch = Partial<
  Pick<Group, 'revealTime' | 'postDeadlineTime' | 'resultsTime' | 'battlesPerDay' | 'allowShareVoting' | 'commentsEnabled'>
>

/** An Error that keeps the Postgres/PostgREST code (for example '23505' for a unique violation). */
export class DataError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

/** Admin only (RLS). Throws 'not_allowed' when no row changed (someone who isn't the admin). */
export async function updateGroupSettings(groupId: string, patch: GroupSettingsPatch): Promise<void> {
  await ensureSession()
  const row: Record<string, unknown> = {}
  if (patch.revealTime !== undefined) row.reveal_time = patch.revealTime
  if (patch.postDeadlineTime !== undefined) row.post_deadline_time = patch.postDeadlineTime
  if (patch.resultsTime !== undefined) row.results_time = patch.resultsTime
  if (patch.battlesPerDay !== undefined) row.battles_per_day = patch.battlesPerDay
  if (patch.allowShareVoting !== undefined) row.allow_share_voting = patch.allowShareVoting
  if (patch.commentsEnabled !== undefined) row.comments_enabled = patch.commentsEnabled
  if (Object.keys(row).length === 0) return
  const { data, error } = await supabase.from('groups').update(row).eq('id', groupId).select('id')
  if (error) throw new DataError(error.message, error.code)
  if (!data || data.length === 0) throw new DataError('not_allowed')
}

/**
 * Schedules a season for `memberIds` from `startDate` and saves it. Returns the new season id.
 * The manual "Start season" button uses create_season; `auto: true` (lifecycle) uses start_next_season.
 */
export async function startSeason(
  group: Group,
  memberIds: string[],
  startDate: string,
  opts: { auto?: boolean } = {},
): Promise<string> {
  await ensureSession()
  if (memberIds.length < 2) throw new DataError('need_members')
  const perDay = Math.max(1, group.battlesPerDay ?? defaultBattlesPerDay(memberIds.length))
  const scheduled = scheduleSeason({
    memberIds,
    startDate,
    battlesPerDay: perDay,
    times: { reveal: group.revealTime, postDeadline: group.postDeadlineTime, results: group.resultsTime },
    rng: mulberry32(Date.now() % 2 ** 31),
  })
  const endsOn = scheduled.reduce((last, b) => (b.date > last ? b.date : last), startDate)
  // The automatic path uses start_next_season (0002): it applies the "no overlap" rule to everyone, admin included.
  const { data, error } = await supabase.rpc(opts.auto ? 'start_next_season' : 'create_season', {
    p_group: group.id,
    p_starts: startDate,
    p_ends: endsOn,
    p_battles: scheduled.map((b) => ({
      player_a: b.playerA,
      player_b: b.playerB,
      reveal_at: b.revealAt.toISOString(),
      post_deadline: b.postDeadline.toISOString(),
      results_at: b.resultsAt.toISOString(),
    })),
  })
  if (error) throw new DataError(error.message, error.code)
  return data as string
}

/** Admin only (RLS). Moves each battle's three timestamps. */
export async function updateBattleTimes(
  rows: { id: string; revealAt: Date; postDeadline: Date; resultsAt: Date }[],
): Promise<void> {
  await ensureSession()
  for (let i = 0; i < rows.length; i += 10) {
    const results = await Promise.all(
      rows.slice(i, i + 10).map((r) =>
        supabase
          .from('battles')
          .update({
            reveal_at: r.revealAt.toISOString(),
            post_deadline: r.postDeadline.toISOString(),
            results_at: r.resultsAt.toISOString(),
          })
          .eq('id', r.id)
          .select('id'),
      ),
    )
    for (const { data, error } of results) {
      if (error) throw new DataError(error.message, error.code)
      if (!data || data.length === 0) throw new DataError('not_allowed')
    }
  }
}

/** Leaves the group. Future battles are voided on the server; points stay. */
export async function leaveGroup(groupId: string): Promise<void> {
  await ensureSession()
  const { error } = await supabase.rpc('leave_group', { p_group: groupId })
  if (error) throw new DataError(error.message, error.code)
}

/**
 * After the times or battles/day change mid-season: re-packs the battles that haven't been revealed yet
 * (same pairs, same order) from the first day that can still hold them, then moves the season's end date.
 * Returns how many battles moved.
 */
export async function redateUpcoming(
  groupId: string,
  season: Season,
  times: DayTimes,
  battlesPerDay: number,
  now: Date = new Date(),
): Promise<number> {
  const views = await listBattles(groupId, season.id)
  const live = views.filter((v) => !v.record.voidedAt && !v.record.closedAt)
  const upcoming = live.filter((v) => v.record.revealAt > now)
  if (upcoming.length === 0) return 0

  // Start today only if nothing has been revealed today yet (otherwise a player could battle twice in a day)
  // and the new reveal time is still ahead. Otherwise start tomorrow.
  const today = localDateKey(now)
  const revealedToday = views.some((v) => v.record.revealAt <= now && localDateKey(v.record.revealAt) === today)
  const fromDate = !revealedToday && atLocalTime(today, times.reveal) > now ? today : addDays(today, 1)

  const moved = redateRemaining({
    battles: upcoming.map((v) => ({ id: v.record.id, playerA: v.record.playerA, playerB: v.record.playerB })),
    fromDate,
    battlesPerDay: Math.max(1, battlesPerDay),
    times,
  })
  await updateBattleTimes(moved)

  const dates = [
    ...moved.map((r) => r.date),
    ...live.filter((v) => v.record.revealAt <= now).map((v) => localDateKey(v.record.revealAt)),
  ]
  const endsOn = dates.reduce((m, d) => (d > m ? d : m), season.startsOn)
  if (endsOn === season.endsOn) return moved.length

  // Needs the seasons_update policy from 0002_settings.sql. PostgREST returns 0 rows (no error) without it.
  const { data, error } = await supabase.from('seasons').update({ ends_on: endsOn }).eq('id', season.id).select('id')
  if (error) throw new DataError(error.message, error.code)
  if (!data || data.length === 0) throw new DataError('season_end_not_moved')
  return moved.length
}
