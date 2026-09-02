import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  obterVaga,
  obterOndasDaVaga,
  obterRespostasDaVaga,
  arquivarVaga,
  pausarVaga,
  reabrirVaga,
  excluirVaga,
  calcularOndas,
  abrirOnda,
  type RespostaComPessoa,
} from "../lib/company";
import { mensagemDeErro } from "../lib/erros";
import { Pagina, Prop } from "../components/ei/Pagina";
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
  const navegar = useNavigate();
  const { user } = useAuth();

  const [vaga, setVaga] = useState<JobListing | null>(null);
  const [ondas, setOndas] = useState<JobDispatch[]>([]);
  const [respostas, setRespostas] = useState<RespostaComPessoa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [fechando, setFechando] = useState(false);
  const [erro, setErro] = useState("");
  /* `null` = ainda não perguntamos ao banco. Um número = a contagem veio.
     Zero é resposta legítima ("não há mais ninguém"), então não dá para
     usar 0 como "não sei" — seria a mesma confusão que faz tela dizer
     "nenhum resultado" quando na verdade a consulta falhou. */
  const [alcanceProximaOnda, setAlcanceProximaOnda] = useState<number | null>(null);
  const [contando, setContando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);

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

  /** Quantas pessoas novas a próxima onda alcança. Só quando a empresa pede. */
  async function contarProximaOnda() {
    if (!vaga || !proximaOnda) return;
    setContando(true);
    setErro("");
    try {
      const todas = await calcularOndas(vaga);
      setAlcanceProximaOnda(todas.find((o) => o.onda === proximaOnda)?.novos ?? 0);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível contar os profissionais."));
    } finally {
      setContando(false);
    }
  }

  async function abrirProximaOnda() {
    if (!vaga || !proximaOnda) return;
    setAbrindo(true);
    setErro("");
    try {
      await abrirOnda(vaga, proximaOnda);
      /* Recarrega em vez de acrescentar à lista na mão: a onda gravada é a
         que vale, e o número dela vem do banco. */
      setAlcanceProximaOnda(null);
      await carregarDados();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível avisar os profissionais."));
    } finally {
      setAbrindo(false);
    }
  }

  /**
   * Pausar, reabrir e arquivar num caminho só.
   *
   * Depois de mudar o estado a tela RECARREGA em vez de voltar ao painel.
   * Arquivar mandava embora, e isso escondia o que a empresa acabou de
   * fazer: ela ficava sem ver que a vaga continua ali, com a lista de quem
   * se interessou — que é justamente o que a frase embaixo do botão
   * promete.
   */
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
    /* A confirmação DIZ O NÚMERO. "Tem certeza?" não informa nada; saber
       que três pessoas interessadas somem junto é o que faz a empresa
       parar e escolher arquivar. */
    const quantos = respostas.length;
    const aviso =
      quantos > 0
        ? `Excluir apaga esta vaga e ${quantos === 1 ? "a pessoa interessada" : `as ${quantos} pessoas interessadas`} nela. Não dá para desfazer.\n\nSe você só quer tirar do ar, use "Arquivar" — a lista fica guardada.`
        : "Excluir apaga esta vaga de vez. Não dá para desfazer.";
    if (!window.confirm(aviso)) return;

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
  const proximaOnda = ([1, 2, 3] as WaveNumber[]).find(
    (n) => !ondas.some((o) => o.wave === n)
  );

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

      {/* Status das ondas */}
      <h2 className="ei-secao">As ondas desta vaga</h2>
      <section className="ei-cartao">

        {ondas.length === 0 ? (
          <p className="muted">Nenhuma onda disparada ainda.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {ondas.map((onda) => (
              <div
                key={onda.id}
                style={{
                  padding: 12,
                  backgroundColor: "var(--color-bg-input)",
                  borderRadius: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>Onda {onda.wave}</strong>
                  <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.9em" }}>
                    Disparada em {new Date(onda.sent_at).toLocaleDateString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>
                    {onda.professionals_count}
                  </div>
                  <div className="muted" style={{ fontSize: "0.85em" }}>
                    {onda.professionals_count === 1 ? "pessoa" : "pessoas"}
                  </div>
                  {/* O número que não pode faltar.
                      ─────────────────────────────
                      Notificação só alcança quem instalou o app e aceitou
                      receber. Mostrar só "12 pessoas" venderia um alcance
                      que não existe, e a empresa descobriria pelo silêncio
                      — a forma mais cara de descobrir.

                      `null` é "não sei" e some da tela: a contagem pode ter
                      falhado, e escrever "0 com aviso" nesse caso seria
                      inventar a pior notícia possível. */}
                  {onda.podiam_receber !== null && onda.podiam_receber !== undefined && (
                    <div
                      className="muted"
                      style={{ fontSize: "0.78em", marginTop: 2, maxWidth: 130 }}
                    >
                      {onda.podiam_receber} com aviso no celular
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div
              style={{
                padding: 12,
                backgroundColor: "var(--color-primary-light)",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              <strong>
                {totalProfissionais}{" "}
                {totalProfissionais === 1 ? "pessoa avisada" : "pessoas avisadas"} até agora
              </strong>
            </div>
          </div>
        )}

        {/* Abrir a próxima onda.
            ─────────────────────
            Nada abre sozinho neste app: sem agendamento, sem cron, sem
            aviso de madrugada. Quem já achou gente na onda 1 simplesmente
            não toca aqui, e ninguém mais é incomodado — que é a diferença
            entre um app que avisa e um app que a pessoa silencia.

            A contagem só é buscada quando a empresa pede, e não ao abrir a
            tela: ela lê a base inteira em páginas (ver `lerTudo`), e fazer
            isso a cada visita à vaga seria cobrar de todo mundo o preço de
            uma pergunta que quase ninguém faz. */}
        {vaga.status === "active" && !aindaTemOnda && ondas.length > 0 && (
          <p className="muted" style={{ marginTop: 16, fontSize: "0.9em" }}>
            Esta vaga já usou as {ONDAS_POR_VAGA} ondas dela. Quem encaixava foi
            avisado — daqui em diante quem chega é quem procura sozinho.
          </p>
        )}

        {vaga.status === "active" && aindaTemOnda && proximaOnda && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
            <p style={{ margin: "0 0 4px" }}>
              <strong>
                Onda {proximaOnda} — {ONDAS[proximaOnda].titulo}
              </strong>
            </p>
            <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.9em" }}>
              {ONDAS[proximaOnda].explicacao}
              {alcanceProximaOnda !== null &&
                ` Alcança ${alcanceProximaOnda} ${
                  alcanceProximaOnda === 1 ? "pessoa nova" : "pessoas novas"
                }.`}
            </p>

            {alcanceProximaOnda === null ? (
              <button
                className="btn btn-outline btn-block"
                disabled={contando}
                onClick={contarProximaOnda}
              >
                {contando ? "Contando…" : "Ainda não achei ninguém — ver quem mais posso avisar"}
              </button>
            ) : (
              <button className="btn btn-primary btn-block" disabled={abrindo} onClick={abrirProximaOnda}>
                {abrindo
                  ? "Avisando…"
                  : alcanceProximaOnda === 0
                    ? "Não há mais ninguém para avisar"
                    : `Avisar as ${alcanceProximaOnda} pessoas da onda ${proximaOnda}`}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Respostas */}
      <section className="ei-cartao">
        <h2 className="ei-cartao-titulo" style={{ marginBottom: 10 }}>
          Profissionais interessados
          {respostas.length > 0 && ` (${respostas.length})`}
        </h2>

        {respostas.length === 0 ? (
          /* "Ainda não se interessou" e não "não respondeu": desde a 0078 a
             pessoa também pode responder que a vaga não é para ela, e essa
             resposta não aparece aqui. Dizer "ninguém respondeu" sobre uma
             vaga que já teve respostas seria falso. */
          <p className="muted">
            Ninguém se interessou ainda. Quem tocar em “tenho interesse” aparece aqui,
            com o telefone.
          </p>
        ) : (
          /* Cada pessoa vira uma LINHA com nome, rosto e caminho para o
             perfil — onde está o telefone. Antes era "Profissional ID:
             8f3a2b1c…" com um botão "Ver perfil" que não fazia nada: a
             lista pela qual a empresa paga o plano inteiro chegava como
             uma coluna de códigos. */
          <div style={{ margin: "0 -20px" }}>
            {respostas.map((resp) => (
              /* O link usa `cadastroId`, e não `professional_id`: aquele é
                 o id da CONTA, e abriria "perfil não encontrado". Quem
                 está sem cadastro visível vira linha sem toque. */
              <Link
                key={resp.id}
                to={resp.cadastroId ? `/profissional/${resp.cadastroId}` : "#"}
                className="ei-pessoa"
                style={resp.cadastroId ? undefined : { pointerEvents: "none", opacity: 0.6 }}
              >
                <span className="ei-pessoa-retrato" aria-hidden="true">
                  {resp.foto ? (
                    <img src={resp.foto} alt="" loading="lazy" />
                  ) : (
                    (resp.nome || "?").trim().charAt(0).toLocaleUpperCase("pt-BR")
                  )}
                </span>
                <span className="ei-pessoa-texto">
                  <span className="ei-pessoa-nome ei-uma-linha">
                    {resp.nome || "Sem nome"}
                  </span>
                  <span className="ei-pessoa-oficio ei-uma-linha">
                    {resp.bairro ? `${resp.bairro} · ` : ""}
                    respondeu em {new Date(resp.responded_at).toLocaleDateString("pt-BR")}
                  </span>
                </span>
                {resp.cadastroId && (
                  <span className="ei-linha-seta" aria-hidden="true">
                    <IconeSeta />
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* O que fazer com a vaga.
          ────────────────────────
          Havia um botão só, "Fechar esta vaga", e ele era as três coisas ao
          mesmo tempo: quem queria parar de receber por uns dias, quem tinha
          contratado, e quem publicou errado tinham todos a mesma saída.

          Agora são três, e a diferença está escrita embaixo de cada uma —
          porque "pausar", "arquivar" e "excluir" só parecem óbvios para
          quem já sabe qual é qual. Excluir fica por último e sem cor, para
          não ser tocado por engano. */}
      <div className="ei-margem" style={{ marginTop: 24, display: "grid", gap: 18 }}>
        {vaga.status === "active" && (
          <div>
            <button
              className="ei-btn ei-btn-contorno ei-btn-largo"
              onClick={() => mudarEstado(() => pausarVaga(vaga.id), "Não foi possível pausar a vaga.")}
              disabled={fechando}
            >
              Pausar por enquanto
            </button>
            <p className="ei-apoio" style={{ marginTop: 8 }}>
              Some de quem procura, sem encerrar o processo. Você reabre quando quiser.
            </p>
          </div>
        )}

        {vaga.status !== "active" && (
          <div>
            <button
              className="ei-btn ei-btn-cheio ei-btn-largo"
              onClick={() => mudarEstado(() => reabrirVaga(vaga.id), "Não foi possível reabrir a vaga.")}
              disabled={fechando}
            >
              {vaga.status === "paused" ? "Voltar a receber interessados" : "Reabrir esta vaga"}
            </button>
            <p className="ei-apoio" style={{ marginTop: 8 }}>
              Reabrir ocupa uma vaga do seu plano de novo.
            </p>
          </div>
        )}

        {vaga.status !== "closed" && (
          <div>
            <button
              className="ei-btn ei-btn-contorno ei-btn-largo"
              onClick={() => mudarEstado(() => arquivarVaga(vaga.id), "Não foi possível arquivar a vaga.")}
              disabled={fechando}
            >
              Arquivar — já contratei
            </button>
            <p className="ei-apoio" style={{ marginTop: 8 }}>
              Libera uma vaga do seu plano. A lista de interessados continua aqui, em
              “Encerradas”, no seu painel.
            </p>
          </div>
        )}

        <div>
          <button
            className="ei-btn ei-btn-texto"
            onClick={excluirVagaFunc}
            disabled={fechando}
            style={{ color: "var(--ei-erro)" }}
          >
            Excluir esta vaga
          </button>
          <p className="ei-apoio" style={{ marginTop: 4 }}>
            Apaga a vaga e a lista de quem se interessou. Não dá para desfazer.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}

function IconeSeta() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
