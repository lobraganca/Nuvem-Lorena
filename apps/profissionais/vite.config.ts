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

/**
 * O commit que originou esta build, quando a Vercel constrói.
 *
 * Vazio quando alguém roda `npm run build` na própria máquina — ali não há
 * commit associado, e inventar um seria pior que não ter.
 */
const COMMIT = process.env.VERCEL_GIT_COMMIT_SHA ?? "";

/**
 * Publica `versao.json` na raiz do site, com o carimbo e o commit.
 *
 * Existe para responder de fora do app uma pergunta que hoje só dá para
 * responder olhando a tela de um celular: *o site está servindo o que foi
 * publicado?*
 *
 * O gatilho de publicação é um webhook — o GitHub avisa a Vercel e recebe
 * "ok, recebi". Se a build da Vercel falhar depois disso, o GitHub continua
 * marcando sucesso e o site continua velho, sem nada em lugar nenhum
 * apontando a diferença. Foi assim que três correções seguidas pareceram
 * publicadas sem estarem.
 *
 * Com este arquivo, o próprio fluxo de publicação consegue perguntar ao site
 * qual commit ele está servindo, e falhar quando a resposta não for a
 * esperada.
 */
function publicarVersao() {
  return {
    name: "publicar-versao",
    generateBundle(this: { emitFile: (f: { type: "asset"; fileName: string; source: string }) => void }) {
      this.emitFile({
        type: "asset",
        fileName: "versao.json",
        source: JSON.stringify({ carimbo: CARIMBO, commit: COMMIT }, null, 2),
      });
    },
  };
}

export default defineConfig({
  define: {
    __VERSAO__: JSON.stringify(CARIMBO),
  },
  plugins: [
    react(),
    publicarVersao(),
    VitePWA({
      // 'prompt', e não 'autoUpdate': com autoUpdate a versão nova assume o
      // controle sozinha e a página recarrega no meio do que a pessoa estiver
      // fazendo. Num app cujo formulário mais importante é um cadastro longo
      // — foto, endereço, serviços, telefone —, recarregar sem avisar apaga o
      // trabalho de quem estava digitando. Quem decide a hora é ela.
      registerType: 'prompt',
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
        // Sem isto, o Workbox cria uma rota de navegação que responde TODA
        // navegação com um index.html do cache — e o index.html nem está no
        // cache, porque o padrão acima o deixa de fora de propósito. O
        // resultado é o app instalado na tela do celular abrindo sempre a
        // mesma versão de antes: publicar deixava de ter efeito para quem
        // tinha instalado, e não havia como perceber isso de fora.
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        // Os dois desligados pelo mesmo motivo: a versão nova fica esperando
        // em segundo plano e só entra quando a pessoa tocar em "Atualizar".
        // Com skipWaiting ligado, os arquivos antigos são apagados debaixo da
        // página que ainda está aberta — e aí um pedaço do app que só carrega
        // quando a pessoa navega deixa de existir no meio do caminho.
        clientsClaim: false,
        skipWaiting: false,
      },
    }),
  ],
})
