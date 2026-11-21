import type { TableRow } from '../lib/table'
import Avatar from './Avatar'

function Movement({ n }: { n: number }) {
  if (n > 0) {
    return (
      <span className="league-move text-up" aria-label={`Up ${n}`}>
        ▲{n}
      </span>
    )
  }
  if (n < 0) {
    return (
      <span className="league-move text-down" aria-label={`Down ${-n}`}>
        ▼{-n}
      </span>
    )
  }
  return (
    <span className="league-move text-muted" aria-label="No change">
      –
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
        {rows.map((r) => (
          <tr key={r.profileId} className={r.profileId === highlightId ? 'league-me' : undefined}>
            <td className="league-rank">
              <span className="font-display">{r.rank}</span>
              <Movement n={r.movement} />
            </td>
            <td className="league-name">
              <Avatar emoji={r.emoji} size={28} />
              <span className="league-name-text">{r.name}</span>
              {r.ootw > 0 && (
                <span role="img" aria-label="Outfit of the Week winner" title="Outfit of the Week winner">
                  ⭐
                </span>
              )}
            </td>
            <td>{r.played}</td>
            <td>
              {r.won}–{r.drawn}–{r.lost}
            </td>
            <td>{r.winPct}</td>
            <td className={r.points < 0 ? 'league-pts text-down' : 'league-pts'}>{r.points < 0 ? `−${-r.points}` : r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
