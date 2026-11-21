import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { upsertProfile, useProfile } from '../data/auth'
import { friendlyError, getGroupByInvite, joinGroup } from '../data/groups'
import { validateName } from '../lib/validate'
import { EMOJIS, ProfileFields } from './Onboard'

type Invite = { id: string; name: string; memberCount: number }

export default function Join() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { profile, loading: profileLoading } = useProfile()
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setInvite(undefined)
    setLoadError(null)
    getGroupByInvite(code)
      .then((g) => {
        if (!cancelled) setInvite(g)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(friendlyError(e, 'Could not load this invite. Check your connection and try again.'))
      })
    return () => {
      cancelled = true
    }
  }, [code, tick])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!invite) return
    setError(null)
    let cleanName = ''
    if (!profile) {
      const v = validateName(name)
      if (!v.ok) {
        setError(v.error)
        return
      }
      cleanName = v.value
    }
    setBusy(true)
    try {
      if (!profile) await upsertProfile(cleanName, emoji)
      const groupId = await joinGroup(code)
      navigate(`/g/${groupId}`, { replace: true })
    } catch (err) {
      setError(friendlyError(err, 'Could not join this group. Check your connection and try again.'))
      setBusy(false)
    }
  }

  let body
  if (loadError) {
    body = (
      <>
        <p className="tile" role="alert">{loadError}</p>
        <button className="btn" onClick={() => setTick((t) => t + 1)}>Try again</button>
      </>
    )
  } else if (invite === undefined || profileLoading) {
    body = <p className="sub">Loading your invite</p>
  } else if (invite === null) {
    body = (
      <p className="tile bg-pink font-bold" role="alert">
        This invite link isn't valid. Ask for a new one.
      </p>
    )
  } else {
    body = (
      <form className="flex flex-col gap-2.5" onSubmit={submit}>
        <div className="tile bg-pink">
          <h1 className="h-display pr-12">Join {invite.name}</h1>
          <p className="mt-1.5 font-semibold">
            {invite.memberCount === 1 ? '1 person is' : `${invite.memberCount} people are`} in this league.
          </p>
          <span className="sticker-sparkle absolute right-3.5 top-3.5 h-11 w-11" aria-hidden="true" />
        </div>
        {profile ? (
          <p className="chip self-start">
            You'll join as {profile.emoji} {profile.name}
          </p>
        ) : (
          <ProfileFields name={name} emoji={emoji} onName={setName} onEmoji={setEmoji} error={null} />
        )}
        {error && (
          <p role="alert" className="tile tile-sm font-bold">
            {error}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Joining' : `Join ${invite.name}`}
        </button>
      </form>
    )
  }

  return (
    <div className="set-join">
      <div className="screen app-col pb-6">{body}</div>
    </div>
  )
}
