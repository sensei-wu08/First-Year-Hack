import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGroupContext } from '../components/GroupLayout'
import StoryCards, { groupCards } from '../components/StoryCards'
import { loadSeasonInput } from '../data/wrapped'
import { listSeasons } from '../data/reads'
import { groupWrapped, type GroupWrapped as GroupWrappedStats, type WrappedInput } from '../lib/wrapped'

interface Loaded {
  stats: GroupWrappedStats
  input: WrappedInput
  seasonNumber: number | null
}

export default function GroupWrapped() {
  const { seasonId = 'none' } = useParams()
  const { group } = useGroupContext()
  const navigate = useNavigate()
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const back = `/g/${group.id}`

  useEffect(() => {
    let cancelled = false
    setError(null)
    ;(async () => {
      try {
        const [input, seasons] = await Promise.all([loadSeasonInput(group.id, seasonId), listSeasons(group.id)])
        if (cancelled) return
        const season = seasons.find((s) => s.id === seasonId)
        setData({ stats: groupWrapped(input), input, seasonNumber: season?.number ?? null })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [group.id, seasonId, tick])

  const cards = useMemo(
    () =>
      data
        ? groupCards(data.stats, { groupName: group.name, seasonNumber: data.seasonNumber, members: data.input.members })
        : [],
    [data, group.name],
  )

  if (!data) {
    return (
      <div className="screen">
        <Link to={back} className="chip self-start">Back to Today</Link>
        {error ? (
          <>
            <p className="panel">Couldn't load Wrapped. {error}</p>
            <button className="btn" onClick={() => setTick((t) => t + 1)}>
              Try again
            </button>
          </>
        ) : (
          <p className="sub">Wrapping up your season</p>
        )}
      </div>
    )
  }

  return <StoryCards cards={cards} onClose={() => navigate(back)} />
}
