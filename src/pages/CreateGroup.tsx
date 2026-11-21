import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { InviteQr } from '../components/InviteQr'
import { createGroup, friendlyError } from '../data/groups'
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
      setError(friendlyError(err, 'Could not create the group. Try again.'))
      setBusy(false)
    }
  }

  if (created) {
    return (
      <div className="set-group">
        <div className="screen app-col pb-6">
          <div className="tile bg-lime">
            <h1 className="h-display pr-12">{created.name} is ready</h1>
            <p className="mt-1.5 font-semibold">Friends scan the code or open the link to join in one tap.</p>
            <span className="sticker-sparkle absolute right-3.5 top-3.5 h-11 w-11 bg-pink" aria-hidden="true" />
          </div>
          <InviteQr url={`${window.location.origin}/j/${created.inviteCode}`} label={`Join ${created.name} on Fits`} />
          <Link to={`/g/${created.id}`} className="btn">Go to {created.name}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="set-group">
      <form className="screen app-col pb-6" onSubmit={submit}>
        <h1 className="h-display">New group</h1>
        <input
          className="input"
          aria-label="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name, like Flat 4B"
          maxLength={40}
        />
        {error && (
          <p role="alert" className="tile tile-sm font-bold">
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
