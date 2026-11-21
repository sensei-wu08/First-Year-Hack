import { useCallback, useEffect, useState } from 'react'
import type { Member } from '../lib/types'
import { supabase } from './supabase'

let pending: Promise<string> | null = null

/** Signs in anonymously if there is no session. Returns the user id. */
export function ensureSession(): Promise<string> {
  if (!pending) {
    pending = (async () => {
      const { data: existing } = await supabase.auth.getSession()
      if (existing.session) return existing.session.user.id
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error || !data.user) throw new Error(error?.message ?? 'Could not start a session')
      return data.user.id
    })().catch((e) => {
      pending = null
      throw e
    })
  }
  return pending
}

/** True once `loading` has lasted `ms` (default 8 s), so screens can add a "still connecting" hint. */
export function useSlowLoading(loading: boolean, ms = 8000): boolean {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!loading) {
      setSlow(false)
      return
    }
    const t = setTimeout(() => setSlow(true), ms)
    return () => clearTimeout(t)
  }, [loading, ms])
  return slow
}

export function useProfile(): { uid: string | null; profile: Member | null; loading: boolean; refresh(): void } {
  const [uid, setUid] = useState<string | null>(null)
  const [profile, setProfile] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    let retry: ReturnType<typeof setTimeout> | undefined
    setLoading(true)
    ;(async () => {
      try {
        const id = await ensureSession()
        const { data, error } = await supabase.from('profiles').select('id, name, emoji').eq('id', id).maybeSingle()
        if (error) throw new Error(error.message)
        if (cancelled) return
        setUid(id)
        setProfile(data ? { id: data.id, name: data.name, emoji: data.emoji } : null)
        setLoading(false)
      } catch {
        // A network or server error is not "no profile": stay loading and retry,
        // so a flaky connection never bounces someone to onboarding.
        if (!cancelled) retry = setTimeout(() => setTick((t) => t + 1), 2000)
      }
    })()
    return () => {
      cancelled = true
      if (retry) clearTimeout(retry)
    }
  }, [tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return { uid, profile, loading, refresh }
}

export async function upsertProfile(name: string, emoji: string): Promise<Member> {
  const id = await ensureSession()
  const { data, error } = await supabase.from('profiles').upsert({ id, name, emoji }).select('id, name, emoji').single()
  if (error) throw new Error(error.message)
  return { id: data.id, name: data.name, emoji: data.emoji }
}
