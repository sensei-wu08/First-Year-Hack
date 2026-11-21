import { ensureSession } from './auth'
import { supabase } from './supabase'

export type SubmitErrorCode = 'too_late' | 'not_open' | 'already_posted' | 'not_player' | 'upload' | 'unknown'

/** A failure from submitPost. `message` is friendly copy that is safe to show as is. */
export class SubmitError extends Error {
  code: SubmitErrorCode
  /** True when trying again could work (a flaky connection). False for rule failures. */
  retryable: boolean
  constructor(code: SubmitErrorCode, message: string, retryable: boolean) {
    super(message)
    this.name = 'SubmitError'
    this.code = code
    this.retryable = retryable
  }
}

const RULE_COPY: Record<'too_late' | 'not_open' | 'already_posted' | 'not_player', string> = {
  too_late: 'Too late. The posting deadline for this battle has passed.',
  not_open: 'Posting is not open for this battle right now.',
  already_posted: 'You already posted your fit for this battle.',
  not_player: 'Only the two battlers can post a fit for this battle.',
}

const NETWORK_COPY = 'Could not upload your fit. Check your connection, then try again.'

/** Uploads the media to `${uid}/${battleId}.jpg|webm`, then records it with the submit_post RPC. */
export async function submitPost(battleId: string, blob: Blob, type: 'photo' | 'video'): Promise<void> {
  let uid: string
  try {
    uid = await ensureSession()
  } catch {
    throw new SubmitError('unknown', NETWORK_COPY, true)
  }

  const path = `${uid}/${battleId}.${type === 'photo' ? 'jpg' : 'webm'}`
  // upsert, so a retry after a failed RPC call does not trip over the file that already uploaded.
  const { error: uploadError } = await supabase.storage.from('outfits').upload(path, blob, {
    contentType: blob.type || (type === 'photo' ? 'image/jpeg' : 'video/webm'),
    upsert: true,
  })
  if (uploadError) throw new SubmitError('upload', NETWORK_COPY, true)

  const { error } = await supabase.rpc('submit_post', { p_battle: battleId, p_path: path, p_type: type })
  if (error) {
    for (const code of Object.keys(RULE_COPY) as (keyof typeof RULE_COPY)[]) {
      if (error.message.includes(code)) throw new SubmitError(code, RULE_COPY[code], false)
    }
    throw new SubmitError('unknown', NETWORK_COPY, true)
  }
}

/** Names for a battle's two players, keyed by profile id. */
export async function getPlayerNames(ids: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('profiles').select('id, name').in('id', ids)
  if (error || !data) return {}
  return Object.fromEntries(data.map((p) => [p.id as string, p.name as string]))
}
