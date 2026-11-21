import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGroupContext } from '../components/GroupLayout'
import { useProfile, useSlowLoading } from '../data/auth'
import { createCustomBattle, friendlyError } from '../data/groups'
import { localDateKey } from '../lib/time'

const pad = (n: number) => String(n).padStart(2, '0')

/** Date -> value for <input type="datetime-local"> in local time. */
function toInput(d: Date): string {
  return `${localDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const MIN = 60_000

/** Now, rounded up to the next 5 minutes. */
function nextFive(): Date {
  return new Date(Math.ceil(Date.now() / (5 * MIN)) * 5 * MIN)
}

export default function NewBattle() {
  const { group, members, reload } = useGroupContext()
  const { uid, loading } = useProfile()
  const slow = useSlowLoading(loading)
  const navigate = useNavigate()
  const [playerA, setPlayerA] = useState('')
  const [playerB, setPlayerB] = useState('')
  const [start] = useState(nextFive)
  const [reveal, setReveal] = useState(toInput(start))
  const [deadline, setDeadline] = useState(toInput(new Date(start.getTime() + 30 * MIN)))
  const [results, setResults] = useState(toInput(new Date(start.getTime() + 120 * MIN)))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Members may have joined since the group opened, so refetch once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [])

  const active = members.filter((m) => !m.leftAt)

  if (loading) {
    return (
      <div className="screen">
        <p className="sub">Loading</p>
        {slow && <p className="sub">Still connecting… check your connection</p>}
      </div>
    )
  }
  if (uid !== group.adminId) {
    return (
      <div className="screen pb-2">
        <h1 className="h-display">New battle</h1>
        <p className="tile bg-lavender">Only the group admin can create battles.</p>
        <Link to={`/g/${group.id}`} className="btn">Back to today</Link>
      </div>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!playerA || !playerB) {
      setError('Choose both players.')
      return
    }
    if (playerA === playerB) {
      setError('Pick two different players.')
      return
    }
    const revealAt = new Date(reveal)
    const postDeadline = new Date(deadline)
    const resultsAt = new Date(results)
    if ([revealAt, postDeadline, resultsAt].some((d) => Number.isNaN(d.getTime()))) {
      setError('Fill in all three times.')
      return
    }
    if (!(revealAt < postDeadline && postDeadline < resultsAt)) {
      setError('Times must go in order: matches out, then post by, then results.')
      return
    }
    if (resultsAt <= new Date()) {
      setError('Results time has already passed. Pick a time in the future.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const id = await createCustomBattle({ groupId: group.id, playerA, playerB, revealAt, postDeadline, resultsAt })
      navigate(`/b/${id}`)
    } catch (err) {
      setError(friendlyError(err, 'Could not create the battle. Try again.'))
      setBusy(false)
    }
  }

  const select = (label: string, tone: string, value: string, set: (v: string) => void, other: string) => (
    <label className="flex flex-col gap-1.5">
      <span className={`chip self-start ${tone}`}>{label}</span>
      <select className="input" value={value} onChange={(e) => set(e.target.value)}>
        <option value="">Choose a player</option>
        {active.map((m) => (
          <option key={m.id} value={m.id} disabled={m.id === other}>
            {m.emoji} {m.name}
          </option>
        ))}
      </select>
    </label>
  )

  const time = (label: string, tone: string, value: string, set: (v: string) => void) => (
    <label className="flex flex-col gap-1.5">
      <span className={`chip self-start ${tone}`}>{label}</span>
      <input className="input" type="datetime-local" value={value} onChange={(e) => set(e.target.value)} />
    </label>
  )

  return (
    <form className="screen pb-2" onSubmit={submit}>
      <h1 className="h-display">New battle</h1>
      {select('Home player', 'bg-pink', playerA, setPlayerA, playerB)}
      {select('Away player', 'bg-sky', playerB, setPlayerB, playerA)}
      {time('Matches out', 'bg-mint', reveal, setReveal)}
      {time('Post by', 'bg-pink', deadline, setDeadline)}
      {time('Results', 'bg-sky', results, setResults)}
      {error && (
        <p role="alert" className="tile tile-sm font-bold">
          {error}
        </p>
      )}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Creating' : 'Create battle'}
      </button>
      <Link to={`/g/${group.id}`} className="btn btn-ghost">Cancel</Link>
    </form>
  )
}
