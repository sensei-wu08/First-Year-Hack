import type { Group, Member } from '../lib/types'
import { localDateKey } from '../lib/time'
import { currentSeason } from './reads'
import { startSeason } from './seasons'

const inFlight = new Map<string, Promise<void>>()

function isExpected(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null
  const msg = (err?.message ?? '').toLowerCase()
  return err?.code === '23505' || msg.includes('season_active') || msg.includes('duplicate key') || msg.includes('unique')
}

async function run(group: Group, members: Member[]): Promise<void> {
  try {
    if (members.length < 2) return
    const latest = await currentSeason(group.id)
    // Only roll over a season that has finished. Groups with no season (custom battles only) stay as they are.
    if (!latest || latest.endsOn >= localDateKey(new Date())) return
    await startSeason(group, members.map((m) => m.id), localDateKey(new Date()))
  } catch (e) {
    // Someone else started the next season first (or it is still running): nothing to do.
    // Anything else must not break the group screen either, so it is only logged.
    if (!isExpected(e)) console.warn('Could not start the next season', e)
  }
}

/**
 * Called by GroupLayout on every group load. When the latest season ended before today and no later season exists,
 * starts the next one for the active members. Safe to call repeatedly and concurrently; never throws.
 */
export function onGroupLoad(group: Group, members: Member[]): Promise<void> {
  const running = inFlight.get(group.id)
  if (running) return running
  const p = run(group, members).finally(() => {
    inFlight.delete(group.id)
  })
  inFlight.set(group.id, p)
  return p
}
