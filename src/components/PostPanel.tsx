import { useEffect, useRef, useState } from 'react'
import { postedOf } from '../data/mappers'
import { getPlayerNames, submitPost, SubmitError } from '../data/posts'
import { battlePhase } from '../lib/phase'
import type { BattleView } from '../lib/types'
import { Camera } from './Camera'

function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

function countdown(to: Date, now: Date): string {
  const s = Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000))
  if (s === 0) return 'Deadline passed'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m left`
  return `${m}m ${String(s % 60).padStart(2, '0')}s left`
}

function clock(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

type Step = 'idle' | 'camera' | 'uploading' | 'failed'

const FALLBACK_ERROR = { message: 'Could not upload your fit. Check your connection, then try again.', retryable: true }

export function PostPanel({ view, viewerId, onPosted }: { view: BattleView; viewerId: string; onPosted(): void }) {
  const { record } = view
  const now = useNow()
  const [step, setStep] = useState<Step>('idle')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null)
  const [justPosted, setJustPosted] = useState(false)
  const busy = useRef(false)
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    void getPlayerNames([record.playerA, record.playerB]).then((n) => {
      if (!cancelled) setNames(n)
    })
    return () => {
      cancelled = true
    }
  }, [record.playerA, record.playerB])

  const mySide = viewerId === record.playerA ? 'a' : viewerId === record.playerB ? 'b' : null
  const fromView = postedOf(view)
  // justPosted covers the gap before the parent refetches the battle.
  const posted = { a: fromView.a || (mySide === 'a' && justPosted), b: fromView.b || (mySide === 'b' && justPosted) }
  const phase = battlePhase(record, posted, now)
  const iPosted = mySide !== null && posted[mySide]
  const canPost = mySide !== null && !iPosted && phase === 'posting'

  function finish() {
    setJustPosted(true)
    setBlob(null)
    setStep('idle')
    onPosted()
  }

  async function upload(photo: Blob) {
    if (busy.current) return
    busy.current = true
    try {
      await doUpload(photo)
    } finally {
      busy.current = false
    }
  }

  async function doUpload(photo: Blob) {
    setBlob(photo)
    setStep('uploading')
    setError(null)
    try {
      await submitPost(record.id, photo, 'photo')
      finish()
    } catch (e) {
      if (e instanceof SubmitError && e.code === 'already_posted') {
        finish()
        return
      }
      setError(e instanceof SubmitError ? { message: e.message, retryable: e.retryable } : FALLBACK_ERROR)
      setStep('failed')
    }
  }

  if (step === 'camera') {
    return <Camera onCapture={(photo) => void upload(photo)} onCancel={() => setStep('idle')} />
  }

  const rows = [
    { id: record.playerA, done: posted.a },
    { id: record.playerB, done: posted.b },
  ]

  return (
    <section className="tile flex flex-col gap-3" aria-label="Posting status">
      {phase === 'posting' && (
        <p>
          <strong className="h-tile">Post by {clock(record.postDeadline)}</strong>{' '}
          <span className="sub">{countdown(record.postDeadline, now)}</span>
        </p>
      )}

      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {rows.map((r) => (
          <li key={r.id} className={`chip ${r.done ? 'bg-lime' : 'bg-lavender'}`}>
            {r.done ? '✓ Posted' : `Waiting for ${r.id === viewerId ? 'you' : (names[r.id] ?? 'them')}`}
          </li>
        ))}
      </ul>

      {step === 'uploading' && (
        <button type="button" className="btn" disabled>
          Posting…
        </button>
      )}

      {step === 'failed' && error && (
        <div className="flex flex-col gap-2.5">
          <p role="alert" className="tile tile-sm bg-down font-bold">
            {error.message}
          </p>
          {error.retryable && blob && (
            <button type="button" className="btn btn-dark" onClick={() => void upload(blob)}>
              Try again
            </button>
          )}
        </div>
      )}

      {canPost && step === 'idle' && (
        <button type="button" className="btn" onClick={() => setStep('camera')}>
          Post my fit
        </button>
      )}
    </section>
  )
}
