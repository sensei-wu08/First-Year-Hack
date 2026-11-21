import { useCallback, useEffect, useRef, useState } from 'react'
import { REACTION_EMOJI, listReactions, toggleReaction } from '../data/reactions'
import type { ReactionEmoji, ReactionSide, ReactionState } from '../data/reactions'
import { applyToggle } from '../lib/reactions'

const POLL_MS = 5000
const SIDES: ReactionSide[] = ['a', 'b']

/**
 * Emoji reactions under a battle: left column for side a, right for side b.
 * Renders nothing until the reactions SQL exists (listReactions returns null) and for a side with no post.
 * `names` is optional and only used for the buttons' aria-labels.
 */
export function ReactionRow({
  battleId,
  posted,
  names,
}: {
  battleId: string
  posted: { a: boolean; b: boolean }
  names?: [string, string]
}) {
  const [state, setState] = useState<ReactionState | null>(null)
  const [failed, setFailed] = useState(false)
  const pending = useRef(new Set<string>())
  // Bumped on every optimistic change, so a poll that started earlier can't overwrite it.
  const edits = useRef(0)
  const stateRef = useRef<ReactionState | null>(null)
  stateRef.current = state

  useEffect(() => {
    let cancelled = false
    let inFlight = false
    setState(null)
    setFailed(false)
    const poll = async () => {
      if (inFlight || cancelled) return
      inFlight = true
      const seen = edits.current
      try {
        const next = await listReactions(battleId)
        if (cancelled || edits.current !== seen || pending.current.size > 0) return
        setState(next)
      } catch (e) {
        console.error(e)
      } finally {
        inFlight = false
      }
    }
    void poll()
    const timer = setInterval(() => {
      if (!document.hidden) void poll()
    }, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [battleId])

  useEffect(() => {
    if (!failed) return
    const t = setTimeout(() => setFailed(false), 3000)
    return () => clearTimeout(t)
  }, [failed])

  const tap = useCallback(
    async (side: ReactionSide, emoji: ReactionEmoji) => {
      const key = `${side}${emoji}`
      const current = stateRef.current
      if (!current || pending.current.has(key)) return
      pending.current.add(key)
      edits.current += 1
      setFailed(false)
      setState(applyToggle(current, side, emoji))
      try {
        await toggleReaction(battleId, side, emoji)
      } catch (e) {
        console.error(e)
        edits.current += 1
        setState((s) => (s ? applyToggle(s, side, emoji) : s))
        setFailed(true)
      } finally {
        pending.current.delete(key)
      }
    },
    [battleId],
  )

  if (!state || (!posted.a && !posted.b)) return null

  return (
    <div className="rx-wrap">
      <div className="rx-row">
        {SIDES.map((side, i) => {
          if (!posted[side]) return <div key={side} className="rx-col" />
          const who = names?.[i] ?? (side === 'a' ? 'the left' : 'the right')
          const label = names ? `${who}'s fit` : `${who} fit`
          return (
            <div key={side} className={`rx-col rx-${side}`} role="group" aria-label={`Reactions to ${label}`}>
              {REACTION_EMOJI.map((emoji) => {
                const cell = state[side][emoji]
                return (
                  <button
                    key={emoji}
                    type="button"
                    className={`rx-pill${cell.mine ? ' rx-mine' : ''}`}
                    aria-pressed={cell.mine}
                    aria-label={`React ${emoji} to ${label}${cell.count ? `, ${cell.count} so far` : ''}`}
                    onClick={() => void tap(side, emoji)}
                  >
                    <span className="rx-emoji" aria-hidden="true">
                      {emoji}
                    </span>
                    <span className="rx-count" aria-hidden="true">
                      {cell.count}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      {failed && (
        <p className="rx-error" role="alert">
          Couldn't react
        </p>
      )}
    </div>
  )
}
