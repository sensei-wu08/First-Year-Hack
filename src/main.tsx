import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles/theme.css'

// Reload as soon as a new deploy's service worker is ready, so installed apps don't serve stale code.
registerSW({
  immediate: true,
  onNeedRefresh() {
    location.reload()
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
