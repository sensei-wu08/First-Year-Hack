import type { TableRow } from '../lib/table'
import Avatar from './Avatar'

/** Points with a real minus sign for negatives. */
export function formatPoints(points: number): string {
  return points < 0 ? `−${-points}` : String(points)
}

/** Rank change since the last results. Up is an ink-on-lime pill, down is red text; both go ink on your lime row. */
function Movement({ n, me }: { n: number; me: boolean }) {
  const tone = me
    ? 'text-ink'
    : n > 0
      ? 'rounded-full bg-lime px-1.5 py-0.5 text-ink'
      : n < 0
        ? 'text-down-text'
        : 'text-muted'
  const label = n > 0 ? `Up ${n}` : n < 0 ? `Down ${-n}` : 'No change'
  const glyph = n > 0 ? `▲${n}` : n < 0 ? `▼${-n}` : '–'
  return (
    <span className={`ml-1.5 text-[11px] font-bold ${tone}`} aria-label={label}>
      {glyph}
    </span>
  )
}

export default function LeagueTable({ rows, highlightId }: { rows: TableRow[]; highlightId?: string | null }) {
  return (
    <table className="league-table">
      <caption className="sr-only">League table</caption>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Name</th>
          <th scope="col">P</th>
          <th scope="col">W–D–L</th>
          <th scope="col">Win %</th>
          <th scope="col">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const me = r.profileId === highlightId
          return (
            <tr key={r.profileId} className={me ? 'league-me' : undefined}>
              <td className="w-[52px] font-extrabold">
                <span className="font-display">{r.rank}</span>
                <Movement n={r.movement} me={me} />
              </td>
              <td className="w-full max-w-0 font-bold">
                <div className="flex items-center gap-2">
                  <Avatar emoji={r.emoji} size={24} />
                  <span className="min-w-0 truncate">{r.name}</span>
                  {r.ootw > 0 && (
                    <span role="img" aria-label="Outfit of the Week winner" title="Outfit of the Week winner">
                      ⭐
                    </span>
                  )}
                </div>
              </td>
              <td>{r.played}</td>
              <td>
                {r.won}–{r.drawn}–{r.lost}
              </td>
              <td>{r.winPct}</td>
              <td className={`font-display text-ui font-extrabold ${r.points < 0 && !me ? 'text-down-text' : ''}`}>
                {formatPoints(r.points)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
