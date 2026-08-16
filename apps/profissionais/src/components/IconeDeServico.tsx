import type { ReactNode } from "react";
import { GRUPOS_DE_SERVICOS } from "../types/domain";

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

const DESENHOS: Record<string, Desenho> = {
  chave, chaveDePorta, raio, gota, parede, rolo, tesoura, gotaDeEsmalte, pulso, dente,
  livro, camera, bolo, carrinho, carro, caminhao, agulha, pata, balanca,
  calculadora, casa, comprimido, cama, microscopio, engrenagem,
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
  "Eletricista": "raio",
  "Encanador": "gota",
  "Pedreiro": "parede",
  "Material de construção": "parede",
  "Pintor": "rolo",
  "Jardineiro": "gota",
  "Chaveiro": "chaveDePorta",

  "Mecânico": "carro",
  "Borracheiro": "carro",
  "Lavagem de carros": "carro",
  "Funilaria e pintura automotiva": "carro",
  "Autopeças": "engrenagem",
  "Refrigeração e ar-condicionado": "engrenagem",
  "Conserto de eletrodomésticos": "engrenagem",

  "Cabeleireiro": "tesoura",
  "Barbeiro": "tesoura",
  "Manicure": "gotaDeEsmalte",
  "Maquiadora": "gotaDeEsmalte",
  "Fisioterapeuta": "pulso",
  "Nutricionista": "pulso",
  "Psicólogo": "pulso",
  "Personal trainer": "pulso",

  "Clínica odontológica": "dente",
  "Clínica médica": "pulso",
  "Laboratório de análises": "microscopio",
  "Exames de imagem": "microscopio",
  "Enfermagem em casa": "pulso",
  "Farmácia": "comprimido",
  "Ótica": "microscopio",

  "Fotógrafo": "camera",
  "Filmagem": "camera",
  "Confeiteira": "bolo",
  "Salgadeira": "bolo",
  "Cozinheira": "bolo",
  "Buffet e festas": "bolo",
  "Padaria": "bolo",
  "Restaurante": "bolo",
  "Lanchonete": "bolo",

  "Costureira": "agulha",
  "Costura de uniformes": "agulha",
  "Sapateiro": "agulha",
  "Tapeceiro": "agulha",
  "Artesanato": "agulha",

  "Frete e mudanças": "caminhao",
  "Motorista": "carro",
  "Motoboy": "caminhao",

  "Hotel": "cama",
  "Pousada": "cama",
  "Veterinário": "pata",
  "Pet shop": "pata",
  "Banho e tosa": "pata",

  "Advogado": "balanca",
  "Contador": "calculadora",
  "Corretor de imóveis": "casa",

  "Professor particular": "livro",
  "Professor de inglês": "livro",
  "Professor de música": "livro",
  "Reforço escolar": "livro",
  "Palestrante": "livro",
};

/** Grupo → desenho, para todo ofício sem entrada própria. */
const POR_GRUPO: Record<string, string> = {
  "Casa e obra": "chave",
  "Técnica e conserto": "engrenagem",
  "Beleza e bem-estar": "tesoura",
  "Ensino": "livro",
  "Festas e imagem": "camera",
  "Costura e artesanato": "agulha",
  "Transporte": "caminhao",
  "Comércio e hospedagem": "carrinho",
  "Saúde e exames": "pulso",
  "Escritório e serviços": "calculadora",
};

const GRUPO_DE = new Map<string, string>();
for (const g of GRUPOS_DE_SERVICOS) {
  for (const item of g.itens as readonly string[]) GRUPO_DE.set(item, g.grupo);
}

function desenhoDe(categoria: string): Desenho {
  const porOficio = POR_OFICIO[categoria];
  if (porOficio) return DESENHOS[porOficio];
  const grupo = GRUPO_DE.get(categoria);
  const porGrupo = grupo ? POR_GRUPO[grupo] : undefined;
  /* Ofício escrito à mão por quem se cadastrou não pertence a grupo nenhum
     e cai na chave inglesa — o desenho mais próximo de "serviço" sem
     prometer qual. */
  return DESENHOS[porGrupo ?? "chave"];
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
