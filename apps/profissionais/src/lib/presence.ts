import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { lerLadoDaSessao } from "./ladoDaSessao";

/**
 * Quantas pessoas estão com o app aberto agora.
 *
 * Usa o Presence do Supabase Realtime: cada aba entra num canal comum e
 * anuncia sua existência; quem fecha a aba some sozinho, sem precisar de
 * tabela, cron de limpeza ou heartbeat escrito à mão. Nenhum dado pessoal
 * trafega aqui — só uma chave aleatória por aba, o suficiente para contar.
 *
 * Devolve `null` enquanto não sabe (ou quando não há banco configurado), para
 * a tela poder simplesmente não mostrar nada em vez de piscar "0 pessoas".
 */
export function useOnlineCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const client = supabase();
    if (!client) return;

    const key = Math.random().toString(36).slice(2);
    const channel = client.channel("presenca-online", {
      config: { presence: { key } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ em: Date.now(), lado: lerLadoDaSessao() });
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  return count;
}

/**
 * Quantas PESSOAS e quantas EMPRESAS estão com o app aberto agora.
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "quero colocar na tela quantas pessoas e empresas estão on-line
 * ao vivo."
 *
 * ── Por que separado, e por que isso importa aqui ─────────────────────
 *
 * Um número só ("12 pessoas online") não diz nada para nenhum dos dois
 * lados. Quem procura emprego quer saber se há EMPRESA olhando; quem
 * contrata quer saber se há GENTE. Numa cidade pequena, esse é o número
 * que responde "vale a pena eu deixar meu cadastro aqui?" — e é a única
 * prova de movimento que um app novo consegue mostrar.
 *
 * ── O lado vai junto no `track`, e nada mais ──────────────────────────
 *
 * Continua sem dado pessoal: cada aba anuncia uma chave aleatória e a
 * palavra "professional" ou "company". Não dá para saber QUEM está online
 * — só quantos, de cada lado.
 *
 * Quem ainda não escolheu lado entra como `null` e não é contado em
 * nenhum dos dois: contá-lo em um deles seria inventar movimento.
 */
export type QuemEstaOnline = {
  profissionais: number;
  empresas: number;
  total: number;
};

export function useQuemEstaOnline(): QuemEstaOnline | null {
  const [quem, setQuem] = useState<QuemEstaOnline | null>(null);

  useEffect(() => {
    const client = supabase();
    if (!client) return;

    const key = Math.random().toString(36).slice(2);
    const channel = client.channel("presenca-online", {
      config: { presence: { key } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const estado = channel.presenceState() as Record<
          string,
          { lado?: string | null }[]
        >;
        let profissionais = 0;
        let empresas = 0;
        let total = 0;
        for (const presencas of Object.values(estado)) {
          /* Uma aba pode ter mais de uma entrada durante a reconexão; o
             que conta é a aba, e a primeira entrada dela basta. */
          const p = presencas[0];
          total += 1;
          if (p?.lado === "professional") profissionais += 1;
          else if (p?.lado === "company") empresas += 1;
        }
        setQuem({ profissionais, empresas, total });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          /* Lido na hora do `track`, e não guardado num estado: quem troca
             de lado recarrega a página inteira (ver `ladoDaSessao.ts`), e
             a presença nova já sai com o lado certo. */
          channel.track({ em: Date.now(), lado: lerLadoDaSessao() });
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  return quem;
}
