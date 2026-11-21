import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { InviteQr } from '../components/InviteQr'
import { createGroup } from '../data/groups'
import { getGroup } from '../data/reads'
import { cleanText } from '../lib/filter'

export default function CreateGroup() {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ id: string; name: string; inviteCode: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > 40) {
      setError('Give your group a name between 1 and 40 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const id = await createGroup(cleanText(trimmed).text)
      const g = await getGroup(id)
      setCreated({ id, name: g.name, inviteCode: g.inviteCode })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the group. Try again.')
      setBusy(false)
    }
  }

  if (created) {
    return (
      <div className="set-group">
        <div className="screen app-col">
          <h1 className="h-display">{created.name} is ready</h1>
          <p className="sub">Friends scan the code or open the link to join in one tap.</p>
          <InviteQr url={`${window.location.origin}/j/${created.inviteCode}`} label={`Join ${created.name} on Fits`} />
          <Link to={`/g/${created.id}`} className="btn">Go to {created.name}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="set-group">
      <form className="screen app-col" onSubmit={submit}>
        <h1 className="h-display">New group</h1>
        <label className="flex flex-col gap-1.5 font-bold">
          Group name
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Flat 4B"
            maxLength={60}
          />
        </label>
        {error && (
          <p role="alert" className="font-bold text-down">
            {error}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Creating' : 'Create group'}
        </button>
        <Link to="/" className="btn btn-ghost">Back to my groups</Link>
      </form>
    </div>
  )
}
