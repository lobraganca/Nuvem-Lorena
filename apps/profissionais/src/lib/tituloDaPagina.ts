import { useEffect } from "react";

const NOME = "Ei Emprego";

/**
 * Nome da aba, por tela.
 *
 * Todas as telas mostravam o mesmo título, porque num app de página única o
 * navegador só lê o título uma vez, no carregamento. Isso aparece em três
 * lugares que importam: no histórico (onde tudo vira uma linha repetida
 * impossível de reencontrar), na lista de abas de quem usa o computador, e no
 * nome sugerido quando alguém salva o link na tela de início.
 *
 * O nome do app vem depois, e não antes: em aba estreita e no histórico o
 * final é o que some, então o começo tem que ser o que distingue uma tela da
 * outra — "Encanador João" antes de "procurô", nunca o contrário.
 */
export function useTituloDaPagina(titulo?: string | null) {
  useEffect(() => {
    document.title = titulo ? `${titulo} — ${NOME}` : NOME;
    /* Sem a limpeza, sair de uma tela com título deixava o nome antigo na aba
       até a próxima tela definir o seu — e telas sem título nenhum herdavam
       o título de onde a pessoa esteve antes. */
    return () => {
      document.title = NOME;
    };
  }, [titulo]);
}
