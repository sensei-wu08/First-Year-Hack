import { BLOCKLIST } from './blocklist'

// Leetspeak substitutions used for comparison only. `1` is genuinely ambiguous ("ug1y" is ugly,
// "sh1t" is shit), so it maps to both `i` and `l` and a word matches if either reading is blocked.
const LEET: Record<string, string[]> = {
  '0': ['o'],
  '1': ['i', 'l'],
  '3': ['e'],
  '4': ['a'],
  '@': ['a'],
  $: ['s'],
}

// Cap on the readings tried per word, so a long run of 1s can't blow up.
const MAX_READINGS = 64

// A "word" is a run of letters, digits and the leetspeak symbols @ and $.
const WORD = /[\p{L}\p{N}@$]+/gu

/** Every lowercase, leetspeak-normalised reading of `word` (usually just one). */
function readings(word: string): string[] {
  let out = ['']
  for (const ch of Array.from(word.toLowerCase())) {
    const subs = LEET[ch] ?? [ch]
    const next: string[] = []
    for (const prefix of out) for (const s of subs) next.push(prefix + s)
    out = next.length > MAX_READINGS ? next.slice(0, MAX_READINGS) : next
  }
  return out
}

/** Mask whole blocklisted words (case-insensitive, leetspeak-aware) with `*` of the same length. */
export function cleanText(input: string): { text: string; flagged: boolean } {
  let flagged = false
  const text = input.replace(WORD, (word) => {
    if (!readings(word).some((r) => BLOCKLIST.has(r))) return word
    flagged = true
    return '*'.repeat(Array.from(word).length)
  })
  return { text, flagged }
}
