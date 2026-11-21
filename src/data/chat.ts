import { cleanText } from '../lib/filter'
import type { Member } from '../lib/types'
import { supabase } from './supabase'

export interface ChatMessage {
  id: string
  author: Member
  body: string
  createdAt: Date
}

const MAX_BODY = 500

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

/** The latest `limit` messages for a group, oldest first. */
export async function listMessages(groupId: string, limit = 100): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, body, created_at, author_id, author:profiles!author_id(id, name, emoji)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Row[])
    .map((r) => {
      // PostgREST may return the embedded profile as an object or a one-element array.
      const p: Row | undefined = Array.isArray(r.author) ? r.author[0] : r.author
      return {
        id: r.id as string,
        author: {
          id: (p?.id ?? r.author_id) as string,
          name: (p?.name ?? 'Someone') as string,
          emoji: (p?.emoji ?? '👤') as string,
        },
        body: r.body as string,
        createdAt: new Date(r.created_at),
      }
    })
    .reverse()
}

/** Sends a message as the signed-in member. The body is trimmed and masked by the word filter (1-500 characters). */
export async function sendMessage(groupId: string, body: string): Promise<void> {
  const { text } = cleanText(body.trim())
  const length = Array.from(text).length
  if (length < 1) throw new Error('Write a message first')
  if (length > MAX_BODY) throw new Error(`Keep messages under ${MAX_BODY} characters`)
  const { error } = await supabase.from('messages').insert({ group_id: groupId, body: text })
  if (error) throw new Error(error.message)
}

/** Plain copy for a failed send: our own validation messages pass through, RLS means the member left, the rest is a network problem. */
export function friendlySendError(e: unknown): string {
  const msg = e instanceof Error ? e.message : ''
  if (msg === 'Write a message first' || msg.startsWith('Keep messages under')) return msg
  const m = msg.toLowerCase()
  if (m.includes('row-level security') || m.includes('permission denied') || m.includes('42501')) {
    return "You're not in this group any more."
  }
  return "Couldn't send. Check your connection and try again."
}
