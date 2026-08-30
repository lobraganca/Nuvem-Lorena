/**
 * Carrega o pedaço de código de uma tela, recarregando o app se o arquivo
 * não existir mais.
 *
 * As telas menos visitadas (Admin, Painel, Termos…) vivem cada uma no seu
 * próprio arquivo, nomeado com um trecho do conteúdo — a cada publicação
 * nova, o nome muda. Um app instalado fica dias com a mesma versão em
 * segundo plano (ver `lib/atualizacao.ts`) esperando a pessoa aceitar
 * atualizar; enquanto isso, o arquivo antigo de uma tela pouco visitada
 * pode já não existir mais no servidor. O pedido não vira um 404 comum: o
 * Vercel devolve a página inicial no lugar de qualquer arquivo que não
 * encontra, para as rotas do próprio app funcionarem — e o navegador,
 * esperando JavaScript e recebendo HTML, recusa com "'text/html' is not a
 * valid JavaScript MIME type." Quem via isso caía na tela de "algo
 * quebrou", com um botão que refazia o mesmo pedido e falhava do mesmo
 * jeito — a única saída de verdade era fechar o app e abrir de novo.
 *
 * Esta função reconhece esse erro específico e recarrega a página uma
 * vez, o que baixa o `index.html` novo e, com ele, os nomes de arquivo
 * certos da versão atual. Uma trava em `sessionStorage` impede um loop de
 * recarregamentos se o problema for outro (arquivo genuinamente quebrado):
 * na segunda falha seguida, o erro sobe normalmente e a tela de erro
 * aparece — dessa vez descrevendo algo que recarregar não resolve.
 */
/** A mesma mensagem denuncia isso de várias formas, dependendo do navegador. */
export function pareceArquivoDesatualizado(mensagem: string): boolean {
  return /MIME type|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    mensagem
  );
}

/**
 * Descarta o service worker e os arquivos guardados, e recarrega.
 *
 * Um `location.reload()` sozinho não basta aqui: é o próprio service worker
 * quem intercepta o pedido do `index.html` e devolve a cópia antiga
 * guardada — recarregar pede de novo a mesma página velha, que aponta para
 * o mesmo arquivo que não existe mais, e a pessoa vê o mesmo erro de novo.
 * Foi o que aconteceu com quem tocou em "Tentar de novo" e nada mudou.
 *
 * Cancelando o registro do service worker e apagando o que ele guardou, o
 * recarregamento seguinte não tem mais quem responda pela rede antiga —
 * vai direto ao servidor buscar o `index.html` de agora.
 */
export async function recarregarDoZero() {
  try {
    if ("serviceWorker" in navigator) {
      const registros = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registros.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const nomes = await caches.keys();
      await Promise.all(nomes.map((n) => caches.delete(n)));
    }
  } catch {
    /* Sem service worker ativo, ou navegador sem suporte: recarregar já
       resolve sozinho, sem nada para limpar antes. */
  }
  window.location.reload();
}

export function importarPagina<T>(carregar: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      return await carregar();
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      const chave = "ei-recarregou-por-arquivo-antigo";
      if (pareceArquivoDesatualizado(mensagem) && !window.sessionStorage.getItem(chave)) {
        window.sessionStorage.setItem(chave, "1");
        void recarregarDoZero();
        // A promessa nunca resolve: a recarga já está a caminho, e devolver
        // qualquer coisa aqui só deixaria a tela antiga tentar renderizar
        // por um instante com dado errado.
        return new Promise<T>(() => {});
      }
      throw err;
    }
  };
}
