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
import Esqueleto from "../components/ei/Esqueleto";
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
  /* ── AS CAIXINHAS COMEÇAM FECHADAS — 05/09 ──────────────────────────
     São dezesseis, e medidas davam 627px: seis telas de rolagem antes de
     a empresa chegar em qualquer coisa que ela veio fazer. Fechadas, o
     cartão diz o que está valendo numa linha e abre quando alguém quer
     mudar. */
  const [abrindoCriterios, setAbrindoCriterios] = useState(false);
  /* A lista de gente começa curta: doze cabem numa rolagem, e o resto vem
     a pedido. Ver o comentário longo lá embaixo. */
  const [mostrarTodas, setMostrarTodas] = useState(false);

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

        /* ── A CONTA VEM PRONTA — 05/09 ─────────────────────────────────
           A dona: "tem que melhorar a tela das ondas, não tá intuitivo."

           Era isto o menos intuitivo de tudo: a tela abria com as três
           ondas sem número nenhum. A onda 1 tinha um botão "ver quantas
           pessoas alcança" (mais um toque para saber o básico), e as ondas
           2 e 3 só diziam "sai depois da onda anterior" — a empresa não
           tinha como saber se atrás daquela porta havia trinta pessoas ou
           nenhuma, que é justamente o que decide se vale disparar.

           Agora a conta roda junto com a tela. Ela é a mesma de sempre
           (`calcularOndas`), e é DIFERENTE da lista de baixo de propósito:
           quem escolheu não aparecer no banco de talentos não entra na
           lista, mas recebe o aviso da onda. Tirar o número daqui em vez
           de da lista é o que impede a tela de prometer um alcance menor
           do que o real.

           Erro próprio, como o da lista: se a conta falhar, as ondas
           continuam disparáveis — só sem os números. */
        try {
          const todas = await calcularOndas(v);
          const mapa = new Map<WaveNumber, number[]>();
          for (const o of todas) mapa.set(o.onda, o.pessoas.map((p) => p.nota));
          setResultado(mapa);
        } catch {
          /* Sem número na tela, e é melhor assim que uma tela de erro:
             o botão de refazer a varredura continua ali. */
        }

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
          <Esqueleto />
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

      {/* ── O QUE PESA NESTA VAGA — 04/09, refeito em 05/09 ─────────────
          A dona: "ter um card onde a empresa pode marcar o que ele quer
          marcar nas compatibilidades da primeira onda."

          As caixinhas já existiam — no formulário de criar a vaga, uma
          etapa que a empresa passa uma vez e não volta. O lugar delas é
          aqui: é nesta tela que se decide quem vai ser avisado, e mudar um
          critério muda a conta da varredura. Marcar aqui grava na mesma
          coluna (`campos_compatibilidade`, da 0105) que o formulário
          escreve.

          Em 05/09 elas passaram a começar FECHADAS. Medido: dezesseis
          pastilhas ocupavam 627px, seis telas de rolagem antes de a
          empresa alcançar qualquer coisa que ela veio fazer aqui. O
          cartão agora abre dizendo o que está valendo, numa linha, e as
          caixinhas aparecem para quem quer mudar. */}
      <div className="ei-cartao ei-criterios">
        <div className="ei-criterios-topo">
          <div className="ei-criterios-resumo">
            <span className="ei-criterios-rotulo">O que pesa nesta vaga</span>
            <span className="ei-criterios-valor">
              {campos.length === 0
                ? "A função e a cidade"
                : CAMPOS_DE_COMPATIBILIDADE.filter((c) => campos.includes(c.valor))
                    .map((c) => c.nome)
                    .join(", ")}
            </span>
          </div>
          <button
            type="button"
            className="ei-btn ei-btn-contorno ei-btn-curto"
            aria-expanded={abrindoCriterios}
            onClick={() => setAbrindoCriterios((v) => !v)}
          >
            {abrindoCriterios ? "Pronto" : "Mudar"}
          </button>
        </div>

        {abrindoCriterios && (
          <>
            <p className="ei-apoio" style={{ margin: "12px 0" }}>
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
          </>
        )}

        {/* A varredura fica no mesmo cartão dos critérios, logo abaixo
            deles: é a resposta à pergunta que as caixinhas fazem
            ("e daí, quem sobra?"), e separada em outro bloco a ligação
            entre as duas coisas se perde.

            Ela deixou de ser o único jeito de saber os números — a tela já
            abre com eles (ver o comentário na carga). Continua aqui porque
            a dona pediu a animação ("que a empresa veja que está fazendo
            uma varredura no sistema"), e porque depois de mudar um
            critério é ela que refaz a conta. */}
        <button
          type="button"
          className="ei-btn ei-btn-contorno ei-btn-largo"
          style={{ marginTop: 14 }}
          disabled={varrendo || salvandoCampos}
          onClick={varrer}
        >
          {varrendo ? "Varrendo o Ei Emprego…" : "Refazer a varredura"}
        </button>

        {varrendo && (
          <div className="ei-varredura" role="status" aria-live="polite">
            <div className="ei-varredura-trilho">
              <span className="ei-varredura-feixe" />
            </div>
            <p className="ei-apoio" style={{ margin: "8px 0 0" }}>
              Comparando os cadastros de {vaga.city} com esta vaga…
            </p>
          </div>
        )}
      </div>

      {/* ── AS TRÊS ONDAS, EM CARTÃO — 03/09, refeito em 05/09 ───────────
          A dona: "tem que melhorar a tela das ondas. Não tá intuitivo.
          Faça cards mais bonitos."

          O que estava errado não era só o desenho. As ondas ficavam no PÉ
          da tela, depois de uma lista de quarenta pessoas — medido, 5.639
          pixels abaixo do topo, sete telas de rolagem. A ação que dá nome
          à tela era a última coisa dela, e chegava sem número nenhum: a
          onda 1 pedia mais um toque para dizer quantas pessoas alcança, e
          as 2 e 3 só diziam "sai depois da anterior".

          Agora as ondas vêm primeiro, e cada uma é um cartão que responde
          as três perguntas de quem está decidindo, na ordem em que elas
          são feitas: quem é essa gente (o nome e a faixa), quantos são (o
          número, já contado), e o que dá para fazer (o botão, o estado ou
          o motivo). O número em círculo e o fio que desce ligando os três
          são o que diz, sem texto, que isto é uma escala e não três
          opções soltas.

          A lista de gente continua na tela, embaixo: primeiro se decide,
          depois se confere quem são. */}
      <h2 className="ei-secao">Avisar quem combina</h2>
      <p className="ei-apoio ei-margem" style={{ marginBottom: 4 }}>
        São três ondas por vaga, da que combina mais para a que combina
        menos. Cada uma sai quando você mandar, e não volta.
      </p>

      <div className="ei-ondas">
        {([1, 2, 3] as WaveNumber[]).map((n) => {
          const jaSaiu = ondas.find((o) => o.wave === n);
          const ehAProxima = !jaSaiu && proximaOnda === n && vaga.status === "active";
          const semCota = !jaSaiu && !aindaTemOnda;
          const faixa = FAIXAS_DAS_ONDAS[n];
          const notas = resultado?.get(n) ?? null;

          return (
            <section
              key={n}
              className={`ei-onda ei-onda-${n}${ehAProxima ? " ei-onda-vez" : ""}${
                jaSaiu ? " ei-onda-feita" : ""
              }`}
            >
              <div className="ei-onda-cabeca">
                <span className="ei-onda-numero" aria-hidden="true">
                  {n}
                </span>
                <span className="ei-onda-titulo">
                  <span className="ei-onda-nome">{ONDAS[n].titulo}</span>
                  <span className="ei-onda-faixa">
                    {faixa.de}% a {faixa.ate}% de compatibilidade
                  </span>
                </span>
                {jaSaiu && <span className="ei-selo ei-selo-verde">Disparada</span>}
              </div>

              {/* Quantas pessoas há nesta faixa AGORA. Some quando a conta
                  não veio (banco fora do ar, varredura recém-limpa por uma
                  mudança de critério): escrever "0 pessoas" ali seria
                  inventar a pior notícia possível, e é o defeito que este
                  app já teve com o `podiam_receber`. */}
              {!jaSaiu && notas !== null && (
                <p className="ei-onda-conta">
                  {notas.length === 0 ? (
                    <span className="ei-onda-vazia">Ninguém nesta faixa hoje</span>
                  ) : (
                    <>
                      <strong>
                        {notas.length} {notas.length === 1 ? "pessoa" : "pessoas"}
                      </strong>{" "}
                      esperando o aviso
                    </>
                  )}
                </p>
              )}

              {/* Os percentuais que deram, um a um — a dona pediu "os
                  percentuais de compatibilidade que deu". Sem nome: a
                  função do banco não devolve nenhum, e é o certo — quem se
                  interessar aparece com nome na tela de interessados. Oito
                  é o que cabe em duas linhas sem virar um muro de
                  números. */}
              {!jaSaiu && notas !== null && notas.length > 0 && (
                <span className="ei-onda-notas">
                  {notas.slice(0, 6).map((nota, i) => (
                    <span key={i} className={`ei-onda-pct ${faixaDaNota(nota)}`}>
                      {nota}%
                    </span>
                  ))}
                  {notas.length > 6 && (
                    <span className="ei-apoio">e mais {notas.length - 6}</span>
                  )}
                </span>
              )}

              <p className="ei-onda-nota">{ONDAS[n].resumo}</p>

              {jaSaiu ? (
                <p className="ei-onda-feito">
                  <strong>
                    {jaSaiu.professionals_count === 0
                      ? "Ninguém nesta faixa"
                      : `${jaSaiu.professionals_count} ${
                          jaSaiu.professionals_count === 1
                            ? "pessoa avisada"
                            : "pessoas avisadas"
                        }`}
                  </strong>
                  {/* Data só quando ela existe e é válida. Sem esta
                      guarda a tela escrevia "Invalid Date" em português —
                      apareceu ao passar uma onda vazia, e é o tipo de
                      texto que faz a empresa achar que perdeu o disparo. */}
                  {dataDaOnda(jaSaiu.sent_at) && <> em {dataDaOnda(jaSaiu.sent_at)}</>}
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
                /* ── FAIXA VAZIA NÃO PODE TRANCAR A VAGA — 04/09 ──────
                    Achado exercitando o app como empresa: numa vaga em
                    que ninguém chega a 80%, a onda 1 contava zero, o
                    botão ficava desligado dizendo "não há mais ninguém
                    para avisar" — e as ondas 2 e 3, que alcançam de 40%
                    a 79% e abaixo disso, ficavam trancadas atrás dela
                    com "sai depois da onda anterior".

                    Ou seja: a vaga que mais precisa de alcance era
                    justamente a que não conseguia avisar ninguém, para
                    sempre. E a tela dizia "não há mais ninguém" logo
                    abaixo de uma lista com sessenta pessoas.

                    Agora a faixa vazia é uma PASSAGEM: a onda é
                    registrada com zero pessoas (ninguém recebe aviso
                    nenhum, e é o certo — não há quem) e a próxima
                    destranca. Só na última onda o botão continua
                    desligado, porque aí não há para onde ir. */
                <button
                  className={
                    notas !== null && notas.length === 0
                      ? "ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
                      : "ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                  }
                  disabled={
                    abrindo ||
                    (notas !== null && notas.length === 0 && n === ONDAS_POR_VAGA)
                  }
                  onClick={dispararProximaOnda}
                >
                  {abrindo
                    ? "Avisando…"
                    : notas === null
                      ? "Avisar quem está nesta faixa"
                      : notas.length === 0
                        ? n === ONDAS_POR_VAGA
                          ? "Não há mais ninguém para avisar"
                          : `Ninguém nesta faixa — liberar a onda ${n + 1}`
                        : `Avisar ${notas.length} ${
                            notas.length === 1 ? "pessoa" : "pessoas"
                          }`}
                </button>
              ) : (
                /* Trancada, e o motivo escrito: sem ele o bloco cinza
                   parece defeito. São dois motivos diferentes — a vaga não
                   está no ar, ou a cota de ondas acabou — e trocar um pelo
                   outro manda a empresa procurar a solução errada. */
                <p className="ei-onda-trancada">
                  {vaga.status !== "active"
                    ? "A vaga precisa estar no ar para disparar."
                    : semCota
                      ? `Esta vaga já usou as ${ONDAS_POR_VAGA} ondas dela.`
                      : `Sai depois da onda ${n - 1}.`}
                </p>
              )}
            </section>
          );
        })}
      </div>

      {/* ── A LISTA DE GENTE, DEPOIS DAS ONDAS — 05/09 ──────────────────
          Ela vinha ANTES, por um motivo bom de 04/09 ("primeiro quem são,
          depois avisar"). Só que ela mede 4.552px com quarenta pessoas, e
          empurrava as ondas para fora de qualquer rolagem razoável — o
          bom motivo virou o que escondia a ação.

          A conciliação é o corte: doze na tela, o resto a pedido. Quem
          quer conferir a lista inteira toca em "ver todas" e ela abre;
          quem veio disparar não rola sete telas para achar o botão. */}
      {erroLista && (
        <p className="ei-campo-erro ei-margem" style={{ marginTop: 12 }} role="alert">
          {erroLista}
        </p>
      )}

      {compativeis !== null && !erroLista && (
        <>
          <h2 className="ei-secao">Quem mais combina</h2>
          {compativeis.length > 0 && (
            <p className="ei-apoio ei-margem">
              {compativeis.length}{" "}
              {compativeis.length === 1 ? "pessoa cadastrada" : "pessoas cadastradas"} em{" "}
              {vaga.city}, da que mais combina para a que menos combina. Quem escolheu
              não aparecer na lista de talentos não entra aqui — mas continua recebendo
              o aviso da onda.
            </p>
          )}

          {compativeis.length === 0 ? (
            <p className="ei-apoio ei-margem">
              Ainda não há cadastros em {vaga.city} para comparar com esta vaga.
            </p>
          ) : (
            <div className="ei-lista">
              {compativeis.slice(0, mostrarTodas ? 40 : 12).map((c) => (
                /* O mesmo desenho de linha do banco de talentos (retrato
                   de 64px, nome, ofício), com a nota à direita: é a mesma
                   informação, e duas listas de gente com desenhos
                   diferentes fariam a empresa achar que são coisas
                   diferentes. */
                /* O `?vaga=` não é enfeite de endereço: é ele que faz a ficha do
                   candidato marcar com um visto o que bate com ESTA vaga.
                   Sem ele a empresa abre o perfil e perde de vista por que
                   aquela pessoa apareceu na lista. */
                <Link key={c.id} to={`/profissional/${c.id}?vaga=${vaga.id}`} className="ei-pessoa">
                  <span className="ei-pessoa-retrato" aria-hidden="true">
                    {c.foto ? (
                      <img src={c.foto} alt="" loading="lazy" decoding="async" />
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
                    {/* Os dois selos que mudam a conversa: quem está
                        começando (a vaga pode ser a primeira dessa pessoa)
                        e quem topa bico. Nenhum dos dois entra na nota —
                        eles são declaração da pessoa, não critério. */}
                    {(c.primeiroEmprego || c.pcd) && (
                      <span className="ei-chips" style={{ marginTop: 4 }}>
                        {c.primeiroEmprego && (
                          <span className="ei-selo ei-selo-laranja">1º emprego</span>
                        )}
                        {c.pcd && <span className="ei-selo ei-selo-cinza">PCD</span>}
                      </span>
                    )}
                  </span>
                  <span className={`ei-nota-compat ${faixaDaNota(c.nota)}`}>{c.nota}%</span>
                </Link>
              ))}
            </div>
          )}

          {!mostrarTodas && compativeis.length > 12 && (
            <div className="ei-margem" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="ei-btn ei-btn-contorno ei-btn-largo"
                onClick={() => setMostrarTodas(true)}
              >
                Ver as {Math.min(compativeis.length, 40)} que mais combinam
              </button>
            </div>
          )}

          {mostrarTodas && compativeis.length > 40 && (
            <p className="ei-apoio ei-margem" style={{ marginTop: 8 }}>
              Mostrando as 40 que mais combinam, de {compativeis.length}.
            </p>
          )}
        </>
      )}

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
/** A data do disparo, ou vazio quando o banco não devolveu uma. */
function dataDaOnda(quando: string | null | undefined): string {
  if (!quando) return "";
  const d = new Date(quando);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function faixaDaNota(nota: number): string {
  if (nota >= FAIXAS_DAS_ONDAS[1].de) return "ei-nota-alta";
  if (nota >= FAIXAS_DAS_ONDAS[2].de) return "ei-nota-media";
  return "ei-nota-baixa";
}
