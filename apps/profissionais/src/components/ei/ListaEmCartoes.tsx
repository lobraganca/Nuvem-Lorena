import { useState, type ReactNode } from "react";

/**
 * O padrão de "acrescentar item" do cadastro: preenche, salva, vira cartão.
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "tudo que tem que acrescentar no cadastro, como formação. Assim
 * que digita, salva e ele vira um card visualmente bonito. A pessoa tem
 * como excluir o que já inseriu ou adicionar outro. Fazer com tudo que tem
 * que cadastrar no app."
 *
 * ── O que havia, e por que cansava ─────────────────────────────────────
 *
 * Todo formulário ficava ABERTO, para sempre, um embaixo do outro. Três
 * experiências eram doze campos de texto abertos ao mesmo tempo, e a
 * pessoa não tinha como saber, olhando, o que já estava pronto e o que
 * faltava: tudo tem a mesma cara de "campo esperando ser preenchido".
 *
 * Cada lista repetia esse desenho por conta própria — experiências,
 * competências, formação e cursos —, e por isso cada uma tinha um detalhe
 * diferente do resto: um cabeçalho aqui, um espaçamento ali. Agora é um
 * componente só, e o que vale para um vale para todos.
 *
 * ── Como funciona ──────────────────────────────────────────────────────
 *
 * O que já foi preenchido aparece como CARTÃO, em texto: dá para ler a
 * lista inteira de relance. Cada cartão tem "Editar" e "Tirar". O
 * formulário só existe enquanto se acrescenta ou se corrige um item — um
 * de cada vez, nunca quatro abertos.
 *
 * ── Por que um de cada vez ─────────────────────────────────────────────
 *
 * Porque "Salvar" precisa querer dizer uma coisa só. Com dois formulários
 * abertos, o botão de um deles salva o outro junto pela metade — e é
 * exatamente o tipo de coisa que a pessoa descobre depois, olhando o
 * próprio cadastro publicado.
 *
 * ── O que este componente NÃO faz ──────────────────────────────────────
 *
 * Não fala com o banco. Ele mexe na lista que a página tem em memória e
 * chama `aoSalvar`, que é da página — as listas são gravadas em bloco
 * junto com o resto do cadastro, e gravar daqui por fora escreveria por
 * cima do que a tela ainda não mandou.
 */

export type ResumoDoCartao = {
  /** A linha forte do cartão. Nunca vazia — quem chama garante. */
  titulo: string;
  /** Linhas de apoio. As vazias são descartadas aqui mesmo. */
  linhas?: (string | null | undefined)[];
};

export function ListaEmCartoes<T>({
  itens,
  aoMudar,
  novoItem,
  resumo,
  temConteudo,
  formulario,
  nomeDoItem,
  rotuloAdicionar,
  aoSalvar,
  salvando = false,
  teto,
  vazio,
  semAdicionar = false,
}: {
  itens: T[];
  aoMudar: (novos: T[]) => void;
  /** Um item em branco, para o formulário de acrescentar. */
  novoItem: () => T;
  /** O que o cartão mostra depois de salvo. */
  resumo: (item: T) => ResumoDoCartao;
  /** Diz se dá para salvar. Item vazio não vira cartão. */
  temConteudo: (item: T) => boolean;
  /** Os campos, desenhados por quem chama. */
  formulario: (item: T, mudar: (campos: Partial<T>) => void) => ReactNode;
  /** "experiência", "competência" — usado nas frases desta tela. */
  nomeDoItem: string;
  rotuloAdicionar: string;
  /** Grava o cadastro inteiro. Vem da página. */
  aoSalvar?: () => void;
  salvando?: boolean;
  /** Máximo de itens, quando o banco tem limite. */
  teto?: number;
  /** Uma linha para quando não há nada ainda. */
  vazio?: string;
  /**
   * Esconde o botão "+ Acrescentar" deste componente.
   *
   * Existe para as competências, que já têm um caminho de acrescentar
   * melhor: as sugestões prontas ("Excel", "Caixa"…) e um campo sempre
   * aberto, que entram com um toque. Dois botões de acrescentar na mesma
   * seção fariam a pessoa escolher entre dois caminhos para a mesma coisa.
   */
  semAdicionar?: boolean;
}) {
  /* `null` = nenhum formulário aberto. `-1` = acrescentando. Qualquer
     outro número = corrigindo o item daquele índice. */
  const [aberto, setAberto] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState<T | null>(null);

  const mudar = (campos: Partial<T>) =>
    setRascunho((r) => (r === null ? r : { ...r, ...campos }));

  function abrirNovo() {
    setRascunho(novoItem());
    setAberto(-1);
  }

  function abrirEdicao(i: number) {
    setRascunho(itens[i]);
    setAberto(i);
  }

  function fechar() {
    setAberto(null);
    setRascunho(null);
  }

  function guardar() {
    if (rascunho === null || !temConteudo(rascunho)) return;
    aoMudar(
      aberto === -1
        ? [...itens, rascunho]
        : itens.map((x, j) => (j === aberto ? rascunho : x))
    );
    fechar();
    /* A gravação vem DEPOIS de fechar o formulário: assim o cartão novo
       já está na tela quando o "Salvando…" aparece, em vez de a pessoa
       ficar olhando um formulário aberto sem saber se entrou. */
    aoSalvar?.();
  }

  function tirar(i: number) {
    aoMudar(itens.filter((_, j) => j !== i));
    if (aberto === i) fechar();
    aoSalvar?.();
  }

  const cheio = teto !== undefined && itens.length >= teto;

  return (
    <div className="ei-itens">
      {itens.length === 0 && aberto === null && vazio && (
        <p className="ei-itens-vazio">{vazio}</p>
      )}

      {itens.map((item, i) =>
        aberto === i ? (
          <Formulario
            key={i}
            titulo={`Corrigir ${nomeDoItem}`}
            podeSalvar={rascunho !== null && temConteudo(rascunho)}
            salvando={salvando}
            aoGuardar={guardar}
            aoCancelar={fechar}
          >
            {rascunho !== null && formulario(rascunho, mudar)}
          </Formulario>
        ) : (
          <Cartao
            key={i}
            resumo={resumo(item)}
            aoEditar={() => abrirEdicao(i)}
            aoTirar={() => tirar(i)}
            desabilitado={aberto !== null}
          />
        )
      )}

      {aberto === -1 && (
        <Formulario
          titulo={`Nova ${nomeDoItem}`}
          podeSalvar={rascunho !== null && temConteudo(rascunho)}
          salvando={salvando}
          aoGuardar={guardar}
          aoCancelar={fechar}
        >
          {rascunho !== null && formulario(rascunho, mudar)}
        </Formulario>
      )}

      {aberto === null && !cheio && !semAdicionar && (
        <button type="button" className="ei-btn ei-btn-tonal ei-btn-largo" onClick={abrirNovo}>
          + {rotuloAdicionar}
        </button>
      )}

      {cheio && aberto === null && !semAdicionar && (
        <p className="ei-itens-vazio">
          Você já cadastrou o máximo de {teto}. Para trocar, tire uma e
          acrescente outra.
        </p>
      )}
    </div>
  );
}

/** O item já salvo: texto, e dois caminhos. */
function Cartao({
  resumo,
  aoEditar,
  aoTirar,
  desabilitado,
}: {
  resumo: ResumoDoCartao;
  aoEditar: () => void;
  aoTirar: () => void;
  desabilitado: boolean;
}) {
  const linhas = (resumo.linhas ?? []).filter((l): l is string => !!l && l.trim() !== "");
  return (
    <div className="ei-item">
      <div className="ei-item-texto">
        <span className="ei-item-titulo">{resumo.titulo}</span>
        {linhas.map((l, i) => (
          <span key={i} className="ei-item-linha">
            {l}
          </span>
        ))}
      </div>
      {/* Os dois botões embaixo, e não ao lado do texto: ao lado eles
          espremem o título — e é o título que a pessoa lê para achar o
          item que quer mexer. */}
      <div className="ei-item-acoes">
        <button
          type="button"
          className="ei-btn ei-btn-texto"
          onClick={aoEditar}
          disabled={desabilitado}
        >
          Editar
        </button>
        <button
          type="button"
          className="ei-btn ei-btn-texto ei-item-tirar"
          onClick={aoTirar}
          disabled={desabilitado}
        >
          Tirar
        </button>
      </div>
    </div>
  );
}

/** O formulário aberto: os campos de quem chama, e o que fazer com eles. */
function Formulario({
  titulo,
  children,
  podeSalvar,
  salvando,
  aoGuardar,
  aoCancelar,
}: {
  titulo: string;
  children: ReactNode;
  podeSalvar: boolean;
  salvando: boolean;
  aoGuardar: () => void;
  aoCancelar: () => void;
}) {
  return (
    <div className="ei-item ei-item-abrindo">
      <span className="ei-item-formulario-titulo">{titulo}</span>
      {children}
      <div className="ei-item-acoes ei-item-acoes-form">
        <button
          type="button"
          className="ei-btn ei-btn-cheio ei-btn-alto"
          onClick={aoGuardar}
          disabled={!podeSalvar || salvando}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" className="ei-btn ei-btn-texto" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
