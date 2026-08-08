import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
/**
 * Carimbo da versão publicada, mostrado no rodapé do app.
 *
 * Existe por um motivo prático: sem ele, não há como saber se o aparelho de
 * quem está do outro lado carregou a versão nova ou uma guardada de antes —
 * e um app que fica guardado no celular erra isso com frequência. Sem essa
 * informação, uma correção que já foi publicada e uma que não pegou parecem
 * exatamente a mesma coisa.
 */
const CARIMBO = new Date().toLocaleString("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default defineConfig({
  define: {
    __VERSAO__: JSON.stringify(CARIMBO),
  },
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
