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
 *    Aí a frase é uma só e fixa — ver `SEM_NOME`.
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

/**
 * As frases de quem o app conhece pelo nome. Uma por dia.
 *
 * ── SEM NOME É UMA FRASE SÓ, E FIXA — 05/09 ───────────────────────────
 *
 * A dona: "quando ainda não tiver nome de empresa e da pessoa, colocar
 * saudação: olá que bom ter você aqui."
 *
 * Cada frase daqui tinha uma segunda versão, sem nome, e elas giravam
 * junto com as outras. Girar faz sentido para quem o app conhece: sete
 * jeitos de dizer "oi, Lorena" soam como alguém que te reconhece.
 *
 * Sem nome, não. "Vamos com tudo hoje?" e "O dia começou. Bora?" para uma
 * pessoa anônima não são acolhimento, são palavra de ordem de cartaz — e é
 * justamente na primeira abertura, antes de qualquer cadastro, que elas
 * apareciam. Uma frase só, e que dá boas-vindas em vez de animar, é o
 * certo para quem o app ainda não sabe quem é.
 */
type Frase = { comNome: (nome: string) => string };

const FRASES: Frase[] = [
  { comNome: (n) => `Ei ${n}, que bom te ver de novo.` },
  { comNome: (n) => `Ei ${n}, vamos com tudo hoje?` },
  { comNome: (n) => `Bom te ver por aqui, ${n}.` },
  { comNome: (n) => `Ei ${n}, o dia começou. Bora?` },
  { comNome: (n) => `Que bom que você voltou, ${n}.` },
  { comNome: (n) => `Ei ${n}, novidade pode aparecer hoje.` },
  { comNome: (n) => `Oi, ${n}. Vamos ver o que chegou?` },
];

/** A de quem o app ainda não conhece — nem pessoa, nem empresa. */
const SEM_NOME = "Olá, que bom ter você aqui.";

/** Só o primeiro nome, e com a primeira letra maiúscula. */
function primeiroNome(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim();
  if (!limpo) return "";
  const primeiro = limpo.split(/\s+/)[0];
  /* Muita gente cadastra o nome todo em maiúsculas. "Ei LORENA" grita. */
  return primeiro.charAt(0).toLocaleUpperCase("pt-BR") + primeiro.slice(1).toLocaleLowerCase("pt-BR");
}

/**
 * O nome de uma EMPRESA, que não se trata como nome de gente — 05/09.
 *
 * A dona: "quando não tem perfil profissional, ao entrar a saudação deve
 * ser o nome da empresa."
 *
 * Passar o nome da empresa por `primeiroNome` estragaria os dois lados:
 *
 *   "Padaria Pão de Minas"      → "Padaria"      (a cidade tem várias)
 *   "Supermercado Boa Compra"   → "Supermercado" (idem)
 *   "JB Transportes"            → "Jb"           (a sigla vira erro de digitação)
 *
 * Nome de pessoa se encurta porque o primeiro nome É como se chama alguém.
 * Nome de empresa é o conjunto: cortá-lo não é intimidade, é trocar de
 * empresa.
 *
 * O que sobra da regra antiga é só o não-gritar, e mesmo assim com
 * cuidado: só endireita quem está TODO em maiúscula, porque aí é o
 * teclado, não a marca. "JB Transportes" tem minúscula e passa intacto —
 * e "Pão de Minas" mantém o "de" minúsculo, que Title Case cego comeria.
 */
function nomeDaEmpresa(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim().replace(/\s+/g, " ");
  if (!limpo) return "";
  const gritando = limpo === limpo.toLocaleUpperCase("pt-BR");
  if (!gritando) return limpo;
  return limpo
    .split(" ")
    .map((p) => p.charAt(0) + p.slice(1).toLocaleLowerCase("pt-BR"))
    .join(" ");
}

/**
 * A frase de hoje. Estável do primeiro ao último minuto do dia.
 *
 * `de` diz de quem é o nome — ver `nomeDaEmpresa` para o porquê de os dois
 * não passarem pelo mesmo tratamento.
 */
export function saudacaoDoDia(
  nome: string | null | undefined,
  de: "pessoa" | "empresa" = "pessoa"
): string {
  const n = de === "empresa" ? nomeDaEmpresa(nome) : primeiroNome(nome);
  if (!n) return SEM_NOME;

  /* O dia como número inteiro desde 1970, no fuso do aparelho: assim a
     frase troca à meia-noite de quem lê, e não à meia-noite de Londres. */
  const agora = new Date();
  const dia = Math.floor(
    (agora.getTime() - agora.getTimezoneOffset() * 60_000) / 86_400_000
  );
  const frase = FRASES[((dia % FRASES.length) + FRASES.length) % FRASES.length];
  return frase.comNome(n);
}
