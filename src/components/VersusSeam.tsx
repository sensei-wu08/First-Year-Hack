import type { ReactNode } from 'react'
import type { Member, PostView, Side } from '../lib/types'

/**
 * The shared split layout: home on the left, away on the right, a 10 degree slanted seam between them
 * and a round badge on the seam. `winner` expands that side (the reveal animation lives in theme.css).
 */
export function VersusSeam({
  left,
  right,
  badge,
  winner = null,
  dim = null,
  picked = null,
}: {
  left: ReactNode
  right: ReactNode
  badge: ReactNode
  winner?: Side | null
  dim?: Side | null
  picked?: Side | null
}) {
  const cls = (side: Side) =>
    [
      'versus-side',
      side === 'a' ? 'versus-home bg-pink' : 'versus-away bg-sky',
      dim === side ? 'is-dim' : '',
      picked === side ? 'is-picked' : '',
    ]
      .filter(Boolean)
      .join(' ')
  return (
    <div className={`versus${winner ? ` versus-won-${winner}` : ''}`}>
      <div className={cls('a')}>{left}</div>
      <div className={cls('b')}>{right}</div>
      <div className="vs-badge">{badge}</div>
    </div>
  )
}

/** One side's photo (or an empty state), with the player's name on it. */
export function FitSide({
  member,
  post,
  label,
  note,
}: {
  member: Member
  post: PostView | null
  label?: string
  note?: string
}) {
  return (
    <>
      {post ? (
        post.mediaType === 'video' ? (
          <video className="versus-photo" src={post.mediaUrl} muted loop playsInline autoPlay />
        ) : (
          <img className="versus-photo" src={post.mediaUrl} alt={`${member.name}'s fit`} draggable={false} />
        )
      ) : (
        <div className="versus-empty">
          <span className="versus-emoji" aria-hidden="true">
            {member.emoji}
          </span>
          <span>{note ?? 'No fit yet'}</span>
        </div>
      )}
      <span className="versus-name">{label ?? member.name}</span>
    </>
  )
}
