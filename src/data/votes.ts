import { useCallback, useEffect, useRef, useState } from 'react'
import type { BattleRecord, BattleView, CommentView, Member, PostView, Side, Tally } from '../lib/types'
import { publicUrl } from './reads'
import { supabase } from './supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const VOTE_CODES = ['battler', 'not_allowed', 'closed', 'not_open', 'already_voted', 'not_admin']

/** Postgres raises short codes ('already_voted'); keep just the code so the UI can match on it. */
function codeError(error: { message: string }): Error {
  const code = VOTE_CODES.find((c) => error.message.includes(c))
  return new Error(code ?? error.message)
}

export async function castVote(battleId: string, side: Side, comment: string | null): Promise<void> {
  const { error } = await supabase.rpc('cast_vote', { p_battle: battleId, p_side: side, p_comment: comment })
  if (error) throw codeError(error)
}

/** Which side the signed-in user voted for (votes is select-own), or null. */
export async function myVote(battleId: string): Promise<Side | null> {
  const { data, error } = await supabase.from('votes').select('side').eq('battle_id', battleId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? (data.side as Side) : null
}

export async function revealNow(battleId: string): Promise<void> {
  const { error } = await supabase.rpc('reveal_now', { p_battle: battleId })
  if (error) throw codeError(error)
}

function toComment(r: Row, battleId: string): CommentView {
  return {
    battleId,
    side: r.side,
    authorName: r.author_name,
    authorEmoji: r.author_emoji ?? null,
    body: r.body,
    createdAt: new Date(r.created_at),
  }
}

export async function listComments(battleIds: string[]): Promise<CommentView[]> {
  if (battleIds.length === 0) return []
  const { data, error } = await supabase
    .from('battle_comments')
    .select('*')
    .in('battle_id', battleIds)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Row[]).map((r) => toComment(r, r.battle_id))
}

export async function report(t: { battleId?: string; messageId?: string }, reason: string): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .insert({ battle_id: t.battleId ?? null, message_id: t.messageId ?? null, reason })
  if (error) throw new Error(error.message)
}

function toRecord(r: Row): BattleRecord {
  return {
    id: r.id,
    groupId: r.group_id,
    seasonId: r.season_id ?? null,
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

export interface ShareBattle {
  view: BattleView
  group: { name: string; commentsEnabled: boolean }
  players: Member[]
  comments: CommentView[]
}

/** Public battle for a share link. Null when share voting is off or the code is unknown. */
export async function getShareBattle(code: string): Promise<ShareBattle | null> {
  const { data, error } = await supabase.rpc('battle_by_share_code', { p_code: code })
  if (error) throw new Error(error.message)
  if (!data) return null
  const j = data as Row
  const record = toRecord(j.battle)
  const posts: PostView[] = ((j.posts ?? []) as Row[]).map((p) => ({
    profileId: p.profile_id,
    mediaPath: p.media_path,
    mediaUrl: publicUrl(p.media_path),
    mediaType: p.media_type,
  }))
  const tally: Tally = {
    total: Number(j.tally?.total ?? 0),
    votesA: j.tally?.votes_a ?? null,
    votesB: j.tally?.votes_b ?? null,
  }
  return {
    view: { record, posts, tally },
    group: { name: j.group?.name ?? '', commentsEnabled: !!j.group?.comments_enabled },
    players: ((j.players ?? []) as Row[]).map((p) => ({ id: p.id, name: p.name, emoji: p.emoji })),
    comments: ((j.comments ?? []) as Row[]).map((c) => toComment(c, record.id)),
  }
}

// ---------- Polling and clock hooks (battle pages poll every 5 s, no Realtime) ----------

const STALE_MS = 15000

/**
 * Runs `load` now and every `intervalMs` while the tab is visible. Keeps the last good data when a poll
 * fails. `stopWhen` ends the interval once there is nothing left to wait for. `reload` always runs.
 */
export function usePoll<T>(load: () => Promise<T>, stopWhen?: (d: T) => boolean, intervalMs = 5000) {
  const [state, setState] = useState<{ loaded: boolean; data: T | undefined; error: string | null }>({
    loaded: false,
    data: undefined,
    error: null,
  })
  const stopRef = useRef(stopWhen)
  stopRef.current = stopWhen
  const runRef = useRef<(force?: boolean) => Promise<void>>(async () => {})

  useEffect(() => {
    let cancelled = false
    let stopped = false
    setState({ loaded: false, data: undefined, error: null })
    // inFlight: timer and visibility polls skip while a run is pending (slow Wi-Fi must not stack requests).
    // seq: only the latest run may write state, so a late stale response can't undo a newer one.
    // A run in flight for over STALE_MS is treated as hung: the next tick may start a new one.
    let inFlight = false
    let startedAt = 0
    let seq = 0
    const run = async (force = false) => {
      if (stopped && !force) return
      if (inFlight && !force && Date.now() - startedAt < STALE_MS) return
      const mine = ++seq
      inFlight = true
      startedAt = Date.now()
      try {
        const d = await load()
        if (cancelled || mine !== seq) return
        stopped = !!stopRef.current?.(d)
        setState({ loaded: true, data: d, error: null })
      } catch (e) {
        if (cancelled || mine !== seq) return
        console.error(e)
        const message = e instanceof Error ? e.message : 'Something went wrong'
        setState((s) => ({ loaded: true, data: s.data, error: message }))
      } finally {
        if (mine === seq) inFlight = false
      }
    }
    runRef.current = run
    void run(true)
    const timer = setInterval(() => {
      if (!document.hidden) void run()
    }, intervalMs)
    const onVisible = () => {
      if (!document.hidden) void run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, intervalMs])

  const reload = useCallback(() => runRef.current(true), [])
  return { ...state, reload }
}

export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

// ---------- Display helpers ----------

/** "09:00" for today, "Sat 09:00" for another day. */
export function formatWhen(d: Date, now: Date): string {
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return time
  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}`
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'any moment now'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h >= 1) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(s % 60).padStart(2, '0')}s`
}
