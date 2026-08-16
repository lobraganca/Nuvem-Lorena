import type { ReactNode } from "react";

/**
 * Ícones dos ofícios, de traço.
 *
 * Antes eram emoji. Dois problemas: o desenho de cada um é decidido pelo
 * sistema — o mesmo código vira um boneco no Android, outro no iPhone e um
 * terceiro no computador —, e o conjunto puxa a tela para o informal, que
 * é o oposto do que um app onde se contrata alguém precisa transmitir.
 *
 * Aqui é o mesmo desenho em todo lugar, na cor do texto, no traço dos
 * ícones da barra de navegação. E como são poucos e escolhidos, cada um
 * pode ser reconhecido de longe — que é a única coisa que um ícone de
 * categoria precisa fazer.
 *
 * Todos moram numa grade de 24×24 com traço de 1,8: em 26px de tela, que é
 * o tamanho no cartão, traço mais fino some e mais grosso vira borrão.
 */

type Desenho = () => ReactNode;

/* Chave de boca. A primeira tentativa era um traço com uma bolinha na
   ponta e lia como caneta — o desenho precisa da boca aberta em U, que é
   o que faz a ferramenta ser reconhecida. */
const chave: Desenho = () => (
  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-8l-3.7 3.9Z" />
);

/* Chave de porta, só para chaveiro: argola e dentes. */
const chaveDePorta: Desenho = () => (
  <>
    <circle cx="7.5" cy="7.5" r="4" />
    <path d="M10.4 10.4 20 20M17.5 17.5l2-2M15 15l2-2" />
  </>
);

const raio: Desenho = () => <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />;

const gota: Desenho = () => (
  <path d="M12 3s6 6.4 6 10.2A6 6 0 0 1 6 13.2C6 9.4 12 3 12 3Z" />
);

const parede: Desenho = () => (
  <>
    <rect x="3" y="5" width="18" height="14" rx="1" />
    <path d="M3 12h18M9 5v7M15 12v7" />
  </>
);

const rolo: Desenho = () => (
  <>
    <rect x="3" y="4" width="13" height="5" rx="1" />
    <path d="M16 6.5h3.5a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H12" />
    <rect x="10" y="12" width="4" height="3" rx="1" />
    <path d="M12 15v6" />
  </>
);

const tesoura: Desenho = () => (
  <>
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M17 3 8.5 16M7 3l8.5 13" />
  </>
);

const gotaDeEsmalte: Desenho = () => (
  <>
    <rect x="9" y="9" width="6" height="12" rx="2" />
    <path d="M10.5 9V5a1.5 1.5 0 0 1 3 0v4" />
    <path d="M9 13h6" />
  </>
);

const pulso: Desenho = () => (
  <path d="M2 12h4l2-5 3.5 11L15 8l2 4h5" />
);

const dente: Desenho = () => (
  <path d="M12 4c2 0 3-1 4.5-1S20 4.4 20 7c0 3-1 4-1.6 7.5S17.6 21 16.4 21s-1.4-2-1.7-4-1-2.6-2.7-2.6-2.4.6-2.7 2.6-.5 4-1.7 4-1.4-3-2-6.5S4 10 4 7c0-2.6 2-4 3.5-4S10 4 12 4Z" />
);

/* Livro aberto. Fechado — dois retângulos lado a lado — lia como janela;
   o que diz "livro" é a lombada no meio com as páginas caindo dos lados. */
const livro: Desenho = () => (
  <>
    <path d="M12 6.5C10.4 5 7.9 4.5 4 4.5v13c3.9 0 6.4.5 8 2 1.6-1.5 4.1-2 8-2v-13c-3.9 0-6.4.5-8 2Z" />
    <path d="M12 6.5v13" />
  </>
);

const camera: Desenho = () => (
  <>
    <rect x="2.5" y="7" width="19" height="13" rx="2" />
    <path d="M8.5 7 10 4h4l1.5 3" />
    <circle cx="12" cy="13.5" r="3.5" />
  </>
);

const bolo: Desenho = () => (
  <>
    <path d="M4 20h16v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Z" />
    <path d="M4 15c1.6 0 1.6 1.4 3.2 1.4S8.8 15 10.4 15s1.6 1.4 3.2 1.4S15.2 15 16.8 15s1.6 1.4 3.2 1.4" />
    <path d="M12 12V9M12 6.5V5" />
  </>
);

const carrinho: Desenho = () => (
  <>
    <path d="M2.5 3.5h2.2l2.4 11h10.4l2-7.5H6" />
    <circle cx="9" cy="19" r="1.6" />
    <circle cx="17" cy="19" r="1.6" />
  </>
);

const carro: Desenho = () => (
  <>
    <path d="M3 13.5 5 8a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 8l2 5.5" />
    <rect x="2.5" y="13.5" width="19" height="5" rx="1.5" />
    <path d="M6 18.5V20M18 18.5V20M6.5 16h2M15.5 16h2" />
  </>
);

const caminhao: Desenho = () => (
  <>
    <path d="M2.5 6.5h11v10h-11z" />
    <path d="M13.5 10H18l3 3v3.5h-7.5" />
    <circle cx="7" cy="18.5" r="1.7" />
    <circle cx="17" cy="18.5" r="1.7" />
  </>
);

const agulha: Desenho = () => (
  <>
    <path d="M20 4 8.5 15.5" />
    <path d="M4 20c1.5-3 3-3.5 4.5-4.5" />
    <circle cx="19" cy="5" r="2" />
  </>
);

const pata: Desenho = () => (
  <>
    <ellipse cx="7" cy="9" rx="1.9" ry="2.4" />
    <ellipse cx="12" cy="7" rx="1.9" ry="2.6" />
    <ellipse cx="17" cy="9" rx="1.9" ry="2.4" />
    <path d="M12 12.5c3.2 0 5 2 5 4a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3c0-2 1.8-4 5-4Z" />
  </>
);

/* Balança de dois pratos. A versão anterior ligava o topo aos pratos com
   linhas retas e o conjunto lia como guarda-sol. Os pratos agora são as
   duas conchas penduradas, que é a forma que se reconhece. */
const balanca: Desenho = () => (
  <>
    <path d="M12 3.2v17.6M7.5 20.8h9" />
    <path d="M3 7.2h18" />
    <path d="M6.5 7.4 3.2 14.2h6.6zM17.5 7.4l-3.3 6.8h6.6z" />
  </>
);

const calculadora: Desenho = () => (
  <>
    <rect x="4" y="2.5" width="16" height="19" rx="2" />
    <path d="M7.5 6.5h9v3h-9z" />
    <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" />
  </>
);

const casa: Desenho = () => (
  <>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 12v8h13v-8" />
    <path d="M10 20v-5h4v5" />
  </>
);

const comprimido: Desenho = () => (
  <>
    <rect x="2.5" y="8.5" width="19" height="7" rx="3.5" />
    <path d="M12 8.5v7" />
  </>
);

const cama: Desenho = () => (
  <>
    <path d="M3 19v-9M3 13h18v6M21 19v-6" />
    <path d="M7 13v-3h6a3 3 0 0 1 3 3" />
    <circle cx="7" cy="8.5" r="0.8" fill="currentColor" stroke="none" />
  </>
);

const microscopio: Desenho = () => (
  <>
    <path d="M9 3.5h3.5v7H9z" />
    <path d="M10.7 10.5A5.5 5.5 0 0 1 16 16a5.4 5.4 0 0 1-1.2 3.4" />
    <path d="M5 20.5h14M7.5 20.5c0-2.5 1.5-4.5 3.5-5" />
  </>
);

/* Engrenagem. Dentes soltos em volta de um círculo leem como sol — o que
   faz virar engrenagem é o contorno fechado, com os dentes fazendo parte
   da própria borda. */
const engrenagem: Desenho = () => (
  <>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.1 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H10a1.6 1.6 0 0 0 1-1.5v-.2a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V10a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </>
);


/* ---- Beleza e bem-estar ---- */

const maos: Desenho = () => (
  <>
    <path d="M8.5 12.5V5.8a1.6 1.6 0 0 1 3.2 0v5.2" />
    <path d="M11.7 10.6V4.6a1.6 1.6 0 0 1 3.2 0v6.4" />
    <path d="M14.9 11V7.2a1.6 1.6 0 0 1 3.2 0v7.3a6 6 0 0 1-6 6h-1a5 5 0 0 1-3.6-1.6l-3-3.4a1.7 1.7 0 0 1 2.4-2.4l2.6 2" />
  </>
);

const halter: Desenho = () => (
  <>
    <path d="M2.5 9.5v5M5.5 7.5v9M18.5 7.5v9M21.5 9.5v5" />
    <path d="M5.5 12h13" />
  </>
);

const maca: Desenho = () => (
  <>
    <path d="M12 8.5c-1-1-2.2-1.5-3.6-1.5C5.9 7 4 9.3 4 12.4 4 16 6.6 21 9.2 21c1.1 0 1.9-.6 2.8-.6s1.7.6 2.8.6c2.6 0 5.2-5 5.2-8.6C20 9.3 18.1 7 15.6 7c-1.4 0-2.6.5-3.6 1.5Z" />
    <path d="M12 8.5V6a2.5 2.5 0 0 1 2.5-2.5" />
  </>
);

const mente: Desenho = () => (
  <>
    <path d="M15.5 20.5v-3a4 4 0 0 0 3.5-4c1.2-.6 2-1.8 2-3.2 0-1.6-1-3-2.5-3.5A4.5 4.5 0 0 0 14 3a4 4 0 0 0-3.2 1.6A3.6 3.6 0 0 0 8 3.6 3.6 3.6 0 0 0 4.4 7c-1 .7-1.6 1.9-1.6 3.2 0 1.5.8 2.8 2.1 3.4a3.8 3.8 0 0 0 3.6 3.9v3" />
  </>
);

/* Pente, e não navalha. A navalha desenhada de perfil vira um traço com
   um cabo — no tamanho do cartão lia como caneta. O pente tem uma silhueta
   que não se confunde com nada, e distingue barbeiro de cabeleireiro
   (tesoura) sem os dois disputarem o mesmo desenho. */
const navalha: Desenho = () => (
  <>
    <rect x="2.5" y="6.5" width="19" height="4.5" rx="1.2" />
    <path d="M6 11v6.5M9.5 11v6.5M13 11v6.5M16.5 11v6.5M20 11v4" />
  </>
);

const batom: Desenho = () => (
  <>
    <rect x="8.5" y="12" width="7" height="9" rx="1" />
    <path d="M9.8 12V6.2c0-1 .8-1.9 1.9-1.9h.6c1 0 1.9.9 1.9 1.9V12" />
    <path d="M9.8 7.5h4.4" />
  </>
);

const brilho: Desenho = () => (
  <>
    <path d="M12 2.5 13.8 8l5.7 1.8-5.7 1.9L12 17.5l-1.8-5.8L4.5 9.8 10.2 8Z" />
    <path d="M18.5 15.5 19.4 18l2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9Z" />
  </>
);

/* ---- Ensino e comunicação ---- */

const nota: Desenho = () => (
  <>
    <circle cx="6.5" cy="18" r="2.8" />
    <circle cx="17.5" cy="15.5" r="2.8" />
    <path d="M9.3 18V6.5l11-2.2v11.2" />
    <path d="M9.3 9.5l11-2.2" />
  </>
);

const balao: Desenho = () => (
  <path d="M20.5 12.5a7.5 7.5 0 0 1-8 7.4l-5.6 2.2 1.4-4.2A7.5 7.5 0 1 1 20.5 12.5Z" />
);

const microfone: Desenho = () => (
  <>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <path d="M12 18v3.5M8.5 21.5h7" />
  </>
);

const fone: Desenho = () => (
  <>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="2.5" y="13.5" width="4.5" height="7" rx="2" />
    <rect x="17" y="13.5" width="4.5" height="7" rx="2" />
  </>
);

/* ---- Casa: limpeza, cuidado, jardim ---- */

const vassoura: Desenho = () => (
  <>
    <path d="M16.5 2.5 11 8" />
    <path d="M13 10.5 8 5.5 4 13.5c-.6 1.2-.3 2.7.7 3.7l2.6 2.6c1 1 2.5 1.3 3.7.7Z" />
    <path d="M6.2 12.3 11.5 17.6" />
  </>
);

const ferroDePassar: Desenho = () => (
  <>
    <path d="M3 15.5c0-4.4 3.6-8 8-8h9v3.6c0 2.4-2 4.4-4.4 4.4Z" />
    <path d="M3 18.5h15" />
    <path d="M14 7.5V6a2 2 0 0 1 2-2h1.5" />
  </>
);

const bebe: Desenho = () => (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9 10.5h.01M15 10.5h.01" />
    <path d="M9.5 15c.8.8 1.6 1.2 2.5 1.2s1.7-.4 2.5-1.2" />
  </>
);

const cuidado: Desenho = () => (
  <>
    <path d="M12 20.5s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 3.3c0 5-7.5 9.6-7.5 9.6Z" />
  </>
);

const planta: Desenho = () => (
  <>
    <path d="M12 21v-9" />
    <path d="M12 12C12 8.5 9 5.5 5 5.5c0 4 3 6.5 7 6.5Z" />
    <path d="M12 14c0-3 2.6-5.5 6-5.5 0 3.4-2.6 5.5-6 5.5Z" />
  </>
);

const onda: Desenho = () => (
  <>
    <path d="M2.5 8.5c2.4 0 2.4 2 4.8 2s2.4-2 4.7-2 2.4 2 4.8 2 2.4-2 4.7-2" />
    <path d="M2.5 14c2.4 0 2.4 2 4.8 2s2.4-2 4.7-2 2.4 2 4.8 2 2.4-2 4.7-2" />
    <path d="M2.5 19.5c2.4 0 2.4 2 4.8 2" />
  </>
);

const spray: Desenho = () => (
  <>
    <rect x="7" y="8" width="8" height="13" rx="2" />
    <path d="M9 8V5.5h4V8" />
    <path d="M15 6h2.5M15 9h4M15 12h2.5" />
  </>
);

/* ---- Técnica e conserto ---- */

const monitor: Desenho = () => (
  <>
    <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
    <path d="M9 20.5h6M12 16.5v4" />
  </>
);

const celular: Desenho = () => (
  <>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M10.5 5.5h3M11 18.5h2" />
  </>
);

const floco: Desenho = () => (
  <>
    <path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8" />
    <path d="M9.5 5 12 7.5 14.5 5M9.5 19 12 16.5l2.5 2.5" />
  </>
);

const pneu: Desenho = () => (
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.3" />
    <path d="M12 3v5.7M12 15.3V21M3 12h5.7M15.3 12H21" />
  </>
);

const moto: Desenho = () => (
  <>
    <circle cx="5" cy="17" r="3.3" />
    <circle cx="19" cy="17" r="3.3" />
    <path d="M8.3 17h4l3.2-6h-4" />
    <path d="M14 6h3l2.6 11" />
  </>
);

/* Serrote. Dentes pendurados de uma barra reta leem como rastelo; o que
   faz virar serra é o zigue-zague na própria borda de baixo da lâmina. */
const serra: Desenho = () => (
  <>
    <path d="M3.5 6.5h11.2l4.3 5H3.5Z" />
    <path d="m3.5 11.5 1.6 2.2 1.6-2.2 1.6 2.2 1.6-2.2 1.6 2.2 1.6-2.2 1.6 2.2 1.6-2.2" />
    <path d="M15.5 6.5 20.5 2.8" />
  </>
);

const janela: Desenho = () => (
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
    <path d="M12 3.5v17M3.5 12h17" />
  </>
);

const chaveDeFenda: Desenho = () => (
  <>
    <path d="M14 10 4.6 19.4a1.9 1.9 0 0 0 2.7 2.7L16.7 12.7" />
    <path d="M13.2 5.6 18.4 10.8 21 8.2c.8-.8.8-2 0-2.8l-2.4-2.4a2 2 0 0 0-2.8 0Z" />
  </>
);

/* ---- Comida, comércio, imagem ---- */

const talheres: Desenho = () => (
  <>
    <path d="M6 2.5v8a2.5 2.5 0 0 0 5 0v-8M8.5 10.5V21.5" />
    <path d="M17.5 2.5c-1.7 0-3 2-3 5s1.3 4 3 4v10" />
  </>
);

const pao: Desenho = () => (
  <>
    <path d="M4 14.5c0-4.4 3.6-8 8-8s8 3.6 8 8v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
    <path d="M9.5 7.5 8 12M14.5 7.5 16 12" />
  </>
);

const taca: Desenho = () => (
  <>
    <path d="M6.5 3.5h11l-1 6a4.5 4.5 0 0 1-9 0Z" />
    <path d="M12 14v6M8.5 20.5h7" />
  </>
);

const balaoDeFesta: Desenho = () => (
  <>
    <path d="M12 15c3.3 0 6-3 6-6.5S15.3 2 12 2 6 5 6 8.5 8.7 15 12 15Z" />
    <path d="M12 15v2M10.5 17h3l-1.5 5Z" />
  </>
);

const claquete: Desenho = () => (
  <>
    <rect x="2.5" y="9" width="19" height="11.5" rx="1.5" />
    <path d="M2.5 9 5 4l17 1.5-.5 3.5Z" />
    <path d="m8 4.6-1.8 4.2M13.9 5.3 12.1 9.5" />
  </>
);

const cabide: Desenho = () => (
  <>
    <path d="M12 8.5a2.5 2.5 0 1 1 2.5-2.5" />
    <path d="M12 8.5 3 15.5c-.8.6-.4 2 .7 2h16.6c1.1 0 1.5-1.4.7-2Z" />
  </>
);

const sapato: Desenho = () => (
  <>
    <path d="M2.5 17.5v-6h4l2.5 2.5h4.5c3 0 5 1.4 8 2.4v1.1a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2Z" />
    <path d="M6.5 11.5V9" />
  </>
);

const flor: Desenho = () => (
  <>
    <circle cx="12" cy="8.5" r="2.4" />
    <path d="M12 6.1a2.7 2.7 0 1 0-2.4 2.4M12 6.1a2.7 2.7 0 1 1 2.4 2.4M9.6 8.5a2.7 2.7 0 1 0 2.4 2.4M14.4 8.5a2.7 2.7 0 1 1-2.4 2.4" />
    <path d="M12 13v8.5M12 17c-2 0-3.5-1.2-4-2.5M12 19c2 0 3.5-1.2 4-2.5" />
  </>
);

const oculos: Desenho = () => (
  <>
    <circle cx="6" cy="13.5" r="3.5" />
    <circle cx="18" cy="13.5" r="3.5" />
    <path d="M9.5 13.5c.7-1 1.5-1.5 2.5-1.5s1.8.5 2.5 1.5" />
    <path d="M2.5 12 4 8.5M21.5 12 20 8.5" />
  </>
);

const escudo: Desenho = () => (
  <path d="M12 21.5c4.7-1.6 7.5-5.6 7.5-10V5.2L12 2.5 4.5 5.2V11.5c0 4.4 2.8 8.4 7.5 10Z" />
);

const pincel: Desenho = () => (
  <>
    <path d="M13.5 4.5 19.5 10.5" />
    <path d="M17.8 2.6 21.4 6.2a1.5 1.5 0 0 1 0 2.1l-9.6 9.6-5.7-5.7 9.6-9.6a1.5 1.5 0 0 1 2.1 0Z" />
    <path d="M6.1 12.2 2.5 21.5l9.3-3.6" />
  </>
);

const orelha: Desenho = () => (
  <path d="M7 20.5c-1.5-1.6-1.5-3.4-1.5-5.5 0-1.6-.5-2.6-1-3.6A7.6 7.6 0 0 1 4 8a7 7 0 1 1 14 0c0 3.2-2.4 4.6-4 5.6-1.2.8-1.7 1.6-1.7 2.9a3.2 3.2 0 0 1-5.5 2.2Z" />
);

const cruzMedica: Desenho = () => (
  <>
    <rect x="2.5" y="6" width="19" height="13" rx="2" />
    <path d="M8.5 6V4.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V6" />
    <path d="M12 9.5v6M9 12.5h6" />
  </>
);

const curtida: Desenho = () => (
  <>
    <path d="M7 21.5V10l4.5-8a3 3 0 0 1 3 3v4h4.6a2.4 2.4 0 0 1 2.3 3l-1.7 7a2.4 2.4 0 0 1-2.3 1.9Z" />
    <rect x="2" y="10" width="5" height="11.5" rx="1.5" />
  </>
);

/* A marca neutra: para ofício sem desenho próprio.
   Nunca um ícone de outra profissão — massagista com tesoura não é falta
   de ícone, é informação errada, e errada é pior que ausente. */
const marca: Desenho = () => (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8.2v7.6M8.2 12h7.6" />
  </>
);

const DESENHOS: Record<string, Desenho> = {
  chave, chaveDePorta, raio, gota, parede, rolo, tesoura, gotaDeEsmalte, pulso, dente,
  livro, camera, bolo, carrinho, carro, caminhao, agulha, pata, balanca,
  calculadora, casa, comprimido, cama, microscopio, engrenagem,
  maos, halter, maca, mente, navalha, batom, brilho, nota, balao, microfone,
  fone, vassoura, ferroDePassar, bebe, cuidado, planta, onda, spray, monitor,
  celular, floco, pneu, moto, serra, janela, chaveDeFenda, talheres, pao,
  taca, balaoDeFesta, claquete, cabide, sapato, flor, oculos, escudo, pincel,
  orelha, cruzMedica, curtida, marca,
};

/**
 * Ofício → desenho.
 *
 * Só o que precisa de desenho próprio está aqui. O resto cai no ícone do
 * grupo (tabela abaixo), e isso é intencional: vinte e quatro desenhos bem
 * feitos valem mais que noventa desenhos parecidos, e o nome do ofício está
 * escrito ao lado — o ícone é para reconhecer de longe, não para adivinhar.
 */
const POR_OFICIO: Record<string, string> = {
  // Casa e obra
  "Encanador": "gota",
  "Eletricista": "raio",
  "Pedreiro": "parede",
  "Pintor": "rolo",
  "Marceneiro": "serra",
  "Serralheiro": "serra",
  "Vidraceiro": "janela",
  "Gesseiro": "parede",
  "Marido de aluguel": "chave",
  "Montador de móveis": "chaveDeFenda",
  "Chaveiro": "chaveDePorta",
  "Jardineiro": "planta",
  "Piscineiro": "onda",
  "Dedetizador": "spray",
  "Diarista": "vassoura",
  "Passadeira": "ferroDePassar",
  "Cuidador de idosos": "cuidado",
  "Babá": "bebe",

  // Técnica e conserto
  "Técnico em informática": "monitor",
  "Técnico em celulares": "celular",
  "Refrigeração e ar-condicionado": "floco",
  "Conserto de eletrodomésticos": "chaveDeFenda",
  "Mecânico": "carro",
  "Borracheiro": "pneu",
  "Lavagem de carros": "spray",
  "Funilaria e pintura automotiva": "carro",

  // Beleza e bem-estar
  "Cabeleireiro": "tesoura",
  "Barbeiro": "navalha",
  "Manicure": "gotaDeEsmalte",
  "Depilação": "brilho",
  "Maquiadora": "batom",
  "Estética e sobrancelhas": "brilho",
  "Massagista": "maos",
  "Personal trainer": "halter",
  "Nutricionista": "maca",
  "Fisioterapeuta": "pulso",
  "Psicólogo": "mente",

  // Ensino
  "Professor particular": "livro",
  "Professor de inglês": "balao",
  "Professor de música": "nota",
  "Reforço escolar": "livro",
  "Palestrante": "microfone",

  // Festas e imagem
  "Fotógrafo": "camera",
  "Filmagem": "claquete",
  "Confeiteira": "bolo",
  "Salgadeira": "pao",
  "Cozinheira": "talheres",
  "Buffet e festas": "taca",
  "DJ e som": "fone",
  "Decoração de festas": "balaoDeFesta",

  // Costura e artesanato
  "Costureira": "agulha",
  "Sapateiro": "sapato",
  "Tapeceiro": "cama",
  "Artesanato": "pincel",

  // Transporte
  "Frete e mudanças": "caminhao",
  "Motorista": "carro",
  "Motoboy": "moto",

  // Comércio e hospedagem
  "Hotel": "cama",
  "Pousada": "cama",
  "Restaurante": "talheres",
  "Lanchonete": "talheres",
  "Padaria": "pao",
  "Loja de roupas": "cabide",
  "Loja de calçados": "sapato",
  "Papelaria": "livro",
  "Material de construção": "parede",
  "Autopeças": "engrenagem",
  "Farmácia": "comprimido",
  "Pet shop": "pata",
  "Mercearia": "carrinho",
  "Floricultura": "flor",
  "Ótica": "oculos",

  // Saúde e exames
  "Laboratório de análises": "microscopio",
  "Clínica médica": "pulso",
  "Clínica odontológica": "dente",
  "Fonoaudiólogo": "orelha",
  "Terapeuta ocupacional": "maos",
  "Enfermagem em casa": "cruzMedica",
  "Exames de imagem": "microscopio",

  // Escritório e serviços
  "Contador": "calculadora",
  "Advogado": "balanca",
  "Corretor de imóveis": "casa",
  "Designer gráfico": "pincel",
  "Social media": "curtida",
  "Costura de uniformes": "agulha",
  "Segurança e portaria": "escudo",
  "Veterinário": "pata",
  "Banho e tosa": "pata",
};

/**
 * Sem herança de grupo, de propósito.
 *
 * A primeira versão fazia o ofício sem desenho próprio herdar o do grupo, e
 * isso produzia informação errada: "Beleza e bem-estar" é tesoura, então
 * massagista aparecia com uma tesoura. Ícone errado é pior que ícone
 * genérico — o genérico não diz nada, o errado diz outra coisa.
 *
 * Cada ofício da lista tem agora o seu. O que não tiver — serviço escrito à
 * mão por quem se cadastrou — cai numa marca neutra, que não promete
 * profissão nenhuma.
 */
function desenhoDe(categoria: string): Desenho {
  return DESENHOS[POR_OFICIO[categoria] ?? "marca"];
}

export function IconeDeServico({ categoria, tamanho = 26 }: { categoria: string; tamanho?: number }) {
  const Desenho = desenhoDe(categoria);
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
