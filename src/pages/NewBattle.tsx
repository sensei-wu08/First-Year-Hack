import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGroupContext } from '../components/GroupLayout'
import { useProfile } from '../data/auth'
import { createCustomBattle } from '../data/groups'
import { atLocalTime, localDateKey } from '../lib/time'

const pad = (n: number) => String(n).padStart(2, '0')

/** Date -> value for <input type="datetime-local"> in local time. */
function toInput(d: Date): string {
  return `${localDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NewBattle() {
  const { group, members } = useGroupContext()
  const { uid, loading } = useProfile()
  const navigate = useNavigate()
  const today = localDateKey(new Date())
  const [playerA, setPlayerA] = useState('')
  const [playerB, setPlayerB] = useState('')
  const [reveal, setReveal] = useState(toInput(atLocalTime(today, group.revealTime)))
  const [deadline, setDeadline] = useState(toInput(atLocalTime(today, group.postDeadlineTime)))
  const [results, setResults] = useState(toInput(atLocalTime(today, group.resultsTime)))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const active = members.filter((m) => !m.leftAt)

  if (loading) {
    return (
      <div className="screen">
        <p className="sub">Loading</p>
      </div>
    )
  }
  if (uid !== group.adminId) {
    return (
      <div className="screen">
        <h1 className="h-display">New battle</h1>
        <p className="panel">Only the group admin can create battles.</p>
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
    setBusy(true)
    setError(null)
    try {
      const id = await createCustomBattle({ groupId: group.id, playerA, playerB, revealAt, postDeadline, resultsAt })
      navigate(`/b/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the battle. Try again.')
      setBusy(false)
    }
  }

  const select = (label: string, value: string, set: (v: string) => void, other: string) => (
    <label className="flex flex-col gap-1.5 font-bold">
      {label}
      <select className="field" value={value} onChange={(e) => set(e.target.value)}>
        <option value="">Choose a player</option>
        {active.map((m) => (
          <option key={m.id} value={m.id} disabled={m.id === other}>
            {m.emoji} {m.name}
          </option>
        ))}
      </select>
    </label>
  )

  const time = (label: string, value: string, set: (v: string) => void) => (
    <label className="flex flex-col gap-1.5 font-bold">
      {label}
      <input className="field" type="datetime-local" value={value} onChange={(e) => set(e.target.value)} />
    </label>
  )

  return (
    <form className="screen" onSubmit={submit}>
      <h1 className="h-display">New battle</h1>
      {select('Home player', playerA, setPlayerA, playerB)}
      {select('Away player', playerB, setPlayerB, playerA)}
      {time('Matches out', reveal, setReveal)}
      {time('Post by', deadline, setDeadline)}
      {time('Results', results, setResults)}
      {error && (
        <p role="alert" className="font-bold text-down">
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
