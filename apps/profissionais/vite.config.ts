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
        // O HTML ficou DE FORA do cache de propósito. Com ele guardado, cada
        // publicação nova só aparecia na segunda ou terceira vez que a pessoa
        // abria o app — e quem estava com a versão velha não tinha como saber
        // disso. Deixando a navegação ir sempre à rede, o index.html vem
        // fresco e já aponta para os arquivos novos.
        //
        // Custo assumido: sem HTML no cache, o app não abre offline. Para um
        // app que ainda muda toda hora, receber a versão certa vale mais que
        // abrir sem internet.
        globPatterns: ['**/*.{js,css,svg,png,ico}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
})
