import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { APP_NAME, TONE_RULE } from '../brand'
import { cleanText } from '../lib/filter'
import type { CommentView, Member } from '../lib/types'
import type { GroupWrapped, OutfitRef, PersonalWrapped } from '../lib/wrapped'
import Avatar from './Avatar'
import { formatPoints } from './LeagueTable'

export interface StoryCard {
  key: string
  body: ReactNode
}

const TONES = ['wr-pink', 'wr-lime', 'wr-sky', 'wr-tangerine']
const ADVANCE_MS = 6000
const REDUCED = '(prefers-reduced-motion: reduce)'

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(REDUCED)
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  )
}

/**
 * Full-screen 9:16 story deck. Tap the right two thirds for next, the left third for back.
 * Advances by itself after 6 seconds, unless the visitor prefers reduced motion.
 */
export default function StoryCards({ cards, onClose }: { cards: StoryCard[]; onClose(): void }) {
  const [index, setIndex] = useState(0)
  const reduced = usePrefersReducedMotion()
  const last = cards.length - 1

  const go = useCallback(
    (dir: 1 | -1) => {
      if (dir === 1 && index >= last) {
        onClose()
        return
      }
      setIndex((n) => Math.max(0, Math.min(last, n + dir)))
    },
    [index, last, onClose],
  )

  const [hidden, setHidden] = useState(() => document.hidden)
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (reduced || hidden || index >= last) return
    const t = setTimeout(() => setIndex((n) => Math.min(last, n + 1)), ADVANCE_MS)
    return () => clearTimeout(t)
  }, [index, last, reduced, hidden])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  if (cards.length === 0) return null
  const card = cards[Math.min(index, last)]
  const atEnd = index >= last

  return (
    <div className="wr-stage">
      <div className={`wr-frame ${TONES[index % TONES.length]}`}>
        <div className="wr-progress" aria-hidden="true">
          {cards.map((c, n) => (
            <span key={c.key} className={`wr-seg ${n < index || (n === index && (atEnd || reduced)) ? 'done' : n === index ? 'on' : ''}`}>
              <i />
            </span>
          ))}
        </div>
        <button type="button" className="wr-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div key={card.key} className={`wr-card${atEnd ? ' wr-last' : ''}`}>
          {card.body}
        </div>
        <button type="button" className="wr-zone wr-zone-prev" onClick={() => go(-1)} aria-label="Previous card" />
        <button
          type="button"
          className="wr-zone wr-zone-next"
          onClick={() => go(1)}
          aria-label={atEnd ? 'Close' : 'Next card'}
        />
        {atEnd && (
          <button type="button" className="btn btn-dark wr-done" onClick={onClose}>
            Done
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- Card pieces ----------

function Chip({ children }: { children: ReactNode }) {
  return <span className="chip bg-ink">{children}</span>
}

/** Big number. Long values drop to the 84px step so they fit the frame. */
function Hero({ children }: { children: string | number }) {
  const text = String(children)
  return <div className={`wr-hero${text.length > 3 ? ' wr-hero-sm' : ''}`}>{text}</div>
}

function Line({ children }: { children: ReactNode }) {
  return <p className="wr-line">{children}</p>
}

function Sparkle({ className }: { className: string }) {
  return <span className={`sticker-sparkle absolute ${className}`} aria-hidden="true" />
}

function Quote({ comment, about }: { comment: CommentView; about?: string }) {
  const body = cleanText(comment.body).text
  return (
    <>
      <p className={`wr-quote${body.length > 120 ? ' wr-quote-long' : ''}`}>“{body}”</p>
      <Line>
        {comment.authorEmoji ? `${comment.authorEmoji} ` : ''}
        {comment.authorName}
        {about ? ` on ${about}'s fit` : ''}
      </Line>
    </>
  )
}

function OutfitPhoto({ outfit, name, label }: { outfit: OutfitRef; name: string; label: string }) {
  return (
    <div className="wr-photo">
      <img src={outfit.mediaPath} alt={`${name}'s fit`} />
      <span className="pill absolute left-3.5 top-3.5 -rotate-6">{Math.round(outfit.share * 100)}%</span>
      <Sparkle className="right-3.5 top-3.5" />
      <span className="fixture-name absolute bottom-3.5 left-3.5">{label}</span>
    </div>
  )
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long' })
}

function outroCard(): StoryCard {
  return {
    key: 'outro',
    body: (
      <>
        <Chip>That's a wrap</Chip>
        <p className="wr-title mt-2">{TONE_RULE}</p>
        <Line>See you next time.</Line>
      </>
    ),
  }
}

// ---------- Decks ----------

export function groupCards(
  w: GroupWrapped,
  ctx: { groupName: string; seasonNumber: number | null; members: Member[] },
): StoryCard[] {
  const names = new Map(ctx.members.map((m) => [m.id, m.name]))
  const nameOf = (id: string) => names.get(id) ?? 'Someone'
  const title = ctx.seasonNumber === null ? 'Wrapped' : `Season ${ctx.seasonNumber} Wrapped`

  const cards: StoryCard[] = [
    {
      key: 'intro',
      body: (
        <>
          <Chip>{ctx.groupName}</Chip>
          <Hero>{ctx.seasonNumber === null ? '🏆' : `S${ctx.seasonNumber}`}</Hero>
          <Line>{title}. Here's how it all went down.</Line>
        </>
      ),
    },
  ]

  if (!w.champion) {
    cards.push({
      key: 'empty',
      body: (
        <>
          <Chip>Nothing yet</Chip>
          <p className="wr-title mt-2">No battles have finished yet.</p>
          <Line>Come back once the first results are in.</Line>
        </>
      ),
    })
    cards.push(outroCard())
    return cards
  }

  const c = w.champion
  cards.push(
    {
      key: 'votes',
      body: (
        <>
          <Chip>The numbers</Chip>
          <Hero>{w.totalVotes}</Hero>
          <Line>
            {w.totalVotes === 1 ? 'vote' : 'votes'} across {plural(w.battlesPlayed, 'battle')}.
          </Line>
        </>
      ),
    },
    {
      key: 'champion',
      body: (
        <>
          <Chip>Champion</Chip>
          <Avatar emoji={c.emoji} size={72} />
          <p className="wr-title">{c.name}</p>
          <Hero>{formatPoints(c.points)}</Hero>
          <Line>
            points, from {plural(c.won, 'win')} in {plural(c.played, 'battle')}.
          </Line>
          <Sparkle className="right-5 top-24" />
        </>
      ),
    },
    {
      key: 'table',
      body: (
        <>
          <Chip>Final table</Chip>
          <ol className="wr-list mt-2">
            {w.finalTable.slice(0, 5).map((r) => (
              <li key={r.profileId} className="wr-row">
                <span className="wr-row-rank">{r.rank}</span>
                <Avatar emoji={r.emoji} size={36} />
                <span className="wr-row-name">{r.name}</span>
                <span className="wr-row-end">{formatPoints(r.points)}</span>
              </li>
            ))}
          </ol>
        </>
      ),
    },
  )

  if (w.rivalry) {
    const r = w.rivalry
    cards.push({
      key: 'rivalry',
      body: (
        <>
          <Chip>Closest battle</Chip>
          <Hero>{`${r.votesA}–${r.votesB}`}</Hero>
          <Line>
            {nameOf(r.a)} vs {nameOf(r.b)} went down to the wire.
          </Line>
        </>
      ),
    })
  }

  if (w.ghost) {
    const g = w.ghost
    cards.push({
      key: 'ghost',
      body: (
        <>
          <Chip>Ghost award</Chip>
          <Hero>{g.forfeits}</Hero>
          <Line>
            {nameOf(g.profileId)} missed the posting deadline {g.forfeits === 1 ? 'once' : `${g.forfeits} times`}. The Ghost
            award is yours.
          </Line>
        </>
      ),
    })
  }

  if (w.topOutfit) {
    const o = w.topOutfit
    cards.push({
      key: 'outfit',
      body: (
        <>
          <Chip>Most-voted fit</Chip>
          <OutfitPhoto outfit={o} name={nameOf(o.profileId)} label={nameOf(o.profileId)} />
          <Line>{plural(o.votes, 'vote')}. Nobody got more.</Line>
        </>
      ),
    })
  }

  if (w.commentOfSeason && w.topOutfit) {
    cards.push({
      key: 'comment',
      body: (
        <>
          <Chip>Comment of the season</Chip>
          <Quote comment={w.commentOfSeason} about={nameOf(w.topOutfit.profileId)} />
        </>
      ),
    })
  }

  cards.push(outroCard())
  return cards
}

export function personalCards(p: PersonalWrapped, ctx: { name: string; emoji: string }): StoryCard[] {
  const month = monthName(p.month)
  const total = p.record.w + p.record.d + p.record.l + p.record.f

  const cards: StoryCard[] = [
    {
      key: 'intro',
      body: (
        <>
          <Chip>{APP_NAME} Wrapped</Chip>
          <Hero>{ctx.emoji}</Hero>
          <p className="wr-title">Your {month}</p>
          <Line>A month of fits, wrapped.</Line>
        </>
      ),
    },
  ]

  if (p.perGroup.length === 0) {
    cards.push({
      key: 'empty',
      body: (
        <>
          <Chip>Nothing yet</Chip>
          <p className="wr-title mt-2">No battles finished in {month}.</p>
          <Line>Your Wrapped fills up after your next results.</Line>
        </>
      ),
    })
    cards.push(outroCard())
    return cards
  }

  const r = p.record
  cards.push(
    {
      key: 'record',
      body: (
        <>
          <Chip>Your record</Chip>
          <Hero>{r.d > 0 ? `${r.w}–${r.d}–${r.l + r.f}` : `${r.w}–${r.l + r.f}`}</Hero>
          <Line>
            {ctx.name}, you won {r.w} of your {plural(total, 'battle')} and earned {formatPoints(r.points)}{' '}
            {Math.abs(r.points) === 1 ? 'point' : 'points'}.
          </Line>
        </>
      ),
    },
    {
      key: 'ranks',
      body: (
        <>
          <Chip>Where you finished</Chip>
          <ul className="wr-list mt-2">
            {p.perGroup.map((g) => (
              <li key={g.groupId} className="wr-row">
                <span className="wr-row-rank">#{g.rank}</span>
                <span className="wr-row-name">
                  {g.groupName}
                  <small className="block font-semibold">
                    {g.w}–{g.d}–{g.l + g.f} · {formatPoints(g.points)} pts
                  </small>
                </span>
                <span className="wr-row-end">of {g.of}</span>
              </li>
            ))}
          </ul>
        </>
      ),
    },
  )

  if (p.bestOutfit) {
    cards.push({
      key: 'outfit',
      body: (
        <>
          <Chip>Your best fit</Chip>
          <OutfitPhoto outfit={p.bestOutfit} name={ctx.name} label="Your best fit" />
          <Line>
            {plural(p.bestOutfit.votes, 'vote')} on this one, {plural(p.votesReceived, 'vote')} in all.
          </Line>
        </>
      ),
    })
  }

  if (p.bestComment) {
    cards.push({
      key: 'comment',
      body: (
        <>
          <Chip>A comment about your fit</Chip>
          <Quote comment={p.bestComment} />
        </>
      ),
    })
  }

  cards.push(outroCard())
  return cards
}
