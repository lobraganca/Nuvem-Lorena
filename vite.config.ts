import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png'],
      manifest: {
        name: 'Avena',
        short_name: 'Avena',
        description:
          'Um mapa afetivo para colecionar as experiências, pessoas e lugares que você viveu pelo Brasil.',
        lang: 'pt-BR',
        theme_color: '#1b2619',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.png', sizes: '256x256', type: 'image/png' },
          { src: '/favicon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Map tiles are the one thing that genuinely needs the network, so we
        // cache what was already seen and fall back to it when offline —
        // trails and remote beaches are exactly where signal disappears.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
