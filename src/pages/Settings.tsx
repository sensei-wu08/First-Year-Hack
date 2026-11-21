import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { useGroupContext } from '../components/GroupLayout'
import { InviteQr } from '../components/InviteQr'
import { useProfile } from '../data/auth'
import { friendlyError } from '../data/groups'
import { currentSeason } from '../data/reads'
import { leaveGroup, redateUpcoming, startSeason, updateGroupSettings } from '../data/seasons'
import { defaultBattlesPerDay } from '../lib/scheduler'
import { addDays, atLocalTime, localDateKey, monthKey } from '../lib/time'
import type { Group, Season } from '../lib/types'

interface Form {
  reveal: string
  postDeadline: string
  results: string
  perDay: string
  allowShare: boolean
  comments: boolean
}

type Note = { kind: 'ok' | 'error'; text: string }

const fromGroup = (g: Group): Form => ({
  reveal: g.revealTime,
  postDeadline: g.postDeadlineTime,
  results: g.resultsTime,
  perDay: g.battlesPerDay === null ? '' : String(g.battlesPerDay),
  allowShare: g.allowShareVoting,
  comments: g.commentsEnabled,
})

function explain(e: unknown, fallback: string): string {
  const m = (e instanceof Error ? e.message : '').toLowerCase()
  if (m.includes('season_active')) return 'A season is already running. You can start the next one when it ends.'
  if (m.includes('need_members')) return 'You need at least 2 active members to start a season.'
  if (m.includes('season_end_not_moved'))
    return "The battles moved, but the season end date didn't. Ask whoever runs the database to apply the latest migration, then save again."
  if (m.includes('bad_players')) return 'Someone in the schedule has left the group. Reload and try again.'
  return friendlyError(e, fallback)
}

function Toggle({
  on,
  label,
  disabled,
  onChange,
}: {
  on: boolean
  label: string
  disabled: boolean
  onChange(v: boolean): void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="toggle"
      disabled={disabled}
      onClick={() => onChange(!on)}
    />
  )
}

export default function Settings() {
  const { group, members, reload } = useGroupContext()
  const { uid } = useProfile()
  const navigate = useNavigate()
  const isAdmin = uid !== null && uid === group.adminId
  const active = members.filter((m) => !m.leftAt)
  const left = members.filter((m) => m.leftAt)
  const autoPerDay = defaultBattlesPerDay(active.length)

  const [form, setForm] = useState<Form>(() => fromGroup(group))
  const [season, setSeason] = useState<Season | null>(null)
  const [seasonLoaded, setSeasonLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [needsRedate, setNeedsRedate] = useState(false)
  const [msg, setMsg] = useState<Note | null>(null)
  const [startDate, setStartDate] = useState(() => addDays(localDateKey(new Date()), 1))
  const [starting, setStarting] = useState(false)
  const [seasonMsg, setSeasonMsg] = useState<Note | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  useEffect(() => setForm(fromGroup(group)), [group])

  const loadSeason = useCallback(async () => {
    try {
      setSeason(await currentSeason(group.id))
    } catch (e) {
      setSeasonMsg({ kind: 'error', text: explain(e, 'Could not load the season. Check your connection and try again.') })
    } finally {
      setSeasonLoaded(true)
    }
  }, [group.id])
  useEffect(() => {
    loadSeason()
  }, [loadSeason])

  const today = localDateKey(new Date())
  const firstStart = atLocalTime(today, group.revealTime) > new Date() ? today : addDays(today, 1)
  const seasonActive = season !== null && season.endsOn >= today
  const saved = fromGroup(group)
  const dirty = (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== saved[k])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setMsg(null)
  }

  async function save() {
    const perDayNum = form.perDay.trim() === '' ? null : Number(form.perDay)
    if (perDayNum !== null && (!Number.isInteger(perDayNum) || perDayNum < 1 || perDayNum > 10)) {
      setMsg({ kind: 'error', text: 'Battles per day: leave it blank for auto, or pick a whole number from 1 to 10.' })
      return
    }
    if (!form.reveal || !form.postDeadline || !form.results) {
      setMsg({ kind: 'error', text: 'Set all three times.' })
      return
    }
    if (!(form.reveal < form.postDeadline && form.postDeadline < form.results)) {
      setMsg({ kind: 'error', text: 'Order the day: matches out, then post by, then results.' })
      return
    }
    setSaving(true)
    setMsg(null)
    const scheduleChanged =
      form.reveal !== saved.reveal ||
      form.postDeadline !== saved.postDeadline ||
      form.results !== saved.results ||
      form.perDay !== saved.perDay
    try {
      await updateGroupSettings(group.id, {
        revealTime: form.reveal,
        postDeadlineTime: form.postDeadline,
        resultsTime: form.results,
        battlesPerDay: perDayNum,
        allowShareVoting: form.allowShare,
        commentsEnabled: form.comments,
      })
    } catch (e) {
      setSaving(false)
      setMsg({ kind: 'error', text: explain(e, 'Could not save settings. Check your connection and try again.') })
      return
    }
    let text = 'Settings saved.'
    let kind: Note['kind'] = 'ok'
    if ((scheduleChanged || needsRedate) && seasonActive && season) {
      try {
        const n = await redateUpcoming(
          group.id,
          season,
          { reveal: form.reveal, postDeadline: form.postDeadline, results: form.results },
          perDayNum ?? autoPerDay,
        )
        setNeedsRedate(false)
        if (n > 0) text = `Settings saved. ${n} upcoming ${n === 1 ? 'battle was' : 'battles were'} re-dated.`
        loadSeason()
      } catch (e) {
        setNeedsRedate(true)
        kind = 'error'
        text = `Settings saved, but the upcoming battles did not move. ${explain(e, 'Press Save settings to try again.')}`
      }
    }
    setSaving(false)
    setMsg({ kind, text })
    reload()
  }

  async function start() {
    setStarting(true)
    setSeasonMsg(null)
    if (startDate < firstStart) {
      setSeasonMsg({ kind: 'error', text: `Pick ${firstStart} or later. Today's matches have already gone out.` })
      setStarting(false)
      return
    }
    try {
      await startSeason(
        group,
        active.map((m) => m.id),
        startDate,
      )
      await loadSeason()
      setSeasonMsg({ kind: 'ok', text: 'Season started. Today shows the first battles.' })
      reload()
    } catch (e) {
      setSeasonMsg({ kind: 'error', text: explain(e, 'Could not start the season. Check your connection and try again.') })
      if (e instanceof Error && e.message.toLowerCase().includes('season_active')) {
        loadSeason()
        reload()
      }
    } finally {
      setStarting(false)
    }
  }

  async function leave() {
    setLeaving(true)
    setLeaveError(null)
    try {
      await leaveGroup(group.id)
      navigate('/', { replace: true })
    } catch (e) {
      setLeaveError(explain(e, 'Could not leave the group. Check your connection and try again.'))
      setLeaving(false)
    }
  }

  const ro = !isAdmin
  const nowDate = new Date()
  const lastMonth = monthKey(new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1))
  const perDayLabel = group.battlesPerDay === null ? `Auto (${autoPerDay})` : String(group.battlesPerDay)

  return (
    <div className="screen pb-2">
      <header className="flex items-center justify-between gap-3">
        <h1 className="h-display">Group settings</h1>
        <span className="chip">{isAdmin ? 'You are the admin' : 'View only'}</span>
      </header>

      <div className="tile" style={{ paddingBlock: 8 }}>
        <div className="setting-row">
          <b>Matches out</b>
          <span className="chip bg-mint">
            {ro ? (
              group.revealTime
            ) : (
              <input
                type="time"
                className="chip-input"
                aria-label="Matches out time"
                value={form.reveal}
                onChange={(e) => set('reveal', e.target.value)}
              />
            )}
          </span>
        </div>
        <div className="setting-row">
          <b>Post by</b>
          <span className="chip bg-pink">
            {ro ? (
              group.postDeadlineTime
            ) : (
              <input
                type="time"
                className="chip-input"
                aria-label="Post by time"
                value={form.postDeadline}
                onChange={(e) => set('postDeadline', e.target.value)}
              />
            )}
          </span>
        </div>
        <div className="setting-row">
          <b>Results</b>
          <span className="chip bg-sky">
            {ro ? (
              group.resultsTime
            ) : (
              <input
                type="time"
                className="chip-input"
                aria-label="Results time"
                value={form.results}
                onChange={(e) => set('results', e.target.value)}
              />
            )}
          </span>
        </div>
        <div className="setting-row">
          <b>Battles per day</b>
          <span className="chip bg-lavender">
            {ro ? (
              perDayLabel
            ) : (
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                className="chip-input"
                aria-label="Battles per day"
                placeholder={`Auto (${autoPerDay})`}
                value={form.perDay}
                onChange={(e) => set('perDay', e.target.value)}
              />
            )}
          </span>
        </div>
      </div>

      <div className="tile bg-tangerine" style={{ paddingBlock: 8 }}>
        <div className="setting-row">
          <b>Allow voting via share link</b>
          <Toggle on={form.allowShare} label="Allow voting via share link" disabled={ro} onChange={(v) => set('allowShare', v)} />
        </div>
        <div className="setting-row">
          <b>Comments</b>
          <Toggle on={form.comments} label="Comments" disabled={ro} onChange={(v) => set('comments', v)} />
        </div>
      </div>

      <p className="sub px-2 text-small">
        Scheduling: round-robin (14 or fewer) / random pairings (over 14). You have {active.length} active{' '}
        {active.length === 1 ? 'member' : 'members'}.
      </p>

      {isAdmin && (
        <>
          {msg && (
            <p className="tile tile-sm" role={msg.kind === 'error' ? 'alert' : 'status'}>
              {msg.text}
            </p>
          )}
          <button type="button" className="btn" onClick={save} disabled={saving || (!dirty && !needsRedate)}>
            {saving ? 'Saving' : 'Save settings'}
          </button>
        </>
      )}

      <section className="tile bg-lime flex flex-col gap-3" aria-label="Season">
        <h2 className="h-tile">Season</h2>
        {!seasonLoaded ? (
          <p>Loading the season</p>
        ) : season === null ? (
          <p>No season yet.{isAdmin ? ' Start one below.' : ''}</p>
        ) : seasonActive ? (
          <p>
            Season {season.number} is running until {season.endsOn}.
          </p>
        ) : (
          <p>
            Season {season.number} ended on {season.endsOn}.
          </p>
        )}
        {isAdmin && (
          <>
            <label className="flex flex-col gap-1.5 font-semibold">
              Start date
              <input
                type="date"
                className="input"
                value={startDate}
                min={firstStart}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={seasonActive}
              />
            </label>
            {dirty && !seasonActive && <p className="text-small">Save your settings first. A new season uses the saved times.</p>}
            {active.length < 2 && !seasonActive && <p className="text-small">You need at least 2 active members.</p>}
            <button
              type="button"
              className="btn btn-dark"
              onClick={start}
              disabled={seasonActive || starting || !startDate || active.length < 2 || dirty || !seasonLoaded}
            >
              {starting ? 'Starting' : 'Start season'}
            </button>
          </>
        )}
        {seasonMsg && <p role={seasonMsg.kind === 'error' ? 'alert' : 'status'}>{seasonMsg.text}</p>}
      </section>

      <section className="tile bg-lavender flex flex-col gap-2" aria-label="Wrapped">
        <h2 className="h-tile">Wrapped</h2>
        {season && (
          <Link to={`/g/${group.id}/wrapped/${season.id}`} className="btn btn-dark">
            See season {season.number} Wrapped
          </Link>
        )}
        <Link to={`/me/wrapped/${lastMonth}`} className="btn btn-ghost">
          My Wrapped
        </Link>
      </section>

      <section className="tile flex flex-col gap-1" aria-label="Members">
        <h2 className="h-tile mb-1">Members</h2>
        {active.map((m) => (
          <div key={m.id} className="setting-row" style={{ paddingBlock: 8 }}>
            <span className="flex items-center gap-2.5">
              <Avatar emoji={m.emoji} size={36} />
              <b>{m.name}</b>
            </span>
            <span className="flex gap-1.5">
              {m.id === group.adminId && <span className="chip bg-lime">Admin</span>}
              {m.id === uid && <span className="chip bg-lavender">You</span>}
            </span>
          </div>
        ))}
        {left.map((m) => (
          <div key={m.id} className="setting-row opacity-60" style={{ paddingBlock: 8 }}>
            <span className="flex items-center gap-2.5">
              <Avatar emoji={m.emoji} size={36} />
              <b>{m.name}</b>
            </span>
            <span className="chip">Left</span>
          </div>
        ))}
      </section>

      <InviteQr url={`${window.location.origin}/j/${group.inviteCode}`} label={`Invite friends to ${group.name}`} />

      {uid !== null && !isAdmin && (
        <section className="flex flex-col gap-2" aria-label="Leave group">
          {!confirmLeave ? (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmLeave(true)}>
              Leave group
            </button>
          ) : (
            <div className="tile bg-pink flex flex-col gap-2">
              <p className="font-bold">Leave {group.name}?</p>
              <p className="text-small">
                Your upcoming battles are voided. Your points stay in the league. You can rejoin with the invite link.
              </p>
              <button type="button" className="btn btn-dark" onClick={leave} disabled={leaving}>
                {leaving ? 'Leaving' : 'Yes, leave group'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmLeave(false)} disabled={leaving}>
                Stay in the group
              </button>
            </div>
          )}
          {leaveError && (
            <p className="tile tile-sm" role="alert">
              {leaveError}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
