import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

/**
 * A barra de topo da tela.
 *
 * ── POR QUE ELE ENCOLHEU ───────────────────────────────────────────────
 *
 * Ele era o cabeçalho de página do Notion, copiado ao pé da letra: migalha
 * ("Ei Emprego / Vagas"), emoji de 2,6rem e título de 1,8rem, um embaixo
 * do outro. Medido no celular, custava 235px antes de qualquer conteúdo —
 * a primeira vaga começava a 45% da altura da tela.
 *
 * O problema não era o gosto, era a superfície. O Notion é um lugar onde a
 * pessoa CRIA páginas, e o cabeçalho dele é a página se apresentando: o
 * ícone e o título são coisas que o próprio usuário escolheu. Aqui não há
 * página nenhuma para criar. São quatro telas fixas, com uma barra embaixo
 * que já diz o nome de cada uma — o app repetia "Vagas" três vezes na
 * mesma tela (migalha, título e aba acesa) e gastava meia dobra nisso.
 *
 * E a migalha prometia uma coisa que não existe: hierarquia. "Ei Emprego
 * / Vagas" sugere que Vagas fica dentro de alguma coisa. Não fica — é uma
 * das quatro abas, irmã das outras três. Migalha em app de aba é enfeite
 * com cara de navegação.
 *
 * O que ficou: o título, num tamanho de app, e ao lado dele o lugar da
 * ação principal da tela. O resto do desenho não mudou — sem canto
 * redondo, sem cartão, hierarquia por tipografia.
 *
 * ── SEGUNDA VOLTA: A BARRA DE TOPO ────────────────────────────────────
 *
 * A dona mandou prints do app da Conta Azul e pediu a ORGANIZAÇÃO dele,
 * mantendo o preto e branco daqui. A primeira coisa que os cinco prints
 * têm em comum é esta: TODA tela abre com uma barra de altura fixa, e
 * dentro dela, sempre na mesma ordem — seta de voltar à esquerda, título
 * ao lado dela, ações como ícones à direita.
 *
 *     ← Fluxo de caixa diário
 *     ← Solicitação de pagamento
 *     ← Orçamentos e vendas          [lista] [lupa] [+]
 *
 * O que isso resolve aqui: a volta deixa de ser uma linha SOLTA acima do
 * título (era assim na tela da vaga, gastando uma fileira inteira para
 * uma seta) e passa a morar dentro da barra, onde o polegar já procura.
 *
 * ── TERCEIRA VOLTA: A SETA EM TODA TELA ────────────────────────────────
 *
 * A regra acima era "seta só nas telas de detalhe", porque as quatro abas
 * da barra de baixo são irmãs e não têm de onde voltar. Bonito no papel; a
 * dona usou o app e pediu o contrário: "colocar voltar a tela anterior em
 * todas as páginas."
 *
 * Ela tem razão, e o erro do raciocínio anterior foi confundir HIERARQUIA
 * com HISTÓRICO. A seta não promete que esta tela está dentro de outra —
 * promete desfazer o último toque. E o último toque existe em qualquer
 * tela: quem chegou nas Vagas vindo do Perfil quer voltar ao Perfil.
 *
 * Então: quem passa `voltar` continua indo para aquele endereço fixo (é o
 * certo para tela de detalhe, que pode ter sido aberta por um link de
 * fora, sem histórico nenhum). Quem não passa ganha a seta que desfaz o
 * último passo do navegador — e ela some sozinha quando não há passo
 * nenhum para desfazer, que é o caso de quem abriu o app direto naquele
 * endereço. Seta que não leva a lugar nenhum é pior que seta nenhuma.
 */
export function Pagina({
  titulo,
  voltar,
  foto,
  acao,
  children,
}: {
  titulo: string;
  /**
   * Para onde a seta de voltar leva. Só as telas de DETALHE têm — as
   * quatro abas da barra de baixo são irmãs, não têm de onde voltar.
   */
  voltar?: string;
  /**
   * Um retrato no lugar de nada, para a página que É uma pessoa. Em 30px,
   * dentro da barra: identifica sem virar capa.
   */
  foto?: string | null;
  /** A ação principal desta tela, à direita do título. */
  acao?: ReactNode;
  children?: ReactNode;
}) {
  const navegar = useNavigate();
  /* `history.length > 1` responde "há um passo para desfazer?". Numa aba
     aberta direto no endereço da tela, ele é 1 e a seta não aparece. */
  const temHistorico = typeof window !== "undefined" && window.history.length > 1;
  const seta = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );

  return (
    <>
      <div className="ei-barra">
        {!voltar && temHistorico && (
          <button
            type="button"
            className="ei-barra-voltar"
            aria-label="Voltar"
            onClick={() => navegar(-1)}
          >
            {seta}
          </button>
        )}
        {voltar && (
          <Link to={voltar} className="ei-barra-voltar" aria-label="Voltar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
        )}
        {foto && (
          <span className="ei-barra-foto" aria-hidden="true">
            <img src={foto} alt="" />
          </span>
        )}
        <h1 className="ei-barra-titulo">{titulo}</h1>
        {acao && <div className="ei-barra-acao">{acao}</div>}
      </div>

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
 * O callout: retângulo tingido, ícone à esquerda, texto à direita.
 *
 * O emoji saiu daqui pelo mesmo motivo que saiu do cabeçalho — ver
 * `IconesInicio`: o mesmo código vira um desenho diferente em cada
 * aparelho, e ao lado de ícones de traço ele denuncia que as duas coisas
 * foram feitas em momentos diferentes. Agora recebe um ícone desenhado.
 */
export function Callout({
  icone,
  atencao = false,
  children,
}: {
  icone?: ReactNode;
  /** Um fio na lateral, para o que trava alguma coisa. Sem cor de fundo. */
  atencao?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={atencao ? "ei-callout ei-callout-atencao" : "ei-callout"}>
      {icone && (
        <span className="ei-callout-icone" aria-hidden="true">
          {icone}
        </span>
      )}
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
