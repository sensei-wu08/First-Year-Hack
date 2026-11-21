import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './styles/theme.css'

// Reload as soon as a new deploy's service worker is ready, so installed apps don't serve stale code.
registerSW({
  immediate: true,
  onNeedRefresh() {
    location.reload()
  },
})

const root = createRoot(document.getElementById('root')!)

// src/data/supabase.ts throws at import when these are missing, so check first and only load App when configured.
if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
  void import('./App').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    )
  })
} else {
  root.render(
    <div className="screen">
      <p className="panel" role="alert">
        Fits isn't configured: missing Supabase settings. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel and redeploy.
      </p>
    </div>,
  )
}
