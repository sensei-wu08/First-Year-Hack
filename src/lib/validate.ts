import { cleanText } from './filter'

const NAME_MAX = 24
const COMMENT_MAX = 280

export function validateName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim().replace(/\s+/g, ' ')
  if (value === '') return { ok: false, error: 'Name is required' }
  if (Array.from(value).length > NAME_MAX) {
    return { ok: false, error: `Keep it to ${NAME_MAX} characters or fewer` }
  }
  if (cleanText(value).flagged) return { ok: false, error: 'Pick a different name' }
  return { ok: true, value }
}

/** Trim, cut to 280 characters (by code point, like Postgres char_length) and mask blocked words. Empty -> null. */
export function validateComment(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const cut = Array.from(trimmed).slice(0, COMMENT_MAX).join('').trimEnd()
  return cleanText(cut).text
}
