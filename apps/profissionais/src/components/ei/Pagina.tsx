import type { ReactNode } from "react";

/**
 * O cabeçalho de página.
 *
 * ── POR QUE ELE ENCOLHEU ───────────────────────────────────────────────
 *
 * Ele era o cabeçalho de página do Notion, copiado ao pé da letra: migalha
 * ("Ei Itabirito / Vagas"), emoji de 2,6rem e título de 1,8rem, um embaixo
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
 * E a migalha prometia uma coisa que não existe: hierarquia. "Ei Itabirito
 * / Vagas" sugere que Vagas fica dentro de alguma coisa. Não fica — é uma
 * das quatro abas, irmã das outras três. Migalha em app de aba é enfeite
 * com cara de navegação.
 *
 * O que ficou: o título, num tamanho de app, e ao lado dele o lugar da
 * ação principal da tela. O resto do desenho não mudou — sem canto
 * redondo, sem cartão, hierarquia por tipografia.
 */
export function Pagina({
  titulo,
  foto,
  acao,
  children,
}: {
  titulo: string;
  /**
   * Um retrato no lugar de nada, para a página que É uma pessoa. Continua
   * existindo porque numa tela de perfil o rosto identifica melhor que
   * qualquer palavra — mas agora em 32px, ao lado do título, e não como
   * um ícone de 62px numa linha só dele.
   */
  foto?: string | null;
  /**
   * A ação principal desta tela, à direita do título.
   *
   * Existe porque o app não tinha onde pôr a ação de uma tela inteira, e
   * ela acabava no meio do conteúdo ou em nenhum lugar: o painel da
   * empresa não tinha o botão de publicar vaga em canto nenhum, que é a
   * única coisa que uma empresa vai lá fazer.
   */
  acao?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <div className="ei-cabeca">
        {foto && (
          <span className="ei-cabeca-foto" aria-hidden="true">
            <img src={foto} alt="" />
          </span>
        )}
        <h1 className="ei-cabeca-titulo">{titulo}</h1>
        {acao && <div className="ei-cabeca-acao">{acao}</div>}
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
