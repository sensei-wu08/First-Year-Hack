import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { ReportButton } from '../components/ReportButton'
import { useGroupContext } from '../components/GroupLayout'
import { TONE_RULE } from '../brand'
import { useProfile } from '../data/auth'
import { friendlyError } from '../data/groups'
import { friendlySendError, listMessages, sendMessage, type ChatMessage } from '../data/chat'

const POLL_MS = 5000
const NEAR_BOTTOM_PX = 80
const BUBBLE_COLOURS = ['chat-sky', 'chat-tangerine', 'chat-pink', 'chat-mint', 'chat-lavender']

function hashIndex(id: string): number {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % BUBBLE_COLOURS.length
}

function timeLabel(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function Chat() {
  const { group, members } = useGroupContext()
  const { uid } = useProfile()
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const refreshRef = useRef<() => void>(() => {})
  const sendingRef = useRef(false)

  // Poll every 5 s. One request at a time (a tick is skipped while one is pending), and a response
  // older than one already applied is ignored.
  useEffect(() => {
    let alive = true
    let inFlight = false
    let rerun = false
    let issued = 0
    let applied = 0

    const tick = async () => {
      if (inFlight) return
      inFlight = true
      const mine = ++issued
      try {
        const next = await listMessages(group.id)
        if (alive && mine > applied) {
          applied = mine
          setMessages(next)
          setLoadError(null)
        }
      } catch (e) {
        if (alive) setLoadError(friendlyError(e, 'Check your connection and try again.'))
      } finally {
        inFlight = false
        if (alive && rerun) {
          rerun = false
          void tick()
        }
      }
    }

    // After sending, refresh now. If a request is pending it may predate the send, so run again when it ends.
    refreshRef.current = () => {
      if (inFlight) rerun = true
      else void tick()
    }

    stickRef.current = true
    void tick()
    const timer = setInterval(() => {
      if (!document.hidden) void tick()
    }, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [group.id])

  // Follow new messages only when the reader is already at the bottom (or just sent one).
  useLayoutEffect(() => {
    const el = listRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  function onScroll() {
    const el = listRef.current
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  // Each person keeps one bubble colour: their place in the id-sorted member list (so a small group
  // has no repeats), falling back to a hash for anyone no longer listed.
  const colourOf = (id: string): string => {
    const i = [...members].sort((a, b) => (a.id < b.id ? -1 : 1)).findIndex((m) => m.id === id)
    return BUBBLE_COLOURS[i >= 0 ? i % BUBBLE_COLOURS.length : hashIndex(id)]
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setSendError(null)
    try {
      await sendMessage(group.id, body)
      setDraft('')
      stickRef.current = true
      refreshRef.current()
    } catch (err) {
      setSendError(friendlySendError(err))
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  return (
    <div className="screen chat-screen">
      <header className="flex items-center justify-between gap-2.5">
        <h1 className="h-display">Chat</h1>
        <span className="chip">{group.name}</span>
      </header>

      <div className="chat-list" ref={listRef} onScroll={onScroll} role="log" aria-label="Messages">
        {messages === null ? (
          loadError ? (
            <p className="panel">Couldn't load the chat. {loadError}</p>
          ) : (
            <p className="sub">Loading the chat</p>
          )
        ) : messages.length === 0 ? (
          <p className="sub">No messages yet. Say something about today's fits.</p>
        ) : (
          messages.map((m) => {
            const mine = m.author.id === uid
            return (
              <div key={m.id} className={`chat-msg ${mine ? 'chat-mine' : colourOf(m.author.id)}`}>
                <small>
                  {mine ? 'You' : `${m.author.emoji} ${m.author.name}`} · {timeLabel(m.createdAt)}
                </small>
                <span className="chat-body">{m.body}</span>
                {!mine && (
                  <span className="chat-report">
                    <ReportButton messageId={m.id} />
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>

      {sendError && <p className="chat-error">{sendError}</p>}
      <form className="chat-composer" onSubmit={onSubmit}>
        <input
          className="input chat-input"
          aria-label="Message"
          placeholder={TONE_RULE}
          maxLength={500}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="chat-send" disabled={sending || draft.trim() === ''}>
          Send
        </button>
      </form>
    </div>
  )
}
