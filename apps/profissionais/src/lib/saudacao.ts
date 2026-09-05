/**
 * "Ei Lorena, que bom te ver de novo."
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "colocar uma frase motivacional na tela da empresa e do
 * profissional. Escrito, por exemplo: 'Ei Lorena, que bom te ver de novo',
 * 'Ei Lorena, vamos com tudo hoje?' E várias outras."
 *
 * ── Três decisões ──────────────────────────────────────────────────────
 *
 * 1. SÓ O PRIMEIRO NOME. "Ei Maria Eduarda de Souza e Oliveira Nascimento,
 *    vamos com tudo hoje?" é o nome inteiro do cadastro numa frase que
 *    devia ser leve — e no celular quebra em três linhas.
 *
 * 2. SEM NOME TAMBÉM FUNCIONA. Quem ainda não preencheu o cadastro tem o
 *    nome vazio, e "Ei , que bom te ver de novo" é pior que frase nenhuma.
 *    Cada frase existe nas duas formas.
 *
 * 3. A MESMA FRASE O DIA INTEIRO. A escolha vem da DATA, e não de um
 *    sorteio a cada desenho: com `Math.random()` a frase trocaria a cada
 *    vez que o React redesenhasse a tela — voltar de uma vaga mudaria o
 *    cumprimento, e o app pareceria instável. Muda uma vez por dia, que é
 *    o ritmo de quem abre o app para procurar trabalho.
 *
 * ── O que estas frases NÃO fazem ───────────────────────────────────────
 *
 * Não prometem emprego, não dizem "hoje é o seu dia" e não mandam ninguém
 * ter fé. Quem abre este app quase sempre está desempregado; frase de
 * pôster nessa hora não anima, irrita. O tom é o de quem conhece a pessoa
 * e está feliz de vê-la — nada além disso.
 */

/** As duas versões da mesma frase: com nome e sem. */
type Frase = { comNome: (nome: string) => string; semNome: string };

const FRASES: Frase[] = [
  {
    comNome: (n) => `Ei ${n}, que bom te ver de novo.`,
    semNome: "Ei, que bom te ver de novo.",
  },
  {
    comNome: (n) => `Ei ${n}, vamos com tudo hoje?`,
    semNome: "Vamos com tudo hoje?",
  },
  {
    comNome: (n) => `Bom te ver por aqui, ${n}.`,
    semNome: "Bom te ver por aqui.",
  },
  {
    comNome: (n) => `Ei ${n}, o dia começou. Bora?`,
    semNome: "O dia começou. Bora?",
  },
  {
    comNome: (n) => `Que bom que você voltou, ${n}.`,
    semNome: "Que bom que você voltou.",
  },
  {
    comNome: (n) => `Ei ${n}, novidade pode aparecer hoje.`,
    semNome: "Novidade pode aparecer hoje.",
  },
  {
    comNome: (n) => `Oi, ${n}. Vamos ver o que chegou?`,
    semNome: "Vamos ver o que chegou?",
  },
];

/** Só o primeiro nome, e com a primeira letra maiúscula. */
function primeiroNome(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim();
  if (!limpo) return "";
  const primeiro = limpo.split(/\s+/)[0];
  /* Muita gente cadastra o nome todo em maiúsculas. "Ei LORENA" grita. */
  return primeiro.charAt(0).toLocaleUpperCase("pt-BR") + primeiro.slice(1).toLocaleLowerCase("pt-BR");
}

/**
 * A frase de hoje. Estável do primeiro ao último minuto do dia.
 */
export function saudacaoDoDia(nome: string | null | undefined): string {
  const n = primeiroNome(nome);
  /* O dia como número inteiro desde 1970, no fuso do aparelho: assim a
     frase troca à meia-noite de quem lê, e não à meia-noite de Londres. */
  const agora = new Date();
  const dia = Math.floor(
    (agora.getTime() - agora.getTimezoneOffset() * 60_000) / 86_400_000
  );
  const frase = FRASES[((dia % FRASES.length) + FRASES.length) % FRASES.length];
  return n ? frase.comNome(n) : frase.semNome;
}
