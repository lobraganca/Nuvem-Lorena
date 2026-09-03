import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  obterVaga,
  obterOndasDaVaga,
  calcularOndas,
  abrirOnda,
  atualizarVaga,
} from "../lib/company";
import { mensagemDeErro } from "../lib/erros";
import { compativeisComAVaga, contarAparicaoEmBusca, type CandidatoCompativel } from "../lib/compativeis";
import { Pagina } from "../components/ei/Pagina";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import {
  FAIXAS_DAS_ONDAS,
  ONDAS,
  ONDAS_POR_VAGA,
  CAMPOS_DE_COMPATIBILIDADE,
  type JobListing,
  type JobDispatch,
  type WaveNumber,
} from "../types/domain";

/**
 * As ondas de uma vaga, em tela própria.
 *
 * ── Por que saiu da tela da vaga — 04/09 ─────────────────────────────
 *
 * A dona: "no painel da vaga acho que pode ter botões sobre as ondas e
 * outro para as pessoas que são interessadas. Daí fica mais organizado em
 * outras telas."
 *
 * A tela da vaga acumulava três assuntos numa rolagem só: a ficha da vaga,
 * as três ondas (com contagem, botão de disparo e explicação de cada
 * faixa) e a lista de quem se candidatou. Quem entrava para ver um nome
 * passava por dois blocos de disparo antes; quem entrava para disparar
 * rolava a ficha inteira.
 *
 * Agora a vaga é a ficha, e cada assunto tem porta e endereço.
 *
 * Disparar continua sendo um ATO da empresa, nunca automático: quem já
 * achou gente não incomoda mais ninguém.
 *
 * ── E agora ela mostra AS PESSOAS — 04/09 ────────────────────────────
 *
 * A dona: "no painel da empresa, ter duas opções: quem se interessou pela
 * vaga e as pessoas que são mais compatíveis com a vaga."
 *
 * A tela contava quantas pessoas a onda alcança, e não dizia QUEM são. Era
 * o número sem os nomes: a empresa disparava no escuro e esperava. Agora a
 * lista vem primeiro — nome, foto, quanto combina e por quê — e o disparo
 * continua embaixo, que é o lugar dele: primeiro se olha, depois se avisa.
 *
 * Nada aqui é mais do que a empresa já podia ver: é a mesma view pública
 * do banco de talentos, que é aberto até para quem não tem conta. O que
 * muda é a ordem e o motivo.
 */
export function OndasDaVagaPage() {
  const { id: vagaId } = useParams<{ id: string }>();
  const navegar = useNavigate();
  useTituloDaPagina("Pessoas mais compatíveis com a vaga");

  const [vaga, setVaga] = useState<JobListing | null>(null);
  const [ondas, setOndas] = useState<JobDispatch[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  /* `null` = ainda não perguntamos ao banco. Zero é resposta legítima
     ("não há mais ninguém"), então não dá para usá-lo como "não sei". */
  const [alcanceProximaOnda, setAlcanceProximaOnda] = useState<number | null>(null);
  const [contando, setContando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  /* `null` = ainda carregando. Lista vazia é resposta legítima ("não há
     ninguém cadastrado nessa cidade ainda") e precisa de texto próprio. */
  const [compativeis, setCompativeis] = useState<CandidatoCompativel[] | null>(null);
  const [erroLista, setErroLista] = useState("");

  /* ── A VARREDURA — 04/09 ────────────────────────────────────────────
     A dona: "ter uma animação que a empresa veja que está fazendo uma
     varredura no sistema. E depois ele aponta os resultados com os
     percentuais de compatibilidade que deu."

     `varrendo` é a animação; `resultado` é o que ela encontrou, guardado
     por onda com as notas de cada pessoa. Anônimo de propósito: a função
     do banco (`candidatos_para_compatibilidade`, 0113) devolve só os
     campos da comparação — sem nome, sem telefone, sem foto. Quem se
     interessar aparece com nome depois, na tela de interessados. Mostrar
     a lista de gente ANTES de avisar seria entregar o banco inteiro. */
  const [varrendo, setVarrendo] = useState(false);
  const [resultado, setResultado] = useState<Map<WaveNumber, number[]> | null>(null);
  /* Os campos que pesam nesta vaga. Ficam em estado próprio para o toque
     acender na hora — a gravação no banco vem logo atrás. */
  const [campos, setCampos] = useState<string[]>([]);
  const [salvandoCampos, setSalvandoCampos] = useState(false);

  useEffect(() => {
    if (!vagaId) {
      navegar("/painel-empresa", { replace: true });
      return;
    }
    (async () => {
      try {
        const v = await obterVaga(vagaId);
        if (!v) {
          setErro("Vaga não encontrada.");
          return;
        }
        setVaga(v);
        setCampos(v.campos_compatibilidade ?? []);
        setOndas(await obterOndasDaVaga(vagaId));

        /* A lista de gente é carregada à parte, e o erro dela é guardado à
           parte: se a leitura dos candidatos falhar, as ondas continuam
           funcionando. Juntar os dois num `try` só faria a tela inteira
           virar uma mensagem de erro por causa da metade que quebrou. */
        try {
          const gente = await compativeisComAVaga(v);
          setCompativeis(gente);
          /* Aparecer numa lista de candidatos É aparecer numa busca — é
             isto que alimenta o "você apareceu em N buscas" da tela de
             desempenho de quem procura trabalho. */
          contarAparicaoEmBusca(gente.slice(0, 50).map((c) => c.id));
        } catch (err) {
          setErroLista(
            mensagemDeErro(err, "Não foi possível carregar as pessoas mais compatíveis.")
          );
        }
      } catch (err) {
        setErro(mensagemDeErro(err, "Não foi possível carregar as ondas."));
      } finally {
        setCarregando(false);
      }
    })();
  }, [vagaId, navegar]);

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

  /**
   * Marca ou desmarca um campo de compatibilidade, e grava na hora.
   *
   * Grava a cada toque em vez de ter um botão "Salvar": são caixinhas, o
   * efeito de cada uma é a varredura seguinte, e um formulário com botão
   * de salvar no meio de uma tela de ação seria mais um passo entre a
   * empresa e o disparo. O estado da tela muda primeiro; se a gravação
   * falhar, ele volta atrás e a mensagem aparece — em vez de a tela
   * mostrar um campo marcado que o banco não tem.
   */
  async function alternarCampo(valor: string) {
    if (!vaga || salvandoCampos) return;
    const novos = campos.includes(valor)
      ? campos.filter((c) => c !== valor)
      : [...campos, valor];
    const antes = campos;
    setCampos(novos);
    setSalvandoCampos(true);
    setErro("");
    /* A varredura anterior valia para os campos anteriores: deixá-la na
       tela faria a empresa disparar com base numa conta que não é mais a
       desta vaga. */
    setResultado(null);
    setAlcanceProximaOnda(null);
    try {
      await atualizarVaga(vaga.id, { campos_compatibilidade: novos });
      setVaga({ ...vaga, campos_compatibilidade: novos });
    } catch (err) {
      setCampos(antes);
      setErro(mensagemDeErro(err, "Não consegui salvar o que pesa nesta vaga."));
    } finally {
      setSalvandoCampos(false);
    }
  }

  /**
   * A varredura: procura no banco, mostra a animação e devolve as notas.
   *
   * O `await` de 900ms não é enfeite nem atraso inventado — a conta roda
   * no navegador e volta rápido demais para a animação existir, e sem ela
   * a tela pisca e mostra um número do nada. A dona pediu justamente o
   * contrário: "que a empresa veja que está fazendo uma varredura no
   * sistema". O que a espera compra é a pessoa entender que houve uma
   * busca, e não um palpite.
   */
  async function varrer() {
    if (!vaga || varrendo) return;
    setVarrendo(true);
    setErro("");
    setResultado(null);
    try {
      const [todas] = await Promise.all([
        calcularOndas(vaga),
        new Promise((r) => setTimeout(r, 900)),
      ]);
      const mapa = new Map<WaveNumber, number[]>();
      for (const o of todas) mapa.set(o.onda, o.pessoas.map((p) => p.nota));
      setResultado(mapa);
      if (proximaOnda) {
        setAlcanceProximaOnda(mapa.get(proximaOnda)?.length ?? 0);
      }
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível fazer a varredura."));
    } finally {
      setVarrendo(false);
    }
  }

  async function dispararProximaOnda() {
    if (!vaga || !proximaOnda) return;
    setAbrindo(true);
    setErro("");
    try {
      await abrirOnda(vaga, proximaOnda);
      setOndas(await obterOndasDaVaga(vaga.id));
      setAlcanceProximaOnda(null);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível disparar a onda."));
    } finally {
      setAbrindo(false);
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
          <Pagina titulo="Mais compatíveis" voltar="/painel-empresa" />
          <p className="ei-apoio ei-margem">{erro || "Vaga não encontrada."}</p>
        </div>
      </div>
    );
  }

  const proximaOnda = ([1, 2, 3] as WaveNumber[]).find(
    (n) => !ondas.some((o) => o.wave === n)
  );
  const aindaTemOnda = ondas.length < ONDAS_POR_VAGA;

  return (
    <div className="ei">
      <div className="ei-tela detalhe-vaga">
        <Pagina titulo="Mais compatíveis" voltar={`/vaga/${vaga.id}`}>
          <p className="ei-apoio ei-margem" style={{ marginTop: 4 }}>
            {vaga.title}
          </p>
        </Pagina>

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 12 }} role="alert">
            {erro}
          </p>
        )}

      {/* ── O QUE PESA NESTA VAGA, E A VARREDURA — 04/09 ────────────────
          A dona: "ter um card onde a empresa pode marcar o que ele quer
          marcar nas compatibilidades da primeira onda. Ter uma parte onde
          a pessoa dispara e o sistema carrega e entrega o resultado das
          pessoas que estão dentro dos requisitos marcados."

          As caixinhas já existiam — no formulário de criar a vaga, uma
          etapa que a empresa passa uma vez e não volta. O lugar delas é
          aqui: é nesta tela que se decide quem vai ser avisado, e mudar um
          critério muda a conta da próxima varredura. Marcar aqui grava na
          mesma coluna (`campos_compatibilidade`, da 0105) que o formulário
          escreve. */}
      <h2 className="ei-secao">O que pesa nesta vaga</h2>
      <div className="ei-cartao">
        <p className="ei-apoio" style={{ margin: "0 0 12px" }}>
          Marque o que precisa bater. Sem nada marcado, o app compara pela
          função e pela cidade — que é o normal, e está tudo bem.
        </p>
        <div className="ei-chips">
          {CAMPOS_DE_COMPATIBILIDADE.map((c) => (
            <button
              key={c.valor}
              type="button"
              className="ei-chip"
              aria-pressed={campos.includes(c.valor)}
              disabled={salvandoCampos}
              onClick={() => alternarCampo(c.valor)}
            >
              {c.nome}
            </button>
          ))}
        </div>

        {/* A varredura fica no mesmo cartão dos critérios, logo abaixo
            deles: é a resposta à pergunta que as caixinhas fazem
            ("e daí, quem sobra?"), e separada em outro bloco a ligação
            entre as duas coisas se perde. */}
        <button
          type="button"
          className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
          style={{ marginTop: 16 }}
          disabled={varrendo || salvandoCampos}
          onClick={varrer}
        >
          {varrendo ? "Varrendo o Ei Emprego…" : "Fazer a varredura"}
        </button>

        {varrendo && (
          <div className="ei-varredura" role="status" aria-live="polite">
            <div className="ei-varredura-trilho">
              <span className="ei-varredura-feixe" />
            </div>
            <p className="ei-apoio" style={{ margin: "8px 0 0" }}>
              Comparando os cadastros de Itabirito com esta vaga…
            </p>
          </div>
        )}

        {resultado && !varrendo && (
          <div style={{ marginTop: 16 }}>
            {[...resultado.values()].every((n) => n.length === 0) ? (
              <p className="ei-apoio" style={{ margin: 0 }}>
                A varredura não encontrou ninguém com este conjunto de
                requisitos. Desmarcar algum critério alcança mais gente.
              </p>
            ) : (
              ([1, 2, 3] as WaveNumber[]).map((n) => {
                const notas = resultado.get(n) ?? [];
                const faixa = FAIXAS_DAS_ONDAS[n];
                return (
                  <div key={n} className="ei-varredura-faixa">
                    <span className="ei-varredura-faixa-nome">
                      Onda {n} · {faixa.de}% a {faixa.ate}%
                    </span>
                    <span className="ei-varredura-faixa-conta">
                      {notas.length === 0
                        ? "ninguém"
                        : notas.length === 1
                          ? "1 pessoa"
                          : `${notas.length} pessoas`}
                    </span>
                    {/* Os percentuais que deram, um a um — a dona pediu
                        "os percentuais de compatibilidade que deu". Sem
                        nome: a função do banco não devolve nenhum, e é o
                        certo — quem se interessar aparece com nome na tela
                        de interessados. Doze é o teto do que cabe sem virar
                        um muro de números. */}
                    {notas.length > 0 && (
                      <span className="ei-varredura-notas">
                        {notas.slice(0, 12).map((nota, i) => (
                          <span key={i} className="ei-selo ei-selo-cinza">
                            {nota}%
                          </span>
                        ))}
                        {notas.length > 12 && (
                          <span className="ei-apoio">
                            e mais {notas.length - 12}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

{/* ── A LISTA DE GENTE, ANTES DAS ONDAS — 04/09 ───────────────────
          Primeiro quem são, depois avisar. A ordem contrária (o disparo em
          cima, os nomes embaixo) faria a empresa disparar sem ter olhado —
          e onda gasta: são três por vaga, e não voltam. */}
      {erroLista && (
        <p className="ei-campo-erro ei-margem" style={{ marginTop: 12 }} role="alert">
          {erroLista}
        </p>
      )}

      {compativeis !== null && !erroLista && (
        <>
          <h2 className="ei-secao">
            {compativeis.length === 0
              ? "Quem combina com a vaga"
              : `${compativeis.length} ${
                  compativeis.length === 1 ? "pessoa cadastrada" : "pessoas cadastradas"
                } em ${vaga.city}`}
          </h2>

          {compativeis.length === 0 ? (
            <p className="ei-apoio ei-margem">
              Ainda não há cadastros em {vaga.city} para comparar com esta vaga.
            </p>
          ) : (
            <div className="ei-lista">
              {compativeis.slice(0, 40).map((c) => (
                /* O mesmo desenho de linha do banco de talentos (retrato
                   de 64px, nome, ofício), com a nota à direita: é a mesma
                   informação, e duas listas de gente com desenhos
                   diferentes fariam a empresa achar que são coisas
                   diferentes. */
                <Link key={c.id} to={`/profissional/${c.id}`} className="ei-pessoa">
                  <span className="ei-pessoa-retrato" aria-hidden="true">
                    {c.foto ? (
                      <img src={c.foto} alt="" />
                    ) : (
                      (c.nome || "?").trim().charAt(0).toLocaleUpperCase("pt-BR")
                    )}
                  </span>
                  <span className="ei-pessoa-texto">
                    <span className="ei-pessoa-nome ei-uma-linha">{c.nome}</span>
                    {/* O "por quê" é o que impede o número de virar
                        adivinhação: 85% sem explicação é um palpite que a
                        empresa não tem como conferir. */}
                    <span className="ei-pessoa-oficio">
                      {c.porque.length > 0
                        ? `Combina em ${c.porque.join(", ")}`
                        : c.funcoes.slice(0, 3).join(", ") || c.cidade}
                    </span>
                  </span>
                  <span className={`ei-nota-compat ${faixaDaNota(c.nota)}`}>{c.nota}%</span>
                </Link>
              ))}
            </div>
          )}

          {compativeis.length > 40 && (
            <p className="ei-apoio ei-margem" style={{ marginTop: 8 }}>
              Mostrando as 40 que mais combinam, de {compativeis.length}.
            </p>
          )}
        </>
      )}

      <h2 className="ei-secao">Avisar essas pessoas</h2>

      {/* ── AS TRÊS ONDAS, UMA POR BLOCO — 03/09 ─────────────────────────
          A dona: "a parte de disparo de ondas tem que ficar melhor.
          Colocar 3 botões de ondas."

          Era uma caixa que mostrava o que JÁ tinha sido disparado e, no
          fim, um bloco só para "a próxima" — então a empresa nunca via as
          três de uma vez, nem entendia que existe uma escala: exatamente
          isso → mesmo ofício → ramo vizinho. Cada onda alcança mais gente
          e menos precisa, e essa é a decisão que a tela tem que deixar
          tomar.

          Agora são três blocos fixos, sempre os três, cada um dizendo em
          que estado está: disparada (com data e quantas pessoas), pronta
          para disparar (com o botão), ou trancada (com o motivo escrito).
          Ninguém precisa adivinhar o que existe atrás do que está na tela. */}
      <div className="ei-lista">
        {([1, 2, 3] as WaveNumber[]).map((n) => {
          const jaSaiu = ondas.find((o) => o.wave === n);
          const ehAProxima = !jaSaiu && proximaOnda === n && vaga.status === "active";
          const semCota = !jaSaiu && !aindaTemOnda;

          return (
            <div key={n} className="ei-onda">
              <div className="ei-onda-topo">
                <span className="ei-onda-nome">
                  Onda {n} — {ONDAS[n].titulo}
                </span>
                {jaSaiu && <span className="ei-selo ei-selo-verde">Disparada</span>}
              </div>
              <p className="ei-onda-nota">{ONDAS[n].explicacao}</p>

              {jaSaiu ? (
                <p className="ei-onda-conta">
                  <strong>
                    {jaSaiu.professionals_count}{" "}
                    {jaSaiu.professionals_count === 1 ? "pessoa avisada" : "pessoas avisadas"}
                  </strong>{" "}
                  em{" "}
                  {new Date(jaSaiu.sent_at).toLocaleDateString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {/* Quantas TÊM aparelho que recebe aviso. Sem este número
                      a tela venderia um alcance que não existe, e a empresa
                      descobriria pelo silêncio — a forma mais cara. `null`
                      é "não sei" e some: escrever "0 com aviso" seria
                      inventar a pior notícia possível. */}
                  {jaSaiu.podiam_receber !== null && jaSaiu.podiam_receber !== undefined && (
                    <>
                      {" · "}
                      {jaSaiu.podiam_receber} com aviso no celular
                    </>
                  )}
                </p>
              ) : ehAProxima ? (
                alcanceProximaOnda === null ? (
                  <button
                    className="ei-btn ei-btn-contorno ei-btn-curto"
                    disabled={contando}
                    onClick={contarProximaOnda}
                  >
                    {contando ? "Contando…" : "Ver quantas pessoas alcança"}
                  </button>
                ) : (
                  <button
                    className="ei-btn ei-btn-cheio ei-btn-curto"
                    disabled={abrindo || alcanceProximaOnda === 0}
                    onClick={dispararProximaOnda}
                  >
                    {abrindo
                      ? "Avisando…"
                      : alcanceProximaOnda === 0
                        ? "Não há mais ninguém para avisar"
                        : `Avisar ${alcanceProximaOnda} ${
                            alcanceProximaOnda === 1 ? "pessoa" : "pessoas"
                          }`}
                  </button>
                )
              ) : (
                /* Trancada, e o motivo escrito: sem ele o bloco cinza
                   parece defeito. São dois motivos diferentes — a vaga não
                   está no ar, ou a cota de ondas acabou — e trocar um pelo
                   outro manda a empresa procurar a solução errada. */
                <p className="ei-onda-nota">
                  {vaga.status !== "active"
                    ? "A vaga precisa estar no ar para disparar."
                    : semCota
                      ? `Esta vaga já usou as ${ONDAS_POR_VAGA} ondas dela.`
                      : "Sai depois da onda anterior."}
                </p>
              )}
            </div>
          );
        })}
      </div>



      </div>
    </div>
  );
}

/**
 * A cor da nota, na mesma régua das ondas (0113).
 *
 * As faixas são as que a dona definiu — 80 a 100, 40 a 79, 0 a 39 —, e por
 * isso são LIDAS de `FAIXAS_DAS_ONDAS` em vez de escritas de novo aqui:
 * mudar a régua num lugar e não no outro faria a tela pintar de verde uma
 * pessoa que a onda 1 não alcança.
 */
function faixaDaNota(nota: number): string {
  if (nota >= FAIXAS_DAS_ONDAS[1].de) return "ei-nota-alta";
  if (nota >= FAIXAS_DAS_ONDAS[2].de) return "ei-nota-media";
  return "ei-nota-baixa";
}
