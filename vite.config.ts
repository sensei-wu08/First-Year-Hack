import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Fits',
        short_name: 'Fits',
        description: '1v1 your friends in a fashion battle. Every day. All season.',
        display: 'standalone',
        start_url: '/',
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Precache the app shell only. Never cache Supabase calls.
      workbox: { navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/api/], runtimeCaching: [] },
    }),
  ],
  test: { environment: 'node', env: { TZ: 'Europe/London' } },
})
