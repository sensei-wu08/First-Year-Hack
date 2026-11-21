import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { onGroupLoad } from '../data/lifecycle'
import { getGroup, listMembers } from '../data/reads'
import type { Group, Member } from '../lib/types'
import BottomNav from './BottomNav'

export interface GroupContext {
  group: Group
  members: (Member & { leftAt: Date | null })[]
  reload(): void
}

/** Pages under /g/:groupId read the loaded group and members with this hook. */
export function useGroupContext(): GroupContext {
  return useOutletContext<GroupContext>()
}

function setFor(pathname: string, groupId: string): string {
  const rest = pathname.slice(`/g/${groupId}`.length).replace(/^\/+/, '').split('/')[0]
  switch (rest) {
    case 'table':
      return 'set-league'
    case 'chat':
      return 'set-chat'
    case 'settings':
      return 'set-group'
    case 'wrapped':
      return 'set-wrapped'
    default:
      return 'set-today'
  }
}

export default function GroupLayout() {
  const { groupId = '' } = useParams()
  const { pathname } = useLocation()
  const [ctx, setCtx] = useState<{ group: Group; members: GroupContext['members'] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(null)
    ;(async () => {
      try {
        const [group, members] = await Promise.all([getGroup(groupId), listMembers(groupId)])
        if (cancelled) return
        setCtx({ group, members })
        const active = members.filter((m) => !m.leftAt)
        await onGroupLoad(group, active)
        if (cancelled) return
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load this group')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [groupId, tick])

  const set = setFor(pathname, groupId)
  const showNav = set !== 'set-wrapped'
  // The error screens have nothing for the tabs to open, so the nav stays hidden there.
  const errorScreen = error === 'not_member' || (error !== null && !(ctx && ctx.group.id === groupId))

  return (
    <div className={`${set} flex flex-col`}>
      <div className="app-col flex-1">
        {error === 'not_member' ? (
          <div className="screen">
            <p className="panel">You're not in this group. Ask for an invite link.</p>
            <Link to="/" className="btn">Go home</Link>
          </div>
        ) : error && !(ctx && ctx.group.id === groupId) ? (
          <div className="screen">
            <p className="panel">Couldn't open this group. Check your connection and try again.</p>
            <button className="btn" onClick={() => setTick((t) => t + 1)}>Try again</button>
          </div>
        ) : ctx && ctx.group.id === groupId ? (
          // A failed background reload keeps the last good data on screen (flaky venue Wi-Fi).
          <Outlet context={{ ...ctx, reload: () => setTick((t) => t + 1) } satisfies GroupContext} />
        ) : (
          <div className="screen">
            <p className="sub">Loading your group</p>
          </div>
        )}
      </div>
      {showNav && !errorScreen && <BottomNav groupId={groupId} />}
    </div>
  )
}
