import { notImplemented } from './notImplemented'
import type { BattleFacts, BattleResult } from './types'

// Stubs: replaced by S1. Keep the signatures.
export function scoreBattle(f: BattleFacts, now: Date): BattleResult | null {
  void f
  void now
  return notImplemented('scoreBattle')
}

export function resolveAll(facts: BattleFacts[], now: Date): BattleResult[] {
  void facts
  void now
  return notImplemented('resolveAll')
}
