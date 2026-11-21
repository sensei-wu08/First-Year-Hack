import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const icons: Record<string, ReactNode> = {
  Today: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  League: <path d="M5 20V10M12 20V4M19 20v-7" />,
  Chat: <path d="M4 5h16v11H9l-5 4z" />,
  Group: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.8-4-5.6" />
    </>
  ),
}

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
            <span className="nav-ico">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {icons[t.label]}
              </svg>
            </span>
            <span className="nav-label">{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
