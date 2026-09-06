import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Quantas pessoas já foram contratadas pelo Ei Emprego.
 *
 * ── De onde sai ───────────────────────────────────────────────────────
 *
 * Da pergunta que o app já faz há semanas, ao encerrar uma vaga em "Já
 * contratei": "a pessoa que você contratou veio do Ei Emprego?" e
 * "quantas pessoas você contratou por esta vaga?". As respostas moram em
 * `job_listings`, e até agora só o painel da administração as lia.
 *
 * Quem soma é o banco (`numeros_do_ei`, migration 0125), e tem de ser
 * ele: vaga encerrada só é legível pelo dono da empresa e pela
 * administração, então o navegador não consegue contar — e nem deve, que
 * abrir as vagas encerradas para todo mundo entregaria junto o texto, o
 * salário e a empresa de cada uma.
 *
 * ── Por que ele aguenta a função não existir ──────────────────────────
 *
 * As migrations aqui são coladas à mão, e o código sobe sozinho. No
 * intervalo entre um e outro a função não existe, e o Supabase responde
 * "não achei essa função". Isso NÃO é motivo para a tela inicial quebrar
 * — é a tela inicial. Sem o número, ela é a de ontem.
 *
 * Mas silêncio total também não serve: sem nada no console, ninguém
 * nunca fica sabendo que a SQL não foi aplicada. Então o erro é escrito
 * lá, com a diferença que importa — "falta colar a SQL" é uma coisa,
 * "a função existe e quebrou" é outra bem diferente, e as duas apagariam
 * o mesmo número da tela.
 */

export type NumerosDoEi = {
  /** Pessoas contratadas por vagas do app, somando o que foi declarado. */
  contratados: number;
  /** Em quantas vagas isso aconteceu. */
  vagasQueContrataram: number;
};

/**
 * O piso para o número aparecer.
 *
 * Abaixo daqui ele não é mostrado, e isso é a favor do app: "2 pessoas
 * contratadas" não convence ninguém a pagar — convence a fechar a tela.
 * O número existe para responder "isto funciona?", e uma resposta fraca é
 * pior que nenhuma resposta, porque a pergunta nem tinha sido feita.
 *
 * Não é esconder resultado ruim de quem manda: o total continua no painel
 * da administração desde o primeiro, e é lá que ele serve para decidir.
 */
export const MINIMO_PARA_MOSTRAR = 5;

export async function numerosDoEi(): Promise<NumerosDoEi | null> {
  const sb = supabase();
  /* Sem cliente não há banco: acontece quando o app roda sem as chaves
     configuradas. Devolver `null` deixa a tela inteira de pé — é o mesmo
     que a função ainda não existir. */
  if (!sb) return null;

  const { data, error } = await sb.rpc("numeros_do_ei");

  if (error) {
    /* 42883 é o Postgres ("function does not exist"); PGRST202 é o
       PostgREST não achando a função no cache do schema. Os dois querem
       dizer a mesma coisa: a 0125 ainda não foi colada. */
    const e = error as { code?: string; message?: string };
    const faltaSQL =
      e.code === "42883" ||
      e.code === "PGRST202" ||
      (e.message ?? "").toLowerCase().includes("could not find the function");

    if (faltaSQL) {
      console.warn(
        "[Ei] O número de contratados não aparece porque a migration 0125 " +
          "ainda não foi aplicada no banco."
      );
    } else {
      console.error("[Ei] numeros_do_ei falhou:", error);
    }
    return null;
  }

  /* A função devolve UMA linha. `rpc` de função que retorna `table`
     entrega um array — pegar `data` direto daria um objeto estranho na
     tela em vez de um número. */
  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha) return null;

  return {
    contratados: Number(linha.contratados ?? 0),
    vagasQueContrataram: Number(linha.vagas_que_contrataram ?? 0),
  };
}

/**
 * O mesmo, para quem só quer pendurar numa tela.
 *
 * Devolve `null` enquanto não sabe E quando não há número para mostrar —
 * quem chama não precisa distinguir os dois casos, porque nos dois a tela
 * fica igual.
 */
export function useContratados(): number | null {
  const [quantos, setQuantos] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const n = await numerosDoEi();
      if (!vivo) return;
      if (n && n.contratados >= MINIMO_PARA_MOSTRAR) setQuantos(n.contratados);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return quantos;
}
