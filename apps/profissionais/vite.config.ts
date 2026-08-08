import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // usamos public/manifest.json manualmente (linkado no index.html)
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'],
      workbox: {
        // Cache só do "shell" estático do app (HTML/CSS/JS/imagens do build).
        // Dados dinâmicos do Supabase (busca, avaliações, login) NUNCA passam
        // pelo service worker — sempre vão direto pra rede.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallbackDenylist: [/^\/supabase/, /^\/api/],
      },
    }),
  ],
})
