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
import { BotaoCompartilhar } from "../components/ei/BotaoCompartilhar";
import { podeVender } from "../lib/plataforma";
import { SUPORTE_WHATSAPP } from "../config";
import {
  vagaEmDestaque,
  diasDeDestaqueRestantes,
  precoDoDestaqueDeVagaEmTexto,
  DESTAQUE_DIAS,
} from "../lib/destaque";
import {
  ONDAS,
  ONDAS_POR_VAGA,
  type JobListing,
  type JobDispatch,
  type WaveNumber,
} from "../types/domain";

/**
 * O que fazer AGORA com esta vaga.
 *
 * ── Por que existe ────────────────────────────────────────────────────
 *
 * A tela mostrava números — avisadas, interessadas, dias no ar — e parava
 * ali. Números não dizem o que fazer: "40 avisadas, 0 interessadas" é
 * ótimo no primeiro dia e é a vaga que ninguém quis na terceira semana, e
 * a diferença entre as duas leituras é justamente o que a empresa não tem
 * como saber.
 *
 * Então a tela passa a dizer, em uma linha, qual é o próximo passo — e a
 * levar até ele. É a mesma informação que já estava na tela, lida por
 * quem sabe lê-la.
 *
 * Devolve `null` quando não há passo nenhum (vaga encerrada): uma
 * sugestão inventada para preencher espaço vale menos que espaço vazio.
 */
function proximoPasso(
  vaga: JobListing,
  interessadas: number,
  ondasDisparadas: number,
  diasNoAr: number
): { texto: string; rotulo: string; para: string } | null {
  if (vaga.status === "closed") return null;

  if (vaga.status === "paused") {
    return {
      texto: "Esta vaga está pausada — ninguém está vendo ela na busca.",
      rotulo: "Como reabrir",
      para: "#gerenciar",
    };
  }

  /* Gente esperando resposta vem antes de tudo: é a única coisa desta
     tela que estraga com o tempo. */
  if (interessadas > 0) {
    return {
      texto:
        interessadas === 1
          ? "1 pessoa se interessou e está esperando você chamar."
          : `${interessadas} pessoas se interessaram e estão esperando você chamar.`,
      rotulo: "Ver quem é",
      para: `/vaga/${vaga.id}/interessados`,
    };
  }

  if (ondasDisparadas === 0) {
    return {
      texto: "Ninguém foi avisado ainda — a vaga está no ar, mas parada.",
      rotulo: "Avisar as pessoas",
      para: `/vaga/${vaga.id}/compativeis`,
    };
  }

  /* Dois dias de silêncio não são um problema, são o normal — e mandar a
     empresa mexer na vaga por causa disso a faria refazer o texto de uma
     vaga que ainda nem foi lida. */
  if (diasNoAr <= 2) {
    return {
      texto: "As pessoas foram avisadas há pouco. Vale dar um ou dois dias.",
      rotulo: "Ver quem foi avisado",
      para: `/vaga/${vaga.id}/compativeis`,
    };
  }

  if (ondasDisparadas < ONDAS_POR_VAGA) {
    return {
      texto: "Ninguém respondeu ainda. Dá para avisar mais gente.",
      rotulo: "Avisar mais gente",
      para: `/vaga/${vaga.id}/compativeis`,
    };
  }

  /* Acabaram as ondas e ninguém respondeu: o que sobra para mexer é a
     própria vaga — salário, jeito de trabalho, exigências. */
  return {
    texto:
      "Todo mundo já foi avisado e ninguém respondeu. Vale rever o salário ou o que a vaga exige.",
    rotulo: "Editar a vaga",
    para: `/vaga/${vaga.id}/editar`,
  };
}

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
  /* "Tirar do ar" abre as três saídas escritas (pausar, encerrar, apagar)
     em vez de deixar três botões soltos na tela — ver o comentário do
     bloco "Gerenciar a vaga". */
  const [saindoDoAr, setSaindoDoAr] = useState(false);
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
  /* O destaque pago desta vaga (0116). Lido do próprio objeto da vaga:
     quem liga é a administração, então a tela só precisa saber se está
     valendo e por quanto tempo. */
  const emDestaque = vagaEmDestaque(vaga);
  const diasDeDestaque = diasDeDestaqueRestantes(vaga.destaque_ate);

  /* Dias inteiros desde a publicação, e nunca negativo: um relógio
     adiantado no celular faria a tela dizer "no ar há -1 dias". */
  const diasNoAr = Math.max(
    0,
    Math.floor((Date.now() - new Date(vaga.created_at).getTime()) / 86_400_000)
  );

  const passo = proximoPasso(vaga, respostas.length, ondas.length, diasNoAr);

  return (
    <div className="ei">
      <div className="ei-tela detalhe-vaga">
        {/* Era a última tela no desenho velho: cartões cinzas, "Descrição:"
            com dois-pontos, um botão AZUL (o último do app) e "Voltar" duas
            vezes — em cima e embaixo. A migalha do cabeçalho de página faz
            o trabalho dos dois botões, e faz melhor: diz onde a pessoa
            está, não só que dá para sair. */}
        {/* O compartilhar mora na barra de topo, e não entre os botões de
            ação: Editar, Pausar e Arquivar mexem NA vaga; mandar o link
            para alguém não mexe em nada, e misturado com os outros três
            seria o quarto botão de uma fileira em que os outros mudam o
            estado da coisa. */}
        <Pagina
          titulo={vaga.title}
          voltar="/painel-empresa"
          acao={
            <BotaoCompartilhar
              titulo={vaga.title}
              texto={`Vaga de ${vaga.profession || vaga.title} em ${vaga.city}. Veja no Ei Emprego:`}
              caminho={`/vaga-aberta/${vaga.id}`}
              rotulo=""
            />
          }
        >
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
          <div className="ei-cartao-vaga">
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

          {/* ── TUDO DA VAGA NUM CARTÃO SÓ — 04/09 ────────────────────
              A dona: "essa tela ainda está confusa, desalinhada. Coloque as
              informações da vaga dentro de um card só."

              Eram três blocos brancos soltos, com chão cinza entre eles: a
              ficha, os números e — separada, sem cartão nenhum — a
              descrição escrita pela empresa, boiando no cinza como se
              fosse de outro assunto.

              Agora é um cartão do começo ao fim: ficha, números e
              descrição, separados por fios em vez de por vãos. Um assunto,
              um cartão. */}
          {vaga.description?.trim() && (
            <p className="ei-vaga-descricao">{vaga.description}</p>
          )}
          </div>
        </Pagina>

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 12 }} role="alert">
            {erro}
          </p>
        )}

      {/* A linha que diz o que fazer agora. Fica colada no cartão, antes
          de qualquer botão: é a leitura dos números que estão logo acima,
          feita pelo app em vez de pela empresa. */}
      {passo && (
        <Link className="ei-passo" to={passo.para}>
          <span className="ei-passo-texto">{passo.texto}</span>
          <span className="ei-passo-acao">{passo.rotulo}</span>
        </Link>
      )}

      {/* ── O QUE A EMPRESA VEIO FAZER VEM PRIMEIRO — 04/09 ──────────
          A dona: "a tela da vaga na sessão de vagas no ar está horrível.
          Sem alinhamento e as funcionalidades confusas demais."

          A ordem estava de trás para frente. Logo abaixo da ficha vinham
          Editar, Pausar, Arquivar e Excluir — quatro botões de
          MANUTENÇÃO — e só no fim da rolagem as duas portas com as
          pessoas, que é o motivo de alguém abrir uma vaga. Quem entrava
          para ver quem se interessou passava por três maneiras diferentes
          de tirar a vaga do ar antes de chegar lá.

          Agora: as pessoas primeiro, o destaque depois, e a manutenção no
          fim — que é onde a pessoa procura quando já resolveu o assunto
          principal. */}
      <h2 className="ei-secao">As pessoas</h2>
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

        {/* ── A SEGUNDA PORTA VIROU AS PESSOAS — 04/09 ──────────────
            A dona: "no painel da empresa, ter duas opções: quem se
            interessou pela vaga e as pessoas que são mais compatíveis com
            a vaga."

            Ela se chamava "Ondas de aviso" e prometia um mecanismo, não
            gente: a empresa abria esperando ver quem era e encontrava três
            botões de disparo. Agora a porta promete as PESSOAS — que é o
            que a empresa quer — e o disparo continua lá dentro, embaixo da
            lista, onde ele faz sentido: primeiro se olha, depois se
            avisa. */}
        <Link to={`/vaga/${vaga.id}/compativeis`} className="ei-porta">
          <span className="ei-porta-nome">Mais compatíveis com a vaga</span>
          <span className="ei-porta-nota">
            Quem mais combina, em ordem
            {ondas.length === 0
              ? ` · nenhuma das ${ONDAS_POR_VAGA} ondas disparada`
              : ` · ${ondas.length} de ${ONDAS_POR_VAGA} ondas disparadas`}
            {aindaTemOnda && vaga.status === "active" ? " · dá para avisar mais gente" : ""}
          </span>
        </Link>
      </div>

      {/* ── DESTACAR ESTA VAGA — 04/09 ─────────────────────────────────
          A dona: "também opção de dar destaque a uma vaga" — R$ 19,90 por
          7 dias.

          Fica aqui, na tela da vaga, e não na de planos: a decisão de
          destacar é sobre ESTA vaga, tomada quando a empresa olha os
          números dela e vê que ninguém apareceu. Na tela de planos seria
          uma quarta caixa de preço no meio de três.

          Some inteiro dentro do app da Play Store (`podeVender`), como a
          tela de planos: a Google não permite vender bem digital por fora
          da cobrança dela, e mostrar o preço já conta como vender. */}
      {podeVender() && vaga.status === "active" && (
        <>
          <h2 className="ei-secao">Aparecer primeiro</h2>
          <div className="ei-cartao">
            {emDestaque ? (
              <>
                <p className="ei-corpo" style={{ marginTop: 0 }}>
                  <strong>Esta vaga está no topo do banco de vagas.</strong>{" "}
                  {diasDeDestaque === 1
                    ? "Termina amanhã."
                    : `Faltam ${diasDeDestaque} dias.`}
                </p>
                <p className="ei-apoio" style={{ marginBottom: 0 }}>
                  Quem procura vê o selo “Em destaque” do lado do título.
                </p>
              </>
            ) : (
              <>
                <div className="ei-plano-linha">
                  <span className="ei-plano-nome">Vaga em destaque</span>
                  <span className="ei-plano-preco">
                    {precoDoDestaqueDeVagaEmTexto()}
                    <span className="ei-plano-ciclo"> / {DESTAQUE_DIAS} dias</span>
                  </span>
                </div>
                <ul className="ei-plano-lista">
                  <li>Sua vaga no topo do banco de vagas por {DESTAQUE_DIAS} dias</li>
                  <li>Selo “Em destaque” do lado do título</li>
                  <li>Acaba sozinho: não vira assinatura e não cobra de novo</li>
                </ul>
                <a
                  className="ei-btn-laranja"
                  style={{ margin: 0, width: "100%" }}
                  href={`https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(
                    `Olá! Quero destacar a vaga "${vaga.title}" por ${DESTAQUE_DIAS} dias (${precoDoDestaqueDeVagaEmTexto()}).`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Quero destacar esta vaga
                </a>
                {/* A explicação do Pix saiu a pedido da dona (04/09): ela
                    contava o bastidor do pagamento numa tela que é sobre a
                    vaga, e bastidor não é assunto de quem está comprando.
                    O botão já diz o que faz. */}
              </>
            )}
          </div>
        </>
      )}

      {/* ── UMA SAÍDA SÓ, EM VEZ DE TRÊS — 04/09 ────────────────────────
          A dona: "as funcionalidades confusas demais."

          Aqui havia quatro botões iguais numa grade: Editar, Pausar,
          Arquivar e, embaixo, Excluir. Três deles fazem a MESMA coisa aos
          olhos de quem usa — tiram a vaga do ar — e a diferença entre eles
          (uma volta, outra libera vaga do plano, a terceira apaga a lista
          de interessados) não estava escrita em lugar nenhum: morava num
          `title`, que no celular ninguém vê, porque não há para onde
          apontar o mouse.

          Escolher entre três palavras sem saber o que cada uma faz é o
          caminho mais curto para a empresa apagar por engano a lista de
          gente que ela pagou para receber.

          Agora são DUAS ações: "Editar" e "Tirar do ar". A segunda abre a
          pergunta com as três saídas escritas por extenso, uma linha cada,
          dizendo a consequência — que é a informação que decide. */}
      <h2 className="ei-secao" id="gerenciar">Gerenciar a vaga</h2>
      {/* Com a pergunta aberta, "Editar" fica sozinho: numa grade de duas
          colunas ele viraria um botão de meia largura ao lado de um vão
          vazio. Sozinho, ocupa a linha. */}
      <div className={saindoDoAr ? "ei-margem ei-acoes-vaga ei-acoes-vaga-uma" : "ei-margem ei-acoes-vaga"}>
        <Link className="ei-btn ei-btn-contorno" to={`/vaga/${vaga.id}/editar`}>
          Editar a vaga
        </Link>

        {vaga.status === "active" && !saindoDoAr && (
          <button
            className="ei-btn ei-btn-contorno"
            onClick={() => {
              setErro("");
              setSaindoDoAr(true);
            }}
            disabled={fechando}
          >
            Tirar do ar
          </button>
        )}

        {/* Reabrir continua sozinho e cheio: numa vaga fora do ar é a
            única coisa que a empresa costuma querer, e escondê-la atrás de
            uma pergunta seria esconder justamente a saída. */}
        {vaga.status !== "active" && (
          <button
            className="ei-btn ei-btn-cheio"
            onClick={() => mudarEstado(() => reabrirVaga(vaga.id), "Não foi possível reabrir a vaga.")}
            disabled={fechando}
          >
            {fechando ? "Reabrindo…" : "Colocar no ar de novo"}
          </button>
        )}
        {vaga.status !== "active" && (
          <p className="ei-apoio" style={{ margin: 0, gridColumn: "1 / -1" }}>
            Reabrir ocupa uma vaga do seu plano de novo.
          </p>
        )}
      </div>

      {/* As três saídas, escritas. A ordem é da mais leve para a mais
          grave, e a grave é a única que exige um segundo toque. */}
      {saindoDoAr && (
        <div className="ei-margem ei-saidas">
          <button
            className="ei-saida"
            onClick={() => mudarEstado(() => pausarVaga(vaga.id), "Não foi possível pausar a vaga.")}
            disabled={fechando}
          >
            <span className="ei-saida-nome">Pausar por enquanto</span>
            <span className="ei-saida-nota">
              Some da busca e volta quando você quiser. Continua ocupando
              uma vaga do seu plano.
            </span>
          </button>

          <button
            className="ei-saida"
            onClick={() => mudarEstado(() => arquivarVaga(vaga.id), "Não foi possível arquivar a vaga.")}
            disabled={fechando}
          >
            <span className="ei-saida-nome">Já contratei — encerrar</span>
            <span className="ei-saida-nota">
              Libera uma vaga do seu plano. A lista de quem se interessou
              fica guardada, em “Encerradas”.
            </span>
          </button>

          {/* ── A CONFIRMAÇÃO SAIU DO `window.confirm` — 03/09 ────────────
              Era uma janelinha do navegador. Dentro do app instalado ela
              não aparece em alguns aparelhos, e o que sobra é o pior
              caminho possível: um toque em "Excluir" apagando a vaga e a
              lista de interessados na hora, sem pergunta nenhuma.

              A pergunta é a própria tela, e ela DIZ O NÚMERO — "Tem
              certeza?" não informa nada; saber que três pessoas
              interessadas somem junto é o que faz parar e escolher
              encerrar. */}
          {!confirmandoExclusao ? (
            <button
              className="ei-saida ei-saida-grave"
              onClick={() => {
                setErro("");
                setConfirmandoExclusao(true);
              }}
              disabled={fechando}
            >
              <span className="ei-saida-nome">Apagar de vez</span>
              <span className="ei-saida-nota">
                {respostas.length > 0
                  ? `Apaga a vaga e ${
                      respostas.length === 1
                        ? "a pessoa interessada"
                        : `as ${respostas.length} pessoas interessadas`
                    } nela. Não dá para desfazer.`
                  : "Apaga a vaga de vez. Não dá para desfazer."}
              </span>
            </button>
          ) : (
            <div className="ei-saida ei-saida-grave ei-saida-confirma">
              <span className="ei-saida-nome">
                {respostas.length > 0
                  ? `Apagar leva junto ${
                      respostas.length === 1
                        ? "a pessoa interessada"
                        : `as ${respostas.length} pessoas interessadas`
                    }. Tem certeza?`
                  : "Apagar não tem volta. Tem certeza?"}
              </span>
              <button
                className="ei-btn ei-btn-contorno ei-btn-largo"
                onClick={excluirVagaFunc}
                disabled={fechando}
                style={{ color: "var(--ei-erro)" }}
              >
                {fechando ? "Apagando…" : "Sim, apagar esta vaga"}
              </button>
            </div>
          )}

          <button
            className="ei-btn ei-btn-texto"
            onClick={() => {
              setConfirmandoExclusao(false);
              setSaindoDoAr(false);
            }}
            disabled={fechando}
          >
            Deixar como está
          </button>
        </div>
      )}


      </div>
    </div>
  );
}

