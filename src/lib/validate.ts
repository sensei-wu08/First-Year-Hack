import { notImplemented } from './notImplemented'

// Stubs: replaced by S1. Keep the signatures.
export function validateName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  void raw
  return notImplemented('validateName')
}

export function validateComment(raw: string): string | null {
  void raw
  return notImplemented('validateComment')
}
