import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * The single-file build produces one self-contained .html: every asset inlined,
 * no service worker, routes in the hash. It is for looking at the app without
 * a server — a real deploy uses the normal build.
 */
const singleFile = process.env.VITE_SINGLE_FILE === 'true'

// https://vite.dev/config/
export default defineConfig({
  base: singleFile ? './' : '/',
  build: singleFile
    ? {
        // Everything becomes a data URI, so nothing is fetched from disk.
        assetsInlineLimit: Number.MAX_SAFE_INTEGER,
        cssCodeSplit: false,
        rollupOptions: { output: { inlineDynamicImports: true } },
      }
    : {},
  // Baked in as a literal so the admin branch — and the module it imports — is
  // removed from a public build instead of merely being unreachable in it.
  define: {
    __ADMIN_ENABLED__: JSON.stringify(process.env.VITE_ADMIN_ENABLED === 'true'),
    __SINGLE_FILE__: JSON.stringify(singleFile),
  },
  plugins: [
    react(),
    // A service worker cannot register from a file:// page.
    ...(singleFile ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'og-avena.png'],
      manifest: {
        id: 'https://avenaapp.com.br/',
        name: 'Avena — passeios e o seu mapa de viagens',
        short_name: 'Avena',
        description:
          'Um mapa afetivo para colecionar as experiências, pessoas e lugares que você viveu pelo Brasil.',
        lang: 'pt-BR',
        theme_color: '#1b2619',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Android crops the icon into its own shape, so the maskable version
          // keeps the logo well inside the safe area.
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
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
    })]),
  ],
})
