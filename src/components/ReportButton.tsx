import { useState } from 'react'
import { report } from '../data/votes'

/** Flags a battle or chat message for tone. Calls report(..., 'tone'), then shows "Reported". */
export function ReportButton({ battleId, messageId }: { battleId?: string; messageId?: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  if (state === 'done') {
    return <span className="report-btn report-btn-done">Reported</span>
  }

  async function send() {
    setState('sending')
    try {
      await report({ battleId, messageId }, 'tone')
      setState('done')
    } catch {
      setState('error')
    }
  }

  return (
    <button type="button" className="report-btn" disabled={state === 'sending'} onClick={send}>
      {state === 'error' ? "Couldn't report, try again" : 'Report'}
    </button>
  )
}
