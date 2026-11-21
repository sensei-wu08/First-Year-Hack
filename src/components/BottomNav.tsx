import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '', label: 'Today', cls: 'nav-today', end: true },
  { to: 'table', label: 'League', cls: 'nav-league', end: false },
  { to: 'chat', label: 'Chat', cls: 'nav-chat', end: false },
  { to: 'settings', label: 'Group', cls: 'nav-group', end: false },
]

export default function BottomNav({ groupId }: { groupId: string }) {
  return (
    <nav className="bottom-nav" aria-label="Group">
      <div className="nav-pill">
        {tabs.map((t) => (
          <NavLink
            key={t.label}
            to={t.to ? `/g/${groupId}/${t.to}` : `/g/${groupId}`}
            end={t.end}
            className={({ isActive }) => `${t.cls}${isActive ? ' active' : ''}`}
          >
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
