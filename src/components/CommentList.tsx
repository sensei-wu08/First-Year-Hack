import type { CommentView } from '../lib/types'
import Avatar from './Avatar'
import { ReportButton } from './ReportButton'

/** Comments from a closed battle: name, emoji, body and a Report button. Never shows which side a voter picked. */
export function CommentList({ comments }: { comments: CommentView[] }) {
  if (comments.length === 0) return null
  return (
    <section className="flex flex-col gap-2" aria-label="Comments">
      <h2 className="vr-heading">What people said</h2>
      <ul className="flex flex-col gap-2">
        {comments.map((c, i) => (
          <li key={`${c.createdAt.getTime()}-${i}`} className="vr-bubble">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 vr-bubble-name">
                {c.authorEmoji && <Avatar emoji={c.authorEmoji} size={24} />}
                {c.authorName}
              </span>
              <ReportButton battleId={c.battleId} />
            </div>
            <p>{c.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
