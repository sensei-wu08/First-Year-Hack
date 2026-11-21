export const REACTION_EMOJI = ['🔥', '😍', '😂', '👑', '🧊'] as const
export type ReactionEmoji = (typeof REACTION_EMOJI)[number]
export type ReactionSide = 'a' | 'b'

export interface ReactionCell {
  count: number
  mine: boolean
}
export type ReactionCounts = Record<ReactionEmoji, ReactionCell>
export interface ReactionState {
  a: ReactionCounts
  b: ReactionCounts
}

/** One row of the battle_reactions RPC. */
export interface ReactionRowData {
  side: string
  emoji: string
  count: number | string
  mine: boolean
}

function emptyCounts(): ReactionCounts {
  const out = {} as ReactionCounts
  for (const e of REACTION_EMOJI) out[e] = { count: 0, mine: false }
  return out
}

export function emptyReactionState(): ReactionState {
  return { a: emptyCounts(), b: emptyCounts() }
}

/** Folds RPC rows into a full state (every emoji present). Unknown sides or emoji are ignored. */
export function foldReactions(rows: readonly ReactionRowData[] | null | undefined): ReactionState {
  const state = emptyReactionState()
  for (const r of rows ?? []) {
    if (r.side !== 'a' && r.side !== 'b') continue
    const emoji = REACTION_EMOJI.find((e) => e === r.emoji)
    if (!emoji) continue
    state[r.side][emoji] = { count: Math.max(0, Number(r.count) || 0), mine: !!r.mine }
  }
  return state
}

/** Optimistic toggle: returns a new state with the emoji flipped and the count adjusted. */
export function applyToggle(state: ReactionState, side: ReactionSide, emoji: ReactionEmoji): ReactionState {
  const cell = state[side][emoji]
  const next: ReactionCell = cell.mine
    ? { count: Math.max(0, cell.count - 1), mine: false }
    : { count: cell.count + 1, mine: true }
  return { ...state, [side]: { ...state[side], [emoji]: next } }
}
