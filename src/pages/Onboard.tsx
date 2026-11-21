import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { APP_NAME, TAGLINE } from '../brand'
import { upsertProfile, useProfile } from '../data/auth'
import { validateName } from '../lib/validate'

export const EMOJIS = ['🦊', '🐸', '🦄', '🐙', '🌵', '🐼', '🐯', '🐵', '🦖', '🍕', '🌈', '🔥', '👑', '🧢', '👟', '🦋']

/** Name input plus the 16-emoji grid. Shared by Onboard and Join. */
export function ProfileFields(props: {
  name: string
  emoji: string
  onName(v: string): void
  onEmoji(v: string): void
  error: string | null
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 font-bold">
        Your name
        <input
          className="field"
          value={props.name}
          onChange={(e) => props.onName(e.target.value)}
          placeholder="What your friends call you"
          autoComplete="given-name"
          maxLength={60}
        />
      </label>
      <div role="group" aria-label="Pick your emoji" className="emoji-grid">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            className="emoji-btn"
            aria-pressed={props.emoji === e}
            aria-label={`Emoji ${e}`}
            onClick={() => props.onEmoji(e)}
          >
            {e}
          </button>
        ))}
      </div>
      {props.error && (
        <p role="alert" className="font-bold text-down">
          {props.error}
        </p>
      )}
    </div>
  )
}

function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
}

export default function Onboard() {
  const { profile, loading } = useProfile()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setEmoji(profile.emoji)
    }
  }, [profile])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const v = validateName(name)
    if (!v.ok) {
      setError(v.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await upsertProfile(v.value, emoji)
      navigate(safeNext(params.get('next')), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile. Try again.')
      setBusy(false)
    }
  }

  return (
    <div className="set-today">
      <form className="screen app-col" onSubmit={submit}>
        <div>
          <h1 className="h-display">{APP_NAME}</h1>
          <p className="sub mt-2">{TAGLINE}</p>
        </div>
        <div className="panel">
          <h2 className="mb-3 text-title font-bold">{profile ? 'Edit your profile' : 'Who are you?'}</h2>
          <ProfileFields name={name} emoji={emoji} onName={setName} onEmoji={setEmoji} error={error} />
        </div>
        <button className="btn" type="submit" disabled={busy || loading}>
          {busy ? 'Saving' : profile ? 'Save profile' : "Let's go"}
        </button>
      </form>
    </div>
  )
}
