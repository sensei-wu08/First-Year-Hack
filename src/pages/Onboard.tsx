import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { APP_NAME, TAGLINE } from '../brand'
import { upsertProfile, useProfile, useSlowLoading } from '../data/auth'
import { friendlyError } from '../data/groups'
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
    <div className="flex flex-col gap-2.5">
      <input
        className="input"
        aria-label="Your name"
        value={props.name}
        onChange={(e) => props.onName(e.target.value)}
        placeholder="Your name"
        autoComplete="given-name"
        maxLength={60}
      />
      <div role="group" aria-label="Pick your emoji" className="grid grid-cols-4 gap-2">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            className="grid aspect-square place-items-center rounded-full bg-white/20 text-[28px] leading-none ring-ink aria-pressed:bg-lime aria-pressed:ring-[3px]"
            aria-pressed={props.emoji === e}
            aria-label={`Emoji ${e}`}
            onClick={() => props.onEmoji(e)}
          >
            {e}
          </button>
        ))}
      </div>
      {props.error && (
        <p role="alert" className="tile tile-sm font-bold">
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
  const slow = useSlowLoading(loading)
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
      setError(friendlyError(err, 'Could not save your profile. Try again.'))
      setBusy(false)
    }
  }

  return (
    <div className="set-today">
      <form className="screen app-col pb-6" onSubmit={submit}>
        <div className="tile bg-pink">
          <h1 className="h-display">{APP_NAME}</h1>
          <p className="mt-1.5 pr-12 font-semibold">{TAGLINE}</p>
          <span className="sticker-sparkle absolute right-3.5 top-3.5 h-11 w-11" aria-hidden="true" />
        </div>
        <h2 className="h-tile mt-1">{profile ? 'Edit your profile' : 'Who are you?'}</h2>
        <ProfileFields name={name} emoji={emoji} onName={setName} onEmoji={setEmoji} error={error} />
        <button className="btn" type="submit" disabled={busy || loading}>
          {busy ? 'Saving' : profile ? 'Save profile' : "Let's go"}
        </button>
        {slow && <p className="sub">Still connecting… check your connection</p>}
      </form>
    </div>
  )
}
