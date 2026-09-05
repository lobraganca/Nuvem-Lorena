import { useState } from "react";
import { BottomSheet } from "../BottomSheet";
import { guardarCidade, nomeDaCidade, TODAS_AS_CIDADES } from "../../lib/cidadeEscolhida";

/**
 * O botão que diz em que cidade a pessoa está olhando.
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "o app pode não ter só a abrangência em Itabirito... criar um
 * filtro para a pessoa escolher a cidade (de acordo com as que tem
 * cadastradas) em algum lugar do app."
 *
 * ── Por que um botão com o nome da cidade, e não uma fileira de chips ─
 *
 * A fileira de chips é o que o banco de vagas já fazia, e ela tem dois
 * problemas quando as cidades passam de duas: ocupa uma faixa inteira da
 * tela acima da lista, e não diz onde a pessoa ESTÁ quando o chip escolhido
 * rolou para fora. Um botão único responde "Itabirito ▾" o tempo todo, no
 * mesmo lugar, e some do caminho.
 *
 * É a mesma peça nas duas listas de propósito: quem aprendeu a trocar de
 * cidade no banco de vagas não precisa aprender de novo no de talentos.
 *
 * ── As cidades vêm do que existe, não de uma lista fixa ───────────────
 *
 * `cidades` é montada pela tela a partir dos dados carregados, com a
 * contagem. Uma opção "Belo Horizonte" numa semana sem ninguém de Belo
 * Horizonte é um botão que só sabe devolver tela vazia — e tela vazia
 * depois de um toque parece defeito do app, não ausência de gente.
 */
export function SeletorDeCidade({
  cidade,
  cidades,
  aoEscolher,
  rotuloDeTodas = "Todas as cidades",
}: {
  /** A cidade atual. String vazia = todas. */
  cidade: string;
  /** As cidades que existem nos dados, com quantos há em cada uma. */
  cidades: [string, number][];
  aoEscolher: (cidade: string) => void;
  rotuloDeTodas?: string;
}) {
  const [aberto, setAberto] = useState(false);

  /* Com uma cidade só, o seletor seria um botão que não muda nada — e
     ainda ocuparia lugar acima da lista. Ele aparece quando passa a haver
     escolha, que é exatamente quando o app deixa de ser de uma cidade só. */
  if (cidades.length <= 1 && !cidade) return null;
  if (cidades.length <= 1 && cidades[0]?.[0] === cidade) return null;

  const total = cidades.reduce((s, [, n]) => s + n, 0);

  function escolher(nova: string) {
    guardarCidade(nova);
    aoEscolher(nova);
    setAberto(false);
  }

  return (
    <>
      <button
        type="button"
        className="ei-cidade-botao"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
      >
        <span className="ei-cidade-alfinete" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z" />
            <circle cx="12" cy="10" r="2.6" />
          </svg>
        </span>
        {nomeDaCidade(cidade) === "Todas as cidades" ? rotuloDeTodas : cidade}
        <span className="ei-cidade-seta" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {aberto && (
        <BottomSheet title="Ver de qual cidade?" onClose={() => setAberto(false)}>
          <div className="ei-cidade-lista">
            {/* "Todas" primeiro: numa região onde muita gente pega ônibus
                para a cidade vizinha, ela é a escolha mais útil e a menos
                óbvia — no fim da lista, ninguém a encontraria. */}
            <button
              type="button"
              className={cidade === TODAS_AS_CIDADES ? "ei-cidade-opcao ativa" : "ei-cidade-opcao"}
              onClick={() => escolher(TODAS_AS_CIDADES)}
            >
              <span>{rotuloDeTodas}</span>
              <span className="ei-cidade-conta">{total}</span>
            </button>
            {cidades.map(([c, quantos]) => (
              <button
                key={c}
                type="button"
                className={cidade === c ? "ei-cidade-opcao ativa" : "ei-cidade-opcao"}
                onClick={() => escolher(c)}
              >
                <span>{c}</span>
                <span className="ei-cidade-conta">{quantos}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
