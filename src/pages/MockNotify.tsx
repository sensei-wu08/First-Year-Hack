// Static fake phone lock screen for the demo. Not linked from the nav (route: /demo/notify).
const NOTIFICATIONS = [
  { id: 'match', when: 'now', title: 'Fits', body: "Today's match: you vs Marcus. Post your fit by 12:00" },
  { id: 'vote', when: '12 min ago', title: 'Fits', body: 'Voting is open' },
  { id: 'results', when: '1 h ago', title: 'Fits', body: 'Results are in: you climbed to 2nd ▲' },
]

export default function MockNotify() {
  return (
    <main className="set-today">
      <div className="screen items-center pt-16 pb-10 text-center">
        <p className="sub text-ui font-bold">Saturday 21 November</p>
        <h1 className="font-display text-score font-extrabold leading-none tabular-nums">9:00</h1>
        <ul className="mt-10 flex w-full list-none flex-col gap-2.5 p-0 text-left">
          {NOTIFICATIONS.map((n) => (
            <li key={n.id} className="tile flex items-start gap-3">
              <img src="/icons/icon-192.png" alt="" width={40} height={40} className="size-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-small font-extrabold">{n.title}</span>
                  <span className="sub text-caption">{n.when}</span>
                </div>
                <p className="text-body font-semibold">{n.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="sub mt-auto pt-8 text-small">Demo screen: how Fits would nudge you on your phone</p>
      </div>
    </main>
  )
}
