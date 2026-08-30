import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  obterVaga,
  obterOndasDaVaga,
  obterRespostasDaVaga,
  fecharVaga,
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

  async function fecharVagaFunc() {
    if (!vagaId) return;
    setFechando(true);

    try {
      await fecharVaga(vagaId);
      navegar("/painel-empresa", { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível fechar a vaga."));
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
          <Pagina icone="📋" titulo="Vaga" ondeEstou="Vaga" />
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

  return (
    <div className="ei">
      <div className="ei-tela detalhe-vaga">
        {/* Era a última tela no desenho velho: cartões cinzas, "Descrição:"
            com dois-pontos, um botão AZUL (o último do app) e "Voltar" duas
            vezes — em cima e embaixo. A migalha do cabeçalho de página faz
            o trabalho dos dois botões, e faz melhor: diz onde a pessoa
            está, não só que dá para sair. */}
        <Pagina icone="📋" titulo={vaga.title} ondeEstou="Vaga">
          <div className="ei-props">
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
          <p className="muted">Nenhum profissional respondeu ainda.</p>
        ) : (
          /* Cada pessoa vira uma LINHA com nome, rosto e caminho para o
             perfil — onde está o telefone. Antes era "Profissional ID:
             8f3a2b1c…" com um botão "Ver perfil" que não fazia nada: a
             lista pela qual a empresa paga o plano inteiro chegava como
             uma coluna de códigos. */
          <div style={{ margin: "0 -20px" }}>
            {respostas.map((resp) => (
              <Link
                key={resp.id}
                to={`/profissional/${resp.professional_id}`}
                className="ei-pessoa"
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
                <span className="ei-linha-seta" aria-hidden="true">
                  <IconeSeta />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Só "Fechar vaga". O "Voltar" daqui era o segundo da tela — o
          primeiro estava no topo —, e a migalha já leva de volta. */}
      {vaga.status === "active" && (
        <div className="ei-margem" style={{ marginTop: 24 }}>
          <button
            className="ei-btn ei-btn-contorno ei-btn-largo"
            onClick={fecharVagaFunc}
            disabled={fechando}
          >
            {fechando ? "Fechando…" : "Fechar esta vaga"}
          </button>
          <p className="ei-apoio" style={{ marginTop: 8 }}>
            Fechar libera uma vaga do seu plano. Quem já respondeu continua nesta lista.
          </p>
        </div>
      )}
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
