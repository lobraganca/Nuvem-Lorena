/**
 * As telas de boas-vindas do primeiro acesso.
 *
 * ── O QUE ELAS RESOLVEM ────────────────────────────────────────────────
 *
 * A dona mandou as quatro do "Conta Azul De Bolso" e pediu: "no primeiro
 * acesso ter telas de boas vindas".
 *
 * O problema real que elas resolvem aqui é específico: quem abre o Ei pela
 * primeira vez cai numa pergunta — "de que lado você está?" — sem saber o
 * que o app faz. Quem procura trabalho não tem como adivinhar que a vaga
 * vai CHEGAR nele, em vez de ele procurar; e uma empresa não tem como
 * saber que o aviso é disparado para quem tem a função, e não um mural
 * onde ela pendura papel e espera.
 *
 * Por isso cada tela conta UMA coisa que o app faz, com as palavras de
 * quem vai usar. Nenhuma delas fala de "plataforma", "conectar" ou
 * "soluções".
 *
 * ── TRÊS REGRAS QUE VÊM DO MODELO ──────────────────────────────────────
 *
 * 1. Uma frase por tela. O modelo tem título de uma palavra e uma linha de
 *    apoio; mais que isso ninguém lê em pé no ponto de ônibus.
 * 2. Os pontinhos mostram onde está e quanto falta — e são só indicação,
 *    não botão: em tela de 390px eles ficam pequenos demais para o dedo, e
 *    o gesto natural é arrastar.
 * 3. Um botão só, embaixo, sempre no mesmo lugar. Ele PULA para o app; a
 *    pessoa não é obrigada a ver as quatro.
 *
 * ── APARECE UMA VEZ SÓ ─────────────────────────────────────────────────
 *
 * A marca fica no armazenamento do próprio aparelho, e não na conta: elas
 * são para o primeiro acesso ao APP, e quem ainda nem tem conta é
 * justamente quem precisa delas. Se o armazenamento recusar (aba anônima),
 * o `catch` deixa passar — mostrar duas vezes é chato, travar a entrada é
 * grave.
 */
import { useState } from "react";

const CHAVE = "ei-boas-vindas-vistas";

export function jaViuAsBoasVindas(): boolean {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    /* Sem armazenamento, trata como visto: melhor não mostrar do que
       mostrar em toda abertura. */
    return true;
  }
}

function marcarComoVistas() {
  try {
    localStorage.setItem(CHAVE, "1");
  } catch {
    /* segue sem lembrar */
  }
}

/* As ilustrações são desenhadas aqui, em SVG, e não são imagens.
   ─────────────────────────────────────────────────────────────
   Duas razões práticas: não há banco de ilustração neste projeto, e
   quatro PNGs custariam uns 400 KB no primeiro carregamento — que é
   exatamente o momento em que a pessoa está decidindo se o app presta.
   Em SVG elas pesam nada e acompanham a cor da marca. */
function Blob({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 200 200" className="ei-bv-arte" aria-hidden="true">
      <path
        d="M100 12c38 0 76 26 82 62 6 36-20 74-52 92-32 18-70 16-92-8C16 134 8 96 18 64 28 32 62 12 100 12z"
        fill="rgba(255,255,255,.18)"
      />
      {children}
    </svg>
  );
}

const TELAS = [
  {
    titulo: "Perto de casa",
    frase: "Vagas e serviços de Itabirito. Não do Brasil inteiro.",
    arte: (
      <Blob>
        <path
          d="M62 108l38-34 38 34v42a6 6 0 01-6 6h-24v-30h-16v30H68a6 6 0 01-6-6z"
          fill="#fff"
        />
        <circle cx="100" cy="66" r="7" fill="#f7a64a" />
      </Blob>
    ),
  },
  {
    titulo: "Sem currículo",
    frase: "Diga o que você faz. A vaga chega até você.",
    arte: (
      <Blob>
        <rect x="58" y="60" width="84" height="86" rx="10" fill="#fff" />
        <rect x="72" y="82" width="56" height="8" rx="4" fill="#0a72c4" />
        <rect x="72" y="100" width="40" height="8" rx="4" fill="#bcd9f2" />
        <rect x="72" y="118" width="48" height="8" rx="4" fill="#bcd9f2" />
        <circle cx="140" cy="64" r="12" fill="#f7a64a" />
      </Blob>
    ),
  },
  {
    titulo: "Quem contrata te acha",
    frase: "A empresa fala com você pelo telefone que você confirmou.",
    arte: (
      <Blob>
        <rect x="74" y="48" width="52" height="104" rx="12" fill="#fff" />
        <rect x="86" y="66" width="28" height="6" rx="3" fill="#bcd9f2" />
        <path
          d="M88 92h24a6 6 0 016 6v18a6 6 0 01-6 6H98l-10 8v-8a6 6 0 01-6-6V98a6 6 0 016-6z"
          fill="#0a72c4"
        />
        <circle cx="132" cy="140" r="10" fill="#f7a64a" />
      </Blob>
    ),
  },
  {
    titulo: "De graça",
    frase: "Procurar trabalho e ser encontrado não custa nada.",
    arte: (
      <Blob>
        <circle cx="100" cy="100" r="42" fill="#fff" />
        <path
          d="M84 100l12 12 22-24"
          fill="none"
          stroke="#0a72c4"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="146" cy="62" r="9" fill="#f7a64a" />
      </Blob>
    ),
  },
];

export function BoasVindas({ aoTerminar }: { aoTerminar: () => void }) {
  const [i, setI] = useState(0);
  const tela = TELAS[i];
  const ultima = i === TELAS.length - 1;

  function terminar() {
    marcarComoVistas();
    aoTerminar();
  }

  /* Arrastar de um lado para o outro, que é como se usa carrossel no
     celular. Guardo só o X do começo: velocidade e direção saem da
     diferença, e 40px de distância mínima evita que um toque trêmulo
     conte como gesto. */
  const [inicioX, setInicioX] = useState<number | null>(null);

  return (
    <div
      className="ei-bv"
      role="dialog"
      aria-modal="true"
      aria-label="Boas-vindas ao Ei Itabirito"
      onTouchStart={(e) => setInicioX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (inicioX === null) return;
        const dif = e.changedTouches[0].clientX - inicioX;
        if (dif < -40 && !ultima) setI(i + 1);
        if (dif > 40 && i > 0) setI(i - 1);
        setInicioX(null);
      }}
    >
      {/* ── O CARTÃO NO MEIO, E NÃO A TELA INTEIRA — 02/09 ──────────────
          A dona: "a demonstração de entrada está ocupando a tela toda.
          Preciso que seja mais no meio e menor."

          Era uma tela cheia de azul: quatro delas, uma depois da outra,
          antes de o app aparecer. Ocupando tudo, a apresentação parece o
          app — e quem abre pela primeira vez fica sem ver que existe
          alguma coisa atrás dela.

          Agora é um cartão centrado sobre o app esmaecido: continua sendo
          a única coisa em que se pode tocar (o `aria-modal` e o fundo
          escuro dizem isso), mas dá para ver que ela está POR CIMA de
          alguma coisa — e "Pular" deixa de ser um salto no escuro. */}
      <div className="ei-bv-cartao">
      <div className="ei-bv-meio">
        {tela.arte}
        <h1 className="ei-bv-titulo">{tela.titulo}</h1>
        <p className="ei-bv-frase">{tela.frase}</p>
      </div>

      <div className="ei-bv-pontos" aria-hidden="true">
        {TELAS.map((t, n) => (
          <span key={t.titulo} className={n === i ? "ei-bv-ponto aceso" : "ei-bv-ponto"} />
        ))}
      </div>

      <div className="ei-bv-pe">
        <button type="button" className="ei-bv-btn" onClick={ultima ? terminar : () => setI(i + 1)}>
          {ultima ? "Começar" : "Continuar"}
        </button>
        {/* Pular fica sempre à vista, e é um link: quem já sabe o que o app
            faz não deve ter que tocar quatro vezes para entrar. */}
        {!ultima && (
          <button type="button" className="ei-bv-pular" onClick={terminar}>
            Pular
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
