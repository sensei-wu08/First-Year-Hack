import type { Group, Member } from '../lib/types'

// Stub: replaced by S7 (settings and season lifecycle). Keep the signature.
export async function onGroupLoad(group: Group, members: Member[]): Promise<void> {
  void group
  void members
}
