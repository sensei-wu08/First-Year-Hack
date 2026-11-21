import { useCallback, useEffect, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'
import { APP_NAME, TONE_RULE } from '../brand'
import { cleanText } from '../lib/filter'
import type { CommentView, Member } from '../lib/types'
import { shareCardImage, type ShareBlock, type ShareCardData, type ShareTone } from '../lib/shareCard'
import type { GroupWrapped, OutfitRef, PersonalWrapped } from '../lib/wrapped'
import Avatar from './Avatar'
import { formatPoints } from './LeagueTable'

export interface StoryCard {
  key: string
  body: ReactNode
  /** What the Share button draws. Cards without it have no Share button. */
  share?: ShareCardData
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

  const [sharing, setSharing] = useState(false)
  const [shareFailed, setShareFailed] = useState(false)
  useEffect(() => setShareFailed(false), [index])

  const [hidden, setHidden] = useState(() => document.hidden)
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (reduced || hidden || sharing || index >= last) return
    const t = setTimeout(() => setIndex((n) => Math.min(last, n + 1)), ADVANCE_MS)
    return () => clearTimeout(t)
  }, [index, last, reduced, hidden, sharing])

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
  const tone = TONES[index % TONES.length].slice(3) as ShareTone

  async function onShare(e: MouseEvent) {
    e.stopPropagation()
    if (sharing || !card.share) return
    setSharing(true)
    setShareFailed(false)
    try {
      await shareCardImage(card.share, tone)
    } catch {
      setShareFailed(true)
    } finally {
      setSharing(false)
    }
  }

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
        {card.share && (
          <div className="wr-share-row">
            <button
              type="button"
              className="btn btn-dark wr-share"
              onClick={onShare}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={sharing}
            >
              {sharing ? 'Sharing…' : 'Share'}
            </button>
            {shareFailed && (
              <p className="wr-share-err" role="status">
                Couldn't share this card
              </p>
            )}
          </div>
        )}
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

function photoBlock(outfit: OutfitRef, label: string): ShareBlock {
  return { kind: 'photo', url: outfit.mediaPath, label, badge: `${Math.round(outfit.share * 100)}%` }
}

function quoteBlocks(comment: CommentView, about?: string): ShareBlock[] {
  const who = `${comment.authorEmoji ? `${comment.authorEmoji} ` : ''}${comment.authorName}${about ? ` on ${about}'s fit` : ''}`
  return [
    { kind: 'quote', text: cleanText(comment.body).text },
    { kind: 'line', text: who },
  ]
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long' })
}

function outroCard(): StoryCard {
  return {
    key: 'outro',
    share: { chip: "That's a wrap", blocks: [{ kind: 'title', text: TONE_RULE }, { kind: 'line', text: 'See you next time.' }] },
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

  const introHero = ctx.seasonNumber === null ? '🏆' : `S${ctx.seasonNumber}`
  const cards: StoryCard[] = [
    {
      key: 'intro',
      share: {
        chip: ctx.groupName,
        blocks: [
          { kind: 'hero', text: introHero },
          { kind: 'line', text: `${title}. Here's how it all went down.` },
        ],
      },
      body: (
        <>
          <Chip>{ctx.groupName}</Chip>
          <Hero>{introHero}</Hero>
          <Line>{title}. Here's how it all went down.</Line>
        </>
      ),
    },
  ]

  if (!w.champion) {
    cards.push({
      key: 'empty',
      share: {
        chip: 'Nothing yet',
        blocks: [
          { kind: 'title', text: 'No battles have finished yet.' },
          { kind: 'line', text: 'Come back once the first results are in.' },
        ],
      },
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
      share: {
        chip: 'The numbers',
        blocks: [
          { kind: 'hero', text: String(w.totalVotes) },
          { kind: 'line', text: `${w.totalVotes === 1 ? 'vote' : 'votes'} across ${plural(w.battlesPlayed, 'battle')}.` },
        ],
      },
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
      share: {
        chip: 'Champion',
        blocks: [
          { kind: 'title', text: `${c.emoji} ${c.name}` },
          { kind: 'hero', text: formatPoints(c.points) },
          { kind: 'line', text: `points, from ${plural(c.won, 'win')} in ${plural(c.played, 'battle')}.` },
        ],
      },
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
      share: {
        chip: 'Final table',
        blocks: [
          {
            kind: 'rows',
            rows: w.finalTable
              .slice(0, 5)
              .map((r) => ({ rank: String(r.rank), name: `${r.emoji} ${r.name}`, end: formatPoints(r.points) })),
          },
        ],
      },
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
      share: {
        chip: 'Closest battle',
        blocks: [
          { kind: 'hero', text: `${r.votesA}–${r.votesB}` },
          { kind: 'line', text: `${nameOf(r.a)} vs ${nameOf(r.b)} went down to the wire.` },
        ],
      },
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
      share: {
        chip: 'Ghost award',
        blocks: [
          { kind: 'hero', text: String(g.forfeits) },
          {
            kind: 'line',
            text: `${nameOf(g.profileId)} missed the posting deadline ${g.forfeits === 1 ? 'once' : `${g.forfeits} times`}. The Ghost award is yours.`,
          },
        ],
      },
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
      share: {
        chip: 'Most-voted fit',
        blocks: [photoBlock(o, nameOf(o.profileId)), { kind: 'line', text: `${plural(o.votes, 'vote')}. Nobody got more.` }],
      },
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
      share: {
        chip: 'Comment of the season',
        blocks: quoteBlocks(w.commentOfSeason, nameOf(w.topOutfit.profileId)),
      },
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
      share: {
        chip: `${APP_NAME} Wrapped`,
        blocks: [
          { kind: 'hero', text: ctx.emoji },
          { kind: 'title', text: `Your ${month}` },
          { kind: 'line', text: 'A month of fits, wrapped.' },
        ],
      },
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
      share: {
        chip: 'Nothing yet',
        blocks: [
          { kind: 'title', text: `No battles finished in ${month}.` },
          { kind: 'line', text: 'Your Wrapped fills up after your next results.' },
        ],
      },
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
  const recordHero = r.d > 0 ? `${r.w}–${r.d}–${r.l + r.f}` : `${r.w}–${r.l + r.f}`
  cards.push(
    {
      key: 'record',
      share: {
        chip: 'Your record',
        blocks: [
          { kind: 'hero', text: recordHero },
          {
            kind: 'line',
            text: `${ctx.name}, you won ${r.w} of your ${plural(total, 'battle')} and earned ${formatPoints(r.points)} ${Math.abs(r.points) === 1 ? 'point' : 'points'}.`,
          },
        ],
      },
      body: (
        <>
          <Chip>Your record</Chip>
          <Hero>{recordHero}</Hero>
          <Line>
            {ctx.name}, you won {r.w} of your {plural(total, 'battle')} and earned {formatPoints(r.points)}{' '}
            {Math.abs(r.points) === 1 ? 'point' : 'points'}.
          </Line>
        </>
      ),
    },
    {
      key: 'ranks',
      share: {
        chip: 'Where you finished',
        blocks: [
          {
            kind: 'rows',
            rows: p.perGroup.map((g) => ({
              rank: `#${g.rank}`,
              name: g.groupName,
              sub: `${g.w}–${g.d}–${g.l + g.f} · ${formatPoints(g.points)} pts`,
              end: `of ${g.of}`,
            })),
          },
        ],
      },
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
      share: {
        chip: 'Your best fit',
        blocks: [
          photoBlock(p.bestOutfit, 'Your best fit'),
          { kind: 'line', text: `${plural(p.bestOutfit.votes, 'vote')} on this one, ${plural(p.votesReceived, 'vote')} in all.` },
        ],
      },
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
      share: { chip: 'A comment about your fit', blocks: quoteBlocks(p.bestComment) },
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
