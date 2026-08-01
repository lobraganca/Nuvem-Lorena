/**
 * Quanto tempo a empresa costuma levar para responder.
 *
 * "Perguntar" era um botão de fé: a pessoa mandava a dúvida sem saber se a
 * resposta vinha em uma hora ou em três dias — e a dúvida que demora vira
 * desistência, quase sempre para o concorrente que respondeu.
 *
 * O número é medido, nunca declarado pela empresa. Uma promessa de "respondo
 * rápido" escrita por quem responde não vale nada; o que vale é o histórico.
 *
 * Mediana e não média: uma única resposta esquecida por duas semanas puxaria
 * a média para cima e faria uma empresa atenciosa parecer relapsa. A mediana
 * conta o que costuma acontecer, que é o que a pergunta faz.
 */
import type { Message } from "../types";

/** Poucas trocas não dizem nada, e um número frágil engana mais do que informa. */
const MINIMO_DE_RESPOSTAS = 2;

export interface ResponseTime {
  /** Mediana em minutos. */
  minutes: number;
  /** Quantas respostas entraram na conta. */
  samples: number;
}

export function responseTimeFor(
  messages: Message[],
  businessId: string
): ResponseTime | null {
  const thread = messages
    .filter((m) => m.businessId === businessId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const esperas: number[] = [];
  let perguntaEm: number | null = null;

  for (const m of thread) {
    if (m.sender === "me") {
      // Só a primeira de uma sequência conta: quem manda três mensagens
      // seguidas não esperou três vezes.
      if (perguntaEm === null) perguntaEm = new Date(m.timestamp).getTime();
    } else if (perguntaEm !== null) {
      const minutos = (new Date(m.timestamp).getTime() - perguntaEm) / 60000;
      if (minutos >= 0) esperas.push(minutos);
      perguntaEm = null;
    }
  }

  if (esperas.length < MINIMO_DE_RESPOSTAS) return null;

  esperas.sort((a, b) => a - b);
  const meio = Math.floor(esperas.length / 2);
  const mediana =
    esperas.length % 2 === 0
      ? (esperas[meio - 1] + esperas[meio]) / 2
      : esperas[meio];

  return { minutes: Math.round(mediana), samples: esperas.length };
}

/** Em palavras, arredondado para o que é útil ler. */
export function responseTimeLabel(rt: ResponseTime): string {
  if (rt.minutes < 60) return "Costuma responder em minutos";
  if (rt.minutes < 180) return "Costuma responder em cerca de uma hora";
  if (rt.minutes < 60 * 24) return "Costuma responder no mesmo dia";
  if (rt.minutes < 60 * 24 * 3) return "Costuma responder em um ou dois dias";
  return "Costuma demorar alguns dias para responder";
}
