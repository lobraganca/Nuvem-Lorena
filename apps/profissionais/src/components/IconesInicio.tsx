import type { ReactNode } from "react";

/**
 * Os ícones da tela de início.
 *
 * Ficam aqui, e não em `IconeDeServico`, porque não são ofícios: aquele
 * arquivo mapeia categoria de trabalho para desenho, e enfiar "estrela" e
 * "conversa" no meio da lista faria a busca por ofício encontrar coisas que
 * não são profissão nenhuma.
 *
 * Mesma gramática de lá, de propósito — grade 24×24, traço 1,8,
 * `currentColor` —, que é a mesma da barra de navegação. Um app onde cada
 * tela desenha de um jeito parece um app remendado, e esta é a primeira que
 * alguém vê.
 *
 * Nada de emoji: o mesmo código vira um desenho no Android e outro no
 * iPhone, e o conjunto puxa a tela para o informal — o oposto do que
 * precisa transmitir um app onde se contrata alguém.
 */

type Desenho = () => ReactNode;

/* Lupa. É o mesmo gesto do botão central da barra de baixo, e isso é
   intencional: quem tocar aqui vai parar exatamente naquela tela. */
const lupa: Desenho = () => (
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>
);

/* Maleta de trabalho, para quem vem se cadastrar. A alça é o que faz ler
   como trabalho — sem ela é uma caixa. */
const maleta: Desenho = () => (
  <>
    <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
    <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 12.5h18" />
  </>
);

/* Alfinete de mapa: "aqui do lado". */
const alfinete: Desenho = () => (
  <>
    <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </>
);

/* Estrela das avaliações — a mesma forma das estrelas da nota. */
const estrela: Desenho = () => (
  <path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.4l5.9-.8z" />
);

/* Balão de conversa, para o contato direto. */
const conversa: Desenho = () => (
  <>
    <path d="M20.5 12.4c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.6-.34L4 21l1.5-3.6A6.8 6.8 0 0 1 3.5 12.4c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2Z" />
    <path d="M9 12.2h.01M12 12.2h.01M15 12.2h.01" />
  </>
);

/* Selo do premium: o mesmo par de fita e disco do selo de verificação. */
const selo: Desenho = () => (
  <>
    <circle cx="12" cy="9" r="5.5" />
    <path d="m8.5 13.6-1.4 6.9 4.9-2.6 4.9 2.6-1.4-6.9" />
  </>
);

/* Duas pessoas, para a vizinhança. Uma inteira e outra atrás pela metade:
   com as duas inteiras, em 24px viram um borrão simétrico. */
const vizinhos: Desenho = () => (
  <>
    <circle cx="9.5" cy="8" r="3.4" />
    <path d="M3.5 20a6 6 0 0 1 12 0" />
    <path d="M16.2 5.2a3.4 3.4 0 0 1 0 5.6M17.5 14.6a6 6 0 0 1 3 5.4" />
  </>
);

const DESENHOS: Record<string, Desenho> = {
  lupa,
  maleta,
  alfinete,
  estrela,
  conversa,
  selo,
  vizinhos,
};

export type NomeDeIcone = keyof typeof DESENHOS;

export function IconeInicio({ nome, tamanho = 24 }: { nome: NomeDeIcone; tamanho?: number }) {
  const Desenho = DESENHOS[nome];
  if (!Desenho) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <Desenho />
    </svg>
  );
}
