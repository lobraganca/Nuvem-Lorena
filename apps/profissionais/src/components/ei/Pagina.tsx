import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * O cabeçalho de página do Notion.
 *
 * Migalha em cinza miúdo, ícone de emoji grande, título enorme embaixo
 * dele. É a assinatura visual do Notion — o que se reconhece antes de ler
 * qualquer palavra — e faltava.
 *
 * Está aqui, e não copiado em cada tela, porque quatro telas usam o mesmo
 * cabeçalho e a quinta que fosse escrita à mão sairia diferente. Foi assim
 * que o app acabou com três tamanhos de título ao mesmo tempo na versão
 * anterior.
 */
export function Pagina({
  icone,
  foto,
  titulo,
  ondeEstou,
  children,
}: {
  /** O emoji da página. No Notion o ícone de página é emoji, e é literal. */
  icone: string;
  /**
   * Uma imagem no lugar do emoji — o Notion também aceita isso, e numa
   * página que É uma pessoa o rosto dela vale mais que um bonequinho azul
   * genérico. Cai no emoji sozinho quando não há foto.
   */
  foto?: string | null;
  titulo: string;
  /** A migalha: "Ei Itabirito / Vagas". A última parte é a página atual. */
  ondeEstou?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <div className="ei-migalha">
        {/* A marca leva ao começo, como o nome do espaço de trabalho na
            migalha do Notion. */}
        <Link to="/">Ei Itabirito</Link>
        <span aria-hidden="true">/</span>
        <span className="ei-migalha-atual">{ondeEstou ?? titulo}</span>
      </div>

      {foto ? (
        <span className="ei-icone-pagina ei-icone-foto" aria-hidden="true">
          <img src={foto} alt="" />
        </span>
      ) : (
        <span className="ei-icone-pagina" aria-hidden="true">
          {icone}
        </span>
      )}

      <h1 className="ei-titulo-g">{titulo}</h1>

      {children}
    </>
  );
}

/**
 * Uma propriedade da página: rótulo à esquerda, valor à direita.
 *
 * É como o Notion mostra o estado de uma página ("Status: Em andamento").
 * Aqui serve para o que é dado de cadastro — plano, telefone, cidade — que
 * antes ocupava um cartão inteiro com número grande, dando a um dado de
 * ficha o peso de uma manchete.
 */
export function Prop({
  rotulo,
  children,
}: {
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <div className="ei-prop">
      <span className="ei-prop-rotulo">{rotulo}</span>
      <span className="ei-prop-valor">{children}</span>
    </div>
  );
}

/**
 * O callout: retângulo tingido, emoji à esquerda, texto à direita.
 *
 * O bloco mais reconhecível do Notion, e o formato certo para o que
 * precisa ser lido antes do resto. Substituiu cartões que gastavam
 * título, tarja, parágrafo e botão largo para dizer uma frase.
 */
export function Callout({
  emoji,
  atencao = false,
  children,
}: {
  emoji: string;
  /** Um fio na lateral, para o que trava alguma coisa. Sem cor de fundo. */
  atencao?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={atencao ? "ei-callout ei-callout-atencao" : "ei-callout"}>
      <span className="ei-callout-emoji" aria-hidden="true">
        {emoji}
      </span>
      <span className="ei-callout-texto">{children}</span>
    </div>
  );
}

/**
 * As abas de visão de uma base de dados do Notion: texto, e a aberta
 * ganha um traço embaixo.
 *
 * `contagem` é opcional e sai em cinza ao lado do nome — o Notion mostra
 * assim, e numa lista de vagas saber quantas são antes de tocar é metade
 * da informação.
 */
export function Abas<T extends string>({
  valor,
  aoTrocar,
  opcoes,
}: {
  valor: T;
  aoTrocar: (v: T) => void;
  opcoes: { chave: T; rotulo: string; contagem?: number }[];
}) {
  return (
    <div className="ei-abas" role="tablist">
      {opcoes.map((o) => (
        <button
          key={o.chave}
          type="button"
          role="tab"
          aria-selected={valor === o.chave}
          className="ei-aba"
          onClick={() => aoTrocar(o.chave)}
        >
          {o.rotulo}
          {o.contagem !== undefined && <span className="ei-aba-conta">{o.contagem}</span>}
        </button>
      ))}
    </div>
  );
}
