import type { Phase } from '../lib/types'

export const phaseLabels: Record<Phase, string> = {
  upcoming: 'Upcoming',
  posting: 'Posting',
  voting: 'Voting open',
  awaiting_results: 'Waiting for results',
  results: 'Results',
  void: 'Void',
}

export default function PhaseBadge({ phase }: { phase: Phase }) {
  return (
    <span className="pill">
      <span className="pill-dot" aria-hidden="true" />
      {phaseLabels[phase]}
    </span>
  )
}
