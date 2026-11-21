import { REACTION_EMOJI, foldReactions } from '../lib/reactions'
import type { ReactionEmoji, ReactionRowData, ReactionSide, ReactionState } from '../lib/reactions'
import { supabase } from './supabase'

export { REACTION_EMOJI }
export type { ReactionEmoji, ReactionSide, ReactionState }

function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST202' || (error.message ?? '').includes('Could not find the function')
}

/** Reactions for a battle, or null when the SQL isn't applied yet (the UI then hides itself). */
export async function listReactions(battleId: string): Promise<ReactionState | null> {
  const { data, error } = await supabase.rpc('battle_reactions', { p_battle: battleId })
  if (error) {
    if (isMissingFunction(error)) return null
    throw new Error(error.message)
  }
  return foldReactions((data ?? []) as ReactionRowData[])
}

/** Toggles one reaction. Resolves true when it is now on. */
export async function toggleReaction(battleId: string, side: ReactionSide, emoji: ReactionEmoji): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_reaction', { p_battle: battleId, p_side: side, p_emoji: emoji })
  if (error) throw new Error(error.message)
  return data === true
}
