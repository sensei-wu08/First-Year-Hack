import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import StoryCards, { personalCards } from '../components/StoryCards'
import { useProfile } from '../data/auth'
import { loadMonthInputs } from '../data/wrapped'
import { personalWrapped, type PersonalWrapped as PersonalStats } from '../lib/wrapped'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

export default function PersonalWrapped() {
  const { month = '' } = useParams()
  const { uid, profile } = useProfile()
  const navigate = useNavigate()
  const [stats, setStats] = useState<PersonalStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const valid = MONTH.test(month)

  useEffect(() => {
    if (!uid || !valid) return
    let cancelled = false
    setError(null)
    ;(async () => {
      try {
        const groups = await loadMonthInputs(month)
        if (!cancelled) setStats(personalWrapped(uid, month, groups))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [uid, month, valid, tick])

  const cards = useMemo(
    () => (stats && profile ? personalCards(stats, { name: profile.name, emoji: profile.emoji }) : []),
    [stats, profile],
  )

  if (!stats || !profile) {
    return (
      <div className="set-wrapped">
        <div className="screen app-col">
          <Link to="/me" className="chip self-start">Back to me</Link>
          {!valid ? (
            <p className="panel">That month doesn't look right. Open Wrapped from the Me screen.</p>
          ) : error ? (
            <>
              <p className="panel">Couldn't load your Wrapped. {error}</p>
              <button className="btn" onClick={() => setTick((t) => t + 1)}>
                Try again
              </button>
            </>
          ) : (
            <p className="sub">Wrapping up your month</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="set-wrapped">
      <StoryCards cards={cards} onClose={() => navigate('/me')} />
    </div>
  )
}
