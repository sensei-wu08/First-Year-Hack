import { Outlet } from 'react-router-dom'

/** Root frame for every route. Screens that need a coloured set apply their own `set-*` class. */
export default function AppShell() {
  return (
    <div className="min-h-dvh bg-violet text-white font-body">
      <Outlet />
    </div>
  )
}
