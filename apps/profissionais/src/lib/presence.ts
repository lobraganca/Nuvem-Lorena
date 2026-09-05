import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { lerLadoDaSessao } from "./ladoDaSessao";

/**
 * Quem está com o app aberto agora.
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "quero colocar na tela quantas pessoas e empresas estão on-line
 * ao vivo."
 *
 * Usa o Presence do Supabase Realtime: cada aba entra num canal comum e
 * anuncia sua existência; quem fecha a aba some sozinho, sem tabela, sem
 * faxina agendada e sem batimento escrito à mão. Nenhum dado pessoal
 * trafega — só uma chave aleatória por aba e a palavra "professional" ou
 * "company". Dá para saber QUANTOS, nunca QUEM.
 *
 * ── UM CANAL PARA O APP INTEIRO — 05/09 ───────────────────────────────
 *
 * Este arquivo tinha DOIS ganchos, cada um abrindo `client.channel(
 * "presenca-online")` por conta própria. O supabase-js devolve o MESMO
 * objeto de canal para o mesmo nome — então o segundo gancho chamava
 * `.on("presence", …)` num canal que o primeiro já tinha assinado, e o
 * Realtime recusava:
 *
 *     cannot add `presence` callbacks for realtime:presenca-online
 *     after `subscribe()`
 *
 * A dona viu esse erro no console. Era meu, e do dia anterior: o gancho
 * antigo (`useOnlineCount`) continuava sendo chamado no cabeçalho do app,
 * onde o número nem chega a ser mostrado — herança do outro produto —, e o
 * novo entrou na tela inicial. Os dois montados juntos, e o segundo
 * perdia: a linha "3 pessoas e 2 empresas no app agora" ficava presa no
 * primeiro valor.
 *
 * O conserto não é escolher um dos dois: é o app ter UMA assinatura só,
 * com quantos leitores quiser. A inscrição vive no módulo, fora do React;
 * os ganchos só entram e saem da lista de quem quer ser avisado. Assim o
 * defeito não volta porque alguém usou o gancho em duas telas.
 */

export type QuemEstaOnline = {
  profissionais: number;
  empresas: number;
  total: number;
};

/* ── A assinatura única ────────────────────────────────────────────────
   `null` enquanto não se sabe (ou sem banco configurado), para a tela
   simplesmente não mostrar nada em vez de piscar "0 pessoas". */
let atual: QuemEstaOnline | null = null;
let canal: ReturnType<NonNullable<ReturnType<typeof supabase>>["channel"]> | null = null;
const ouvintes = new Set<(q: QuemEstaOnline | null) => void>();

function contar(estado: Record<string, { lado?: string | null }[]>) {
  let profissionais = 0;
  let empresas = 0;
  let total = 0;
  for (const presencas of Object.values(estado)) {
    /* Uma aba pode ter mais de uma entrada durante a reconexão; o que
       conta é a aba, e a primeira entrada dela basta. */
    const p = presencas[0];
    total += 1;
    if (p?.lado === "professional") profissionais += 1;
    else if (p?.lado === "company") empresas += 1;
    /* Quem ainda não escolheu lado entra no total e em nenhum dos dois:
       contá-lo em um deles seria inventar movimento. */
  }
  atual = { profissionais, empresas, total };
  for (const o of ouvintes) o(atual);
}

function abrir() {
  if (canal) return;
  const client = supabase();
  if (!client) return;

  const chave = Math.random().toString(36).slice(2);
  const c = client.channel("presenca-online", { config: { presence: { key: chave } } });
  canal = c;

  /* O `.on` vem SEMPRE antes do `.subscribe`, e é justamente essa ordem
     que o erro do console denunciava. Aqui isso é garantido por só existir
     um lugar que abre o canal. */
  c.on("presence", { event: "sync" }, () => {
    contar(c.presenceState() as Record<string, { lado?: string | null }[]>);
  }).subscribe((status: string) => {
    if (status === "SUBSCRIBED") {
      /* O lado é lido na hora do `track`, e não guardado num estado: quem
         troca de lado recarrega a página inteira (ver `ladoDaSessao.ts`),
         e a presença nova já sai com o lado certo. */
      void c.track({ em: Date.now(), lado: lerLadoDaSessao() });
    }
  });
}

function fechar() {
  const client = supabase();
  if (canal && client) client.removeChannel(canal);
  canal = null;
  atual = null;
}

function inscrever(ouvinte: (q: QuemEstaOnline | null) => void): () => void {
  ouvintes.add(ouvinte);
  abrir();
  /* Entrega o que já se sabe, para quem chega depois do primeiro `sync`
     não ficar esperando o próximo. */
  if (atual) ouvinte(atual);
  return () => {
    ouvintes.delete(ouvinte);
    /* Sem ninguém olhando, a aba sai do canal: é o que faz a contagem dos
       outros ficar certa quando esta pessoa navega para uma tela que não
       mostra o número. */
    if (ouvintes.size === 0) fechar();
  };
}

/**
 * Quantas PESSOAS e quantas EMPRESAS estão com o app aberto agora.
 * Devolve `null` enquanto não sabe.
 */
export function useQuemEstaOnline(): QuemEstaOnline | null {
  const [quem, setQuem] = useState<QuemEstaOnline | null>(atual);
  useEffect(() => inscrever(setQuem), []);
  return quem;
}

/**
 * Só o total. Sobra do outro produto, onde o cabeçalho mostrava "12
 * pessoas navegando". Nenhuma tela do Ei mostra este número — e quem
 * chamar pega a mesma assinatura, sem abrir canal novo.
 */
export function useOnlineCount(): number | null {
  return useQuemEstaOnline()?.total ?? null;
}
