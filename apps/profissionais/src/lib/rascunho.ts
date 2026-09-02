import { useEffect, useRef, useState } from "react";

/**
 * O rascunho dos formulários longos, guardado no próprio aparelho.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "ter opção de salvar rascunho nas telas de cadastro pra evitar
 * de ter que reescrever tudo quando não tem um dado. Verifique se tem como
 * salvar automático."
 *
 * Tem, e é o certo aqui. Um botão "salvar rascunho" só ajuda quem lembra
 * de tocar nele — e o caso que ela descreve é exatamente o contrário: a
 * pessoa para no meio porque FALTA um dado (o CNPJ, o valor do salário),
 * sai para procurar, e o app já perdeu tudo. Ninguém toca em "salvar"
 * antes de um acidente que não sabe que vai ter.
 *
 * Então salva sozinho, a cada mudança. O botão que sobra é o oposto:
 * "começar do zero", para quem NÃO quer o que estava lá.
 *
 * ── POR QUE NO APARELHO, E NÃO NO BANCO ───────────────────────────────
 *
 * Rascunho no banco precisaria de tabela, de policy, de migration e de
 * conexão — e o momento em que ele mais serve é justamente o pior: sem
 * sinal, no meio da rua, com o app fechando. `localStorage` grava na hora,
 * sem rede e sem permissão.
 *
 * O preço é honesto e vale a pena: o rascunho é daquele aparelho e daquele
 * navegador. Quem começa no celular não continua no computador — e ninguém
 * espera isso de um formulário que nem foi enviado.
 *
 * ── O QUE NÃO ENTRA AQUI ──────────────────────────────────────────────
 *
 * Nada que dependa de arquivo (foto) e nada que já esteja gravado no
 * banco. O rascunho é do TEXTO digitado, que é o que dá trabalho e o que
 * se perde.
 */

/** Quanto tempo esperar depois da última tecla antes de gravar. */
const ESPERA_MS = 400;

/** Rascunho velho não vale: a vaga de duas semanas atrás já não é a mesma. */
const VALIDADE_DIAS = 14;

type Guardado<T> = { quando: number; etapa: number; dados: T };

function ler<T>(chave: string): Guardado<T> | null {
  try {
    const cru = window.localStorage.getItem(chave);
    if (!cru) return null;
    const g = JSON.parse(cru) as Guardado<T>;
    if (!g || typeof g.quando !== "number") return null;
    if (Date.now() - g.quando > VALIDADE_DIAS * 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(chave);
      return null;
    }
    return g;
  } catch {
    /* JSON estragado ou armazenamento bloqueado: segue sem rascunho, que é
       o estado de quem nunca teve um. */
    return null;
  }
}

/**
 * Liga o formulário ao rascunho.
 *
 * Devolve o que foi encontrado na abertura (para a tela restaurar), se há
 * rascunho em uso, e as duas ações: `descartar` (o "começar do zero") e
 * `limpar` (chamado quando o formulário é enviado de verdade — aí o
 * rascunho cumpriu o papel e não pode reaparecer na próxima vaga).
 *
 * A gravação é adiada em 400ms depois da última tecla. Sem isso, gravar a
 * cada letra de um campo de descrição faz o `localStorage` ser escrito
 * trinta vezes por frase — e é gravação síncrona, no mesmo fio que desenha
 * a tela.
 */
export function useRascunho<T>(
  chave: string,
  dados: T,
  etapa: number,
  /* Enquanto a tela está carregando o que já existe no banco, `dados` é o
     formulário VAZIO — e gravar isso apagaria o rascunho de quem voltou
     para continuar. A tela diz quando está pronta. */
  pronto: boolean
) {
  const [inicial] = useState(() => ler<T>(chave));
  const [temRascunho, setTemRascunho] = useState(!!inicial);
  const primeira = useRef(true);
  /* Zerar o formulário apaga o guardado e, 400ms depois, o próprio efeito
     gravaria o formulário VAZIO por cima — deixando um rascunho em branco
     que faz o aviso "voltamos de onde você parou" reaparecer na próxima
     abertura, sem nada para voltar. Esta bandeira pula exatamente essa
     gravação. Achado testando no navegador: depois de "começar do zero" o
     armazenamento continuava com uma chave. */
  const pulaProxima = useRef(false);

  useEffect(() => {
    if (!pronto) return;
    /* A primeira passada depois de pronto é o próprio estado restaurado (ou
       o vazio inicial): não há o que gravar, e gravar aqui carimbaria a
       data de hoje num rascunho que a pessoa nem abriu. */
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    if (pulaProxima.current) {
      pulaProxima.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      try {
        const g: Guardado<T> = { quando: Date.now(), etapa, dados };
        window.localStorage.setItem(chave, JSON.stringify(g));
        setTemRascunho(true);
      } catch {
        /* Sem espaço ou sem permissão: o formulário continua funcionando,
           só não sobrevive a fechar o app. Não é caso de avisar — não há o
           que a pessoa possa fazer com o aviso. */
      }
    }, ESPERA_MS);
    return () => window.clearTimeout(id);
  }, [chave, dados, etapa, pronto]);

  function limpar() {
    try {
      window.localStorage.removeItem(chave);
    } catch {
      /* idem */
    }
    pulaProxima.current = true;
    setTemRascunho(false);
  }

  return {
    /** O que estava guardado quando a tela abriu, ou `null`. */
    inicial,
    /** Se existe rascunho gravado agora (para a tela mostrar o aviso). */
    temRascunho,
    /** Apaga o guardado — o "começar do zero". */
    descartar: limpar,
    /** Apaga o guardado porque o formulário foi enviado. */
    limpar,
  };
}

export const CHAVE_RASCUNHO_VAGA = "ei-rascunho-vaga";
export const CHAVE_RASCUNHO_EMPRESA = "ei-rascunho-empresa";
