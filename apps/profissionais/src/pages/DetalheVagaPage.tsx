import { useEffect, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  obterVaga,
  obterOndasDaVaga,
  obterRespostasDaVaga,
  arquivarVaga,
  pausarVaga,
  reabrirVaga,
  excluirVaga,
  type RespostaComPessoa,
} from "../lib/company";
import { mensagemDeErro } from "../lib/erros";
import { Pagina, Prop, Callout } from "../components/ei/Pagina";
import {
  ONDAS,
  ONDAS_POR_VAGA,
  type JobListing,
  type JobDispatch,
  type WaveNumber,
} from "../types/domain";

/**
 * Detalhes de uma vaga: dados, ondas, e respostas de profissionais.
 */
export function DetalheVagaPage() {
  const { id: vagaId } = useParams<{ id: string }>();
  /* Vem da tela de criar quando a vaga foi gravada mas alguma etapa
     seguinte falhou (o aviso às pessoas, o anúncio). Ver o `catch` de
     `confirmarEAbrirPrimeiraOnda`. */
  const [busca] = useSearchParams();
  const chegouPelaMetade = busca.get("parcial") === "1";
  const navegar = useNavigate();
  const { user } = useAuth();

  const [vaga, setVaga] = useState<JobListing | null>(null);
  const [ondas, setOndas] = useState<JobDispatch[]>([]);
  const [respostas, setRespostas] = useState<RespostaComPessoa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [fechando, setFechando] = useState(false);
  /* A pergunta do excluir mora na própria tela — ver o comentário no
     botão. `window.confirm` some dentro do app instalado. */
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!vagaId) {
      navegar("/painel-empresa", { replace: true });
      return;
    }

    carregarDados();
  }, [vagaId, navegar]);

  async function carregarDados() {
    try {
      const v = await obterVaga(vagaId!);
      if (!v) {
        setErro("Vaga não encontrada.");
        return;
      }
      setVaga(v);

      const o = await obterOndasDaVaga(vagaId!);
      setOndas(o);

      const r = await obterRespostasDaVaga(vagaId!);
      setRespostas(r);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível carregar a vaga."));
    } finally {
      setCarregando(false);
    }
  }

  async function mudarEstado(
    acao: () => Promise<void>,
    seDerErrado: string
  ) {
    if (!vagaId) return;
    setFechando(true);
    setErro("");
    try {
      await acao();
      await carregarDados();
    } catch (err) {
      /* O erro do banco vem como veio: quem recusa reabrir é o gatilho do
         plano, e a mensagem dele diz QUAL das duas coisas faltou (plano
         vencido ou plano cheio). Um texto genérico aqui apagaria isso. */
      setErro(mensagemDeErro(err, seDerErrado));
    } finally {
      setFechando(false);
    }
  }

  async function excluirVagaFunc() {
    if (!vagaId) return;

    setFechando(true);
    setErro("");
    try {
      await excluirVaga(vagaId);
      navegar("/painel-empresa", { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível excluir a vaga."));
      setFechando(false);
    }
  }

  if (carregando) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <p className="ei-apoio ei-margem" style={{ paddingTop: 24 }}>Carregando…</p>
        </div>
      </div>
    );
  }

  if (!vaga) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Vaga" voltar="/painel-empresa" />
          <p className="ei-apoio ei-margem" style={{ paddingTop: 8 }}>
            {erro || "Vaga não encontrada."}
          </p>
          <div className="ei-margem" style={{ marginTop: 16 }}>
            <button className="ei-btn ei-btn-contorno" onClick={() => navegar("/painel-empresa")}>
              Ver minhas vagas
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalProfissionais = ondas.reduce((sum, o) => sum + o.professionals_count, 0);

  /* A próxima onda que ainda não abriu. `undefined` quando as três já
     saíram — aí não há mais ninguém a alcançar e o bloco some da tela, em
     vez de virar um botão que não faz nada. */
  /* Cada vaga tem direito a `ONDAS_POR_VAGA` ondas, e quem recusa a terceira
     é o banco (gatilho da 0072). Esconder o bloco quando o direito acabou
     evita o pior caminho: a empresa toca o botão, espera, e recebe um erro
     que não tinha como prever. */
  const aindaTemOnda = ondas.length < ONDAS_POR_VAGA;

  /* Dias inteiros desde a publicação, e nunca negativo: um relógio
     adiantado no celular faria a tela dizer "no ar há -1 dias". */
  const diasNoAr = Math.max(
    0,
    Math.floor((Date.now() - new Date(vaga.created_at).getTime()) / 86_400_000)
  );

  return (
    <div className="ei">
      <div className="ei-tela detalhe-vaga">
        {/* Era a última tela no desenho velho: cartões cinzas, "Descrição:"
            com dois-pontos, um botão AZUL (o último do app) e "Voltar" duas
            vezes — em cima e embaixo. A migalha do cabeçalho de página faz
            o trabalho dos dois botões, e faz melhor: diz onde a pessoa
            está, não só que dá para sair. */}
        <Pagina titulo={vaga.title} voltar="/painel-empresa">
          {/* A vaga existe — o que faltou tem botão próprio nesta tela.
              Antes a empresa lia "não foi possível criar a vaga" e a vaga
              estava criada. */}
          {chegouPelaMetade && (
            <Callout atencao>
              <strong>A vaga foi publicada.</strong> Só o aviso para os
              profissionais não chegou a sair — dá para disparar aqui embaixo,
              em "Avisar mais gente".
            </Callout>
          )}
          <div className="ei-props">
            {/* O estado vem primeiro, e só quando NÃO é o normal. Uma vaga
                no ar não precisa dizer que está no ar; uma pausada precisa,
                porque a tela é idêntica nos dois casos e a empresa pode
                passar semanas achando que está recebendo gente. */}
            {vaga.status !== "active" && (
              <Prop rotulo="Situação">
                {vaga.status === "paused" ? (
                  <span className="ei-selo ei-selo-laranja">
                    Pausada — não está recebendo
                  </span>
                ) : (
                  <span className="ei-selo ei-selo-cinza">Encerrada</span>
                )}
              </Prop>
            )}
            <Prop rotulo="Ofício">{vaga.profession}</Prop>
            <Prop rotulo="Jeito">
              {vaga.work_modality === "presencial"
                ? "Presencial"
                : vaga.work_modality === "remoto"
                  ? "A distância"
                  : "Híbrido"}
            </Prop>
            {vaga.required_experience && (
              <Prop rotulo="Experiência">{vaga.required_experience}</Prop>
            )}
            {vaga.salary_range_min && vaga.salary_range_max && (
              <Prop rotulo="Salário">
                R$ {(vaga.salary_range_min / 100).toLocaleString("pt-BR")} a R${" "}
                {(vaga.salary_range_max / 100).toLocaleString("pt-BR")}
              </Prop>
            )}
            <Prop rotulo="Publicada">
              {new Date(vaga.created_at).toLocaleDateString("pt-BR")}
            </Prop>
          </div>

          {/* ── AS MÉTRICAS DA VAGA (item 10) ──────────────────────────
              A dona: "ao clicar nas vagas terão acesso às métricas da vaga
              e as pessoas que se interessaram."

              Os dois números já existiam nesta tela, mas espalhados: as
              avisadas dentro do bloco de ondas, no meio de uma explicação
              de três parágrafos, e as interessadas só como título de uma
              seção lá embaixo. Quem abria a vaga para saber "isso está
              funcionando?" tinha de ler a tela inteira e somar de cabeça.

              São três, e a terceira é a que dá sentido às outras duas: 40
              avisadas e 2 interessadas em um dia é ótimo; em três semanas,
              é a vaga que ninguém quis. */}
          <div className="ei-resumo">
            <div className="ei-resumo-item">
              <span className="ei-resumo-rotulo">Avisadas</span>
              <span className="ei-resumo-numero">{totalProfissionais}</span>
            </div>
            <div className="ei-resumo-item">
              <span className="ei-resumo-rotulo">Interessadas</span>
              <span className="ei-resumo-numero">{respostas.length}</span>
            </div>
            <div className="ei-resumo-item">
              <span className="ei-resumo-rotulo">No ar há</span>
              <span className="ei-resumo-numero">
                {diasNoAr}
                <span className="ei-resumo-de"> {diasNoAr === 1 ? "dia" : "dias"}</span>
              </span>
            </div>
          </div>
        </Pagina>

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 12 }} role="alert">
            {erro}
          </p>
        )}

        {vaga.description && (
          <p className="ei-corpo ei-margem" style={{ paddingTop: 10 }}>
            {vaga.description}
          </p>
        )}

      {/* O que fazer com a vaga — 02/09, sem as legendas
          ────────────────────────────────────────────────
          A dona: "tirar legendas, está ocupando muito espaço. Faça os
          botões menores."

          Cada um dos quatro botões tinha duas linhas de explicação embaixo:
          quatro botões viraram doze linhas e mais de meia tela de rolagem,
          e o que a empresa vem fazer aqui — ver quem se interessou — ficava
          espremido acima disso.

          As palavras dos botões já dizem o que eles fazem ("Arquivar — já
          contratei", "Pausar por enquanto"). O que a legenda acrescentava
          era a CONSEQUÊNCIA no plano, e essa continua onde ela pesa: na
          confirmação do excluir, que é a única irreversível, e no aviso de
          reabrir, que ocupa vaga.

          Agora são botões pequenos, numa fileira que quebra sozinha quando
          não cabe — e não quatro barras de largura cheia. Excluir continua
          por último, sem cor e à parte, para não ser tocado por engano. */}
      <div className="ei-margem ei-acoes-vaga">
        <Link className="ei-btn ei-btn-contorno ei-btn-curto" to={`/vaga/${vaga.id}/editar`}>
          Editar
        </Link>

        {vaga.status === "active" && (
          <button
            className="ei-btn ei-btn-contorno ei-btn-curto"
            onClick={() => mudarEstado(() => pausarVaga(vaga.id), "Não foi possível pausar a vaga.")}
            disabled={fechando}
          >
            Pausar
          </button>
        )}

        {vaga.status !== "active" && (
          <button
            className="ei-btn ei-btn-cheio ei-btn-curto"
            onClick={() => mudarEstado(() => reabrirVaga(vaga.id), "Não foi possível reabrir a vaga.")}
            disabled={fechando}
            /* O aviso que era legenda vira `title`: reabrir ocupa uma vaga
               do plano de novo, e isso é consequência de dinheiro. */
            title="Reabrir ocupa uma vaga do seu plano de novo."
          >
            {vaga.status === "paused" ? "Reabrir" : "Reabrir vaga"}
          </button>
        )}

        {vaga.status !== "closed" && (
          <button
            className="ei-btn ei-btn-contorno ei-btn-curto"
            onClick={() => mudarEstado(() => arquivarVaga(vaga.id), "Não foi possível arquivar a vaga.")}
            disabled={fechando}
            title="Libera uma vaga do seu plano. A lista de interessados continua no painel, em Encerradas."
          >
            Arquivar
          </button>
        )}

        {/* Fora da fileira e sem cor: apagar leva junto a lista de quem se
            interessou, e a confirmação explica isso por extenso.

            ── A CONFIRMAÇÃO SAIU DO `window.confirm` — 03/09 ────────────
            Era uma janelinha do navegador. Dentro do app instalado ela não
            aparece em alguns aparelhos, e o que sobra é o pior caminho
            possível: um toque em "Excluir" apagando a vaga e a lista de
            interessados na hora, sem pergunta nenhuma. Encontrado usando o
            app: as ações da vaga disparavam de primeira.

            Agora a pergunta é a própria tela, e ela DIZ O NÚMERO — "Tem
            certeza?" não informa nada; saber que três pessoas interessadas
            somem junto é o que faz parar e escolher arquivar. */}
        {!confirmandoExclusao ? (
          <button
            className="ei-btn ei-btn-texto ei-acoes-vaga-excluir"
            onClick={() => {
              setErro("");
              setConfirmandoExclusao(true);
            }}
            disabled={fechando}
            style={{ color: "var(--ei-erro)" }}
          >
            Excluir
          </button>
        ) : null}
      </div>

      {confirmandoExclusao && (
        <div className="ei-margem" style={{ display: "grid", gap: 10, marginTop: 4 }}>
          <p className="ei-apoio" style={{ margin: 0 }}>
            {respostas.length > 0
              ? `Excluir apaga esta vaga e ${
                  respostas.length === 1
                    ? "a pessoa interessada"
                    : `as ${respostas.length} pessoas interessadas`
                } nela. Não dá para desfazer. Se você só quer tirar do ar, use “Arquivar” — a lista fica guardada.`
              : "Excluir apaga esta vaga de vez. Não dá para desfazer."}
          </p>
          <button
            className="ei-btn ei-btn-contorno ei-btn-largo"
            onClick={excluirVagaFunc}
            disabled={fechando}
            style={{ color: "var(--ei-erro)" }}
          >
            {fechando ? "Excluindo…" : "Sim, excluir esta vaga"}
          </button>
          <button
            className="ei-btn ei-btn-texto"
            onClick={() => setConfirmandoExclusao(false)}
            disabled={fechando}
          >
            Não, deixar como está
          </button>
        </div>
      )}

      {/* ── DUAS PORTAS, EM VEZ DE DOIS BLOCOS — 04/09 ──────────────────
          A dona: "no painel da vaga acho que pode ter botões sobre as
          ondas e outro para as pessoas que são interessadas. Daí fica mais
          organizado em outras telas."

          Esta tela acumulava três assuntos numa rolagem só: a ficha da
          vaga, as três ondas (com contagem, botão de disparo e a
          explicação de cada faixa) e a lista de quem se candidatou. Quem
          entrava para ver um nome passava por dois blocos de disparo
          antes; quem entrava para disparar rolava a ficha inteira.

          Cada porta DIZ o que tem dentro — "1 de 3 disparadas", "2 pessoas
          se interessaram". Uma porta que não conta nada obriga a abrir
          para descobrir que não havia nada. */}
      <h2 className="ei-secao">Esta vaga</h2>
      <div className="ei-portas ei-margem">
        <Link to={`/vaga/${vaga.id}/interessados`} className="ei-porta ei-porta-cheia">
          <span className="ei-porta-nome">Quem se interessou</span>
          <span className="ei-porta-nota">
            {respostas.length === 0
              ? "Ninguém ainda — quem tocar em “tenho interesse” aparece aqui"
              : respostas.length === 1
                ? "1 pessoa, com telefone"
                : `${respostas.length} pessoas, com telefone`}
          </span>
        </Link>

        <Link to={`/vaga/${vaga.id}/ondas`} className="ei-porta">
          <span className="ei-porta-nome">Ondas de aviso</span>
          <span className="ei-porta-nota">
            {ondas.length === 0
              ? `Nenhuma disparada ainda — são ${ONDAS_POR_VAGA} por vaga`
              : `${ondas.length} de ${ONDAS_POR_VAGA} disparadas`}
            {aindaTemOnda && vaga.status === "active" ? " · dá para avisar mais gente" : ""}
          </span>
        </Link>
      </div>

      </div>
    </div>
  );
}

