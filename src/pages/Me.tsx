import { useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { useProfile } from '../data/auth'
import { monthKey } from '../lib/time'

export default function Me() {
  const { uid, profile } = useProfile()
  const [copied, setCopied] = useState(false)
  const now = new Date()
  const previousMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))

  async function copyUid() {
    if (!uid) return
    try {
      await navigator.clipboard.writeText(uid)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy your user id', uid)
    }
  }

  return (
    <div className="set-group">
      <div className="screen app-col pb-6">
        <Link to="/" className="chip self-start">Back to my groups</Link>
        <h1 className="h-display">Me</h1>
        {profile && (
          <div className="tile bg-sky flex items-center gap-3">
            <Avatar emoji={profile.emoji} size={56} />
            <span className="h-tile">{profile.name}</span>
          </div>
        )}
        <div className="tile bg-ink flex flex-col gap-2">
          <p className="font-bold">Your user id</p>
          <code className="break-all text-small">{uid ?? 'Loading'}</code>
          <button className="btn" type="button" onClick={copyUid} disabled={!uid}>
            {copied ? 'Copied' : 'Copy user id'}
          </button>
        </div>
        <Link to="/onboard?next=%2Fme" className="btn btn-ghost">Edit my name and emoji</Link>
        <Link to={`/me/wrapped/${previousMonth}`} className="btn">See my last month's Wrapped</Link>
      </div>
    </div>
  )
}
