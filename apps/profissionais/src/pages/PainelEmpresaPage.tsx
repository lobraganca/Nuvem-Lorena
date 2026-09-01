import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import {
  obterMinhaEmpresa,
  listarMinhasVagas,
  confirmarTelefoneDaEmpresa,
  situacaoDoPlano,
  contarRespostasDasVagas,
  interessadosDasVagas,
  type InteressadoNoPainel,
} from "../lib/company";
import { mensagemDeErro } from "../lib/erros";
import type { Company, JobListing } from "../types/domain";
import { Callout, Pagina, Prop } from "../components/ei/Pagina";

/**
 * "Ninguém respondeu" / "1 pessoa respondeu" / "4 pessoas responderam".
 *
 * O zero tem frase própria porque "0 pessoas responderam" soa a erro de
 * sistema, e o que aconteceu ali é normal: a vaga acabou de sair.
 */
function textoDeRespostas(n: number): string {
  /* "Interessadas", e não "responderam". Desde a 0078 a pessoa também pode
     responder que a vaga não é para ela, e essa resposta não vira nome no
     painel — contá-la aqui faria a empresa abrir esperando três pessoas
     para encontrar uma. */
  if (n === 0) return "Ninguém se interessou ainda";
  if (n === 1) return "1 pessoa interessada";
  return `${n} pessoas interessadas`;
}

/**
 * A casa da empresa.
 *
 * Ela responde três perguntas, nesta ordem — que é a ordem em que a dúvida
 * aparece de verdade: quanto do meu plano ainda dá para usar, o que eu faço
 * daqui, e quais vagas estão de pé.
 *
 * O cartão do plano é o "saldo" desta tela: número grande no topo e o
 * detalhe numa faixa cinza dentro do próprio cartão. Antes era um botão
 * solto escrito "Assinar para publicar vagas", que dizia o que fazer sem
 * dizer onde a empresa está.
 */
export function PainelEmpresaPage() {
  useTituloDaPagina("Minhas vagas");
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [empresa, setEmpresa] = useState<Company | null>(null);
  const [vagas, setVagas] = useState<JobListing[]>([]);
  /* Quantas pessoas responderam cada vaga. `null` é "não deu para saber" e
     é diferente de zero: um mapa vazio escreveria "ninguém respondeu" em
     vaga cheia, e a empresa concluiria que ninguém quis o trabalho dela. */
  const [respostas, setRespostas] = useState<Map<string, number> | null>(new Map());
  /* Quem se interessou, com nome e rosto. `null` é "não deu para saber" e é
     diferente de lista vazia: uma lista vazia por erro escreveria "ninguém
     se interessou" numa vaga cheia, e a empresa concluiria que ninguém quis
     o trabalho dela. */
  const [interessados, setInteressados] = useState<InteressadoNoPainel[] | null>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  /* `null` enquanto não se sabe. Começar em `false` faria o painel piscar
     "assine" para quem já paga, a cada vez que a tela abre. */
  const [plano, setPlano] = useState<{
    limite: number;
    abertas: number;
    temPlano: boolean;
    cabeMais: boolean;
  } | null>(null);

  /**
   * Confirma o telefone da empresa.
   *
   * Quem confere tudo é o banco. O caso que exige cuidado aqui é o do
   * número que a conta de login NÃO confirmou: a função recusa com uma
   * mensagem técnica, e traduzi-la é o que separa "faça isto" de "deu
   * erro". Sem isso, a empresa fica olhando uma frase sobre código sem
   * saber que o caminho é entrar pelo telefone.
   */
  async function confirmarTelefone() {
    if (!empresa) return;
    setConfirmando(true);
    setErro("");
    try {
      await confirmarTelefoneDaEmpresa(empresa.id);
      await carregarDados();
    } catch (err) {
      const texto = mensagemDeErro(err, "Não foi possível confirmar o telefone.");
      setErro(
        texto.includes("ainda não foi confirmado")
          ? "Para confirmar, sua conta precisa ter entrado com este mesmo número. " +
              "Saia e entre de novo usando o telefone da empresa."
          : texto.includes("diferente")
            ? "O número do cadastro da empresa é diferente do número com que você entrou. " +
                "Ajuste um dos dois para que fiquem iguais."
            : texto
      );
    } finally {
      setConfirmando(false);
    }
  }

  useEffect(() => {
    if (carregandoConta || !user) return;

    carregarDados();
  }, [user, carregandoConta]);

  async function carregarDados() {
    try {
      const minha = await obterMinhaEmpresa(user?.id || "");
      if (!minha) {
        /* ── SEM EMPRESA, O PAINEL LEVA AO CADASTRO ────────────────────
           Isto tinha sido tirado hoje de manhã, porque a dona caía sempre
           no formulário sem saber por quê — mas o defeito real era outro:
           não havia saída dele. Com a saída no lugar ("não é empresa? ir
           para o lado de quem procura trabalho"), o desvio volta, e volta
           a pedido dela:

             "quando a pessoa escolher o painel de empresa, se não tiver
              cadastrado a empresa, tem que cair na tela de cadastro.
              senão ela consegue verificar o banco de talentos e eu não
              consigo ter dados para oferecer planos depois."

           É decisão de negócio, e é dela: o banco de talentos é o que o
           lado da empresa tem de valioso, e entregá-lo a quem não se
           identificou é dar o produto sem saber para quem. */
        navegar("/cadastro-empresa", { replace: true });
        return;
      }
      setEmpresa(minha);

      const minhasVagas = await listarMinhasVagas(minha.id);
      setVagas(minhasVagas);

      /* A contagem vem DEPOIS da lista e num `catch` próprio: é informação
         a mais numa tela que já funciona sem ela. Se a consulta cair, a
         empresa continua vendo as vagas dela — derrubar o painel inteiro
         por causa de um número ao lado do título seria trocar uma tela útil
         por uma mensagem de erro. */
      contarRespostasDasVagas(minhasVagas.map((v) => v.id))
        .then(setRespostas)
        .catch(() => setRespostas(null));

      /* Também depois da lista, e também num `catch` próprio: é informação
         a mais numa tela que já funciona sem ela. Derrubar o painel inteiro
         por causa da lista de nomes seria trocar uma tela útil por uma
         mensagem de erro. */
      interessadosDasVagas(minhasVagas.map((v) => ({ id: v.id, title: v.title })))
        .then(setInteressados)
        .catch(() => setInteressados(null));

      /* O plano decide o texto do botão principal. Se a leitura falhar,
         fica `null` e o botão segue oferecendo criar vaga — quem recusa de
         verdade é o banco, e mandar quem já paga para a tela de preço por
         causa de uma consulta que caiu seria pior que o contrário. */
      setPlano(await situacaoDoPlano(minha.id));
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível carregar os dados."));
    } finally {
      setCarregando(false);
    }
  }

  if (carregandoConta || carregando) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <p className="ei-apoio ei-margem" style={{ paddingTop: 24 }}>Carregando…</p>
        </div>
      </div>
    );
  }

  if (!empresa) {
    /* O painel de quem ainda não cadastrou a empresa. Diz o que falta, o
       que se ganha, e oferece a saída para quem entrou no lado errado. */
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Minhas vagas" />
          <section className="ei-cartao" style={{ marginTop: 12 }}>
            <h2 className="ei-etapa-titulo">Falta cadastrar sua empresa</h2>
            <p className="ei-etapa-apoio">
              São três passos curtos. Depois disso você publica vagas, e o app
              avisa quem faz aquele serviço na cidade.
            </p>
            <Link className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto" to="/cadastro-empresa">
              Cadastrar minha empresa
            </Link>
          </section>
          <p className="ei-apoio ei-margem" style={{ marginTop: 12 }}>
            Você contrata como pessoa física? Também vale — é uma opção dentro do
            cadastro.
          </p>
        </div>
      </div>
    );
  }

  const semPlano = plano?.temPlano === false;
  /* -1 é "sem teto" no banco (`limite_de_vagas_do_plano`). Escrito por
     extenso porque "-1 vagas" na tela é o tipo de coisa que ninguém vê em
     revisão e todo mundo vê em produção. */
  const limiteEmTexto =
    plano == null ? "—" : plano.limite < 0 ? "sem limite" : String(plano.limite);

  return (
    <div className="ei">
      <div className="ei-tela">
        {/* Cabeçalho de página do Notion, e o estado da empresa em
            PROPRIEDADES — rótulo à esquerda, valor à direita.
            ─────────────────────────────────────────────────────
            Era um cartão com tarja, título "Seu plano", o número 3/3 em
            corpo grande e uma faixa cinza embaixo. Dava a um dado de
            ficha o peso de uma manchete, e era o mesmo cartão branco que
            aparecia em toda tela do app.

            Aqui é o que o Notion faz com o estado de uma página: três
            linhas quietas de rótulo e valor, que se lê de relance e não
            se toca. */}
        {/* A ação principal no cabeçalho, e não só numa grade lá embaixo.
            ────────────────────────────────────────────────────────────
            Publicar vaga é a única coisa que uma empresa vem fazer aqui, e
            estava como um dos quatro quadradinhos iguais do meio da tela,
            com o mesmo peso de "Editar empresa". Agora fica onde a mão
            alcança sem rolar e onde o olho chega primeiro.

            Sem plano ele não aparece: quem não pode publicar não deve ver
            um botão que só leva a uma recusa. Para essa empresa o callout
            logo abaixo é que diz o caminho. */}
        <Pagina
          titulo="Minhas vagas"
          acao={
            semPlano ? undefined : (
              <Link
                to="/criar-vaga"
                className="ei-btn ei-btn-cheio ei-btn-mini"
                onClick={(e) => {
                  if (plano && !plano.cabeMais) {
                    e.preventDefault();
                    navegar("/planos-empresa");
                  }
                }}
              >
                {plano && !plano.cabeMais ? "Aumentar plano" : "Nova vaga"}
              </Link>
            )
          }
        >
          {/* ── O RESUMO ABRE A TELA, NÃO A FICHA ──────────────────────
              Vindo dos prints do Conta Azul: a tela de pagamentos abre com
              "Saldo disponível / R$ 10.000,00" — rótulo pequeno em cima,
              número grande embaixo — e só DEPOIS vem a lista. O número que
              a pessoa veio ver ocupa o primeiro lugar da tela.

              Aqui era o contrário. O painel abria com quatro linhas de
              ficha — Empresa, Onde, Plano, Telefone — que nunca mudam, e
              "quantas pessoas se interessaram", que é a única coisa que
              muda e a única razão de a empresa abrir o app, ficava abaixo
              da dobra, depois da lista de vagas.

              A ficha não sumiu: desceu para depois dos atalhos, que é o
              lugar de dado de cadastro. */}
          <div className="ei-resumo">
            <div className="ei-resumo-item">
              <span className="ei-resumo-rotulo">Pessoas interessadas</span>
              <span className="ei-resumo-numero">{interessados?.length ?? 0}</span>
            </div>
            <div className="ei-resumo-item">
              <span className="ei-resumo-rotulo">Vagas no ar</span>
              <span className="ei-resumo-numero">
                {plano?.abertas ?? 0}
                <span className="ei-resumo-de"> de {limiteEmTexto}</span>
              </span>
            </div>
          </div>

        </Pagina>

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 16 }} role="alert">
            {erro}
          </p>
        )}

        {/* O telefone confirmado, antes de qualquer coisa.
            ────────────────────────────────────────────────
            Fica ACIMA de tudo, e não escondido nas configurações, porque é
            o que separa uma empresa de um número digitado — e do lado de
            quem contrata isso pesa mais: quem responde à vaga vai procurar
            essa empresa de volta, e é aí que mora o golpe do falso emprego.

            O caminho de criar vaga continua aceso: quem trava a publicação
            é a própria tela de criação, com o motivo escrito. Travar aqui
            deixaria a empresa olhando um botão cinza sem saber o que fazer
            para acendê-lo. */}
        {!empresa.phone_verified && (
          <Callout atencao>
            <strong>Sem o telefone confirmado a vaga não sai.</strong>{" "}
            <button
              type="button"
              className="ei-btn-inline"
              disabled={confirmando}
              onClick={confirmarTelefone}
            >
              {confirmando ? "Confirmando…" : "Confirmar agora"}
            </button>
          </Callout>
        )}

        {semPlano && (
          <Callout>
            Ver profissionais é grátis. Para publicar vaga e disparar a onda,{" "}
            <Link to="/planos-empresa" className="ei-btn-inline">
              escolha um plano
            </Link>
            .
          </Callout>
        )}

        {/* O que a empresa faz daqui.
            ────────────────────────────
            "Criar nova vaga" entrou aqui porque saiu do cartão do plano,
            que deixou de existir — e sem esta linha o caminho principal da
            empresa ficaria só num link pequeno de cabeçalho de seção.

            Sem vaga sobrando no plano, o toque leva ao plano e não à
            criação: a tela de criar recusaria no fim, depois de a empresa
            ter escrito a vaga inteira. */}
        {/* A grade dos caminhos secundários.
            ───────────────────────────────────
            Ela tinha QUATRO quadrados, e dois iam para o mesmo lugar: com
            o plano cheio, o primeiro virava "Aumentar o plano" e o
            terceiro já era "Planos" — os dois abrindo /planos-empresa,
            lado a lado, com desenhos diferentes. Quem visse isso ia supor
            que fazem coisas diferentes e tocar nos dois para descobrir.

            Agora a ação principal mora no cabeçalho e aqui ficam só os
            caminhos que ela não cobre. "Planos" some quando o cabeçalho já
            está oferecendo aumentar o plano. */}
        <div className="ei-acoes">
          <Link to="/profissionais" className="ei-acao">
            <span className="ei-acao-circulo" aria-hidden="true">
              <IconePessoas />
            </span>
            Profissionais
          </Link>
          {!(plano && !plano.cabeMais) && (
            <Link to="/planos-empresa" className="ei-acao">
              <span className="ei-acao-circulo" aria-hidden="true">
                <IconeSelo />
              </span>
              Planos
            </Link>
          )}
          <Link to="/painel/editar-empresa" className="ei-acao">
            <span className="ei-acao-circulo" aria-hidden="true">
              <IconeLoja />
            </span>
            Editar empresa
          </Link>
        </div>

        {/* Três grupos, e não uma lista só.
            ─────────────────────────────────
            Arquivar uma vaga a fazia SUMIR do painel — junto com a lista de
            quem se interessou por ela. E a tela de arquivar promete o
            contrário, por escrito: "quem já respondeu continua nesta lista".
            A lista continuava mesmo; era o caminho até ela que deixava de
            existir.

            No ar primeiro, porque é o que a empresa vem ver. As encerradas
            por último, porque só se procura por elas quando se procura. */}
        {vagas.length === 0 ? (
          <>
            <div className="ei-secao-linha">
              <h2>Vagas no ar</h2>
              <span className="ei-secao-acao">0</span>
            </div>
            <Callout>
              Publique uma vaga e quem tiver interesse aparece aqui.
            </Callout>
          </>
        ) : (
          GRUPOS_DE_VAGA.map(({ estado, titulo, vazio }) => {
            const doGrupo = vagas.filter((v) => v.status === estado);
            /* Grupo vazio não aparece — menos o das que estão no ar, que
               some do painel de quem tem só vagas arquivadas e aí a tela
               deixa de dizer que dá para publicar. */
            if (doGrupo.length === 0 && estado !== "active") return null;

            return (
              <div key={estado}>
                <div className="ei-secao-linha">
                  <h2>{titulo}</h2>
                  <span className="ei-secao-acao">{doGrupo.length}</span>
                </div>

                {doGrupo.length === 0 ? (
                  <Callout>{vazio}</Callout>
                ) : (
                  /* Lista colada num bloco só, e não um cartão por vaga:
                     cinco cartões soltos com espaço entre eles viram um
                     acordeão, e a empresa quer varrer a lista, não
                     contemplar cada uma. */
                  <div className="ei-lista">
                    {doGrupo.map((vaga) => (
              <Link key={vaga.id} to={`/vaga/${vaga.id}`} className="ei-linha-item">
                <span className="ei-linha-icone" aria-hidden="true">
                  <IconeMala />
                </span>
                <span className="ei-linha-nome">
                  <span className="ei-uma-linha">{vaga.title}</span>
                  {/* Ofício e data, numa linha. A especialidade saiu: com
                      ela a linha quebrava em duas ("Pedreiro · Alvenaria ·"
                      / "29/08/2026") e o item de lista ficava mais alto que
                      os vizinhos. E ela já está no título da vaga. */}
                  {/* O número de respostas vem PRIMEIRO na linha de baixo.
                      É a única coisa que a empresa vem procurar aqui: sem
                      ele, saber se alguém apareceu exigia abrir vaga por
                      vaga e voltar.

                      Escrito por extenso e não como "3": um número solto ao
                      lado de uma data pode ser lido como qualquer coisa.

                      E o ofício saiu desta linha. Com ele os três dados não
                      cabiam e a DATA é que era cortada ("30/0…") — uma data
                      pela metade não informa nada. O ofício é o que menos
                      falta: quase sempre já está no título, como em
                      "Pedreiro para obra no Centro · Pedreiro". */}
                  <span className="ei-linha-sub ei-uma-linha">
                    {respostas !== null && (
                      <>
                        <strong style={{ fontWeight: 600, color: "var(--ei-tinta)" }}>
                          {textoDeRespostas(respostas.get(vaga.id) ?? 0)}
                        </strong>
                        {" · "}
                      </>
                    )}
                    {new Date(vaga.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </span>
                {/* A etiqueta repete o título do grupo de propósito. Quem
                    rola a lista inteira perde de vista sob qual cabeçalho
                    está — e confundir uma vaga pausada com uma no ar é
                    deixar de reabrir a que devia estar recebendo. */}
                {vaga.status === "paused" && (
                  <span className="ei-selo ei-selo-laranja">Pausada</span>
                )}
                {vaga.status === "closed" && (
                  <span className="ei-selo ei-selo-cinza">Encerrada</span>
                )}
                <span className="ei-linha-seta" aria-hidden="true">
                  <IconeSeta />
                </span>
              </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* ── A FICHA, NO FIM ─────────────────────────────────────────
            Ela abria a tela: quatro linhas de cadastro que não mudam nunca,
            ocupando o primeiro lugar. Nos prints do Conta Azul o primeiro
            lugar é do número que a pessoa veio ver — "Saldo disponível / R$
            10.000,00" — e o cadastro não aparece na tela de trabalho.

            Aqui ela vira o que é: dado de consulta, no fim, com título
            próprio. Quem precisa conferir o telefone ou o bairro rola até
            ela; quem veio ver quem respondeu não passa mais por ela. */}
        <h2 className="ei-secao">Dados da empresa</h2>
        <div className="ei-lista">
          <div className="ei-props">
            <Prop rotulo="Empresa">
              <span className="ei-uma-linha">{empresa.company_name}</span>
            </Prop>
            <Prop rotulo="Onde">
              {empresa.neighborhood ? `${empresa.neighborhood} · ` : ""}
              {empresa.city}/{empresa.uf}
            </Prop>
            <Prop rotulo="Plano">
              {semPlano ? (
                <span className="ei-selo ei-selo-cinza">Sem plano</span>
              ) : (
                <>
                  {/* Só o estado. A contagem "3 de 3" já abre a tela, na
                      faixa de resumo — repeti-la aqui é dizer duas vezes o
                      mesmo número com palavras diferentes. */}
                  <span className="ei-selo ei-selo-verde">Ativo</span>
                </>
              )}
            </Prop>
            <Prop rotulo="Telefone">
              {empresa.phone_verified ? (
                <span className="ei-selo ei-selo-verde">Confirmado</span>
              ) : (
                <span className="ei-selo ei-selo-laranja">Falta confirmar</span>
              )}
            </Prop>
          </div>
        </div>

        {/* ── AS PESSOAS INTERESSADAS ─────────────────────────────────────
            A dona: "na tela do empresário ter as vagas que ela
            disponibilizou e as pessoas que interessaram."

            O painel mostrava as vagas e o NÚMERO — "3 pessoas interessadas"
            — e mais nada. Para saber quem eram, a empresa tinha que abrir
            vaga por vaga e voltar. Numa cidade em que as pessoas se
            conhecem, o nome e o rosto são o que ela veio ver: reconhecer
            alguém decide o telefonema antes de qualquer currículo.

            Todas as vagas juntas, e não uma seção por vaga: quem contrata
            olha "quem apareceu hoje", e a vaga de cada pessoa vem escrita
            do lado. */}
        {interessados !== null && interessados.length > 0 && (
          <>
            <div className="ei-secao-linha">
              <h2>Pessoas interessadas</h2>
              <span className="ei-secao-acao">{interessados.length}</span>
            </div>
            <div className="ei-lista">
              {interessados.map((i) =>
                i.cadastroId ? (
                  <Link key={i.id} to={`/profissional/${i.cadastroId}`} className="ei-pessoa">
                    <LinhaDoInteressado i={i} />
                  </Link>
                ) : (
                  /* Sem cadastro visível — quem ficou oculto ou não
                     confirmou o telefone — a linha FICA, porque a pessoa
                     levantou a mão de verdade. O que muda é que não há para
                     onde tocar, e por isso não é um link. */
                  <div key={i.id} className="ei-pessoa">
                    <LinhaDoInteressado i={i} />
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** O retrato, o nome e a vaga em que a pessoa se interessou. */
function LinhaDoInteressado({ i }: { i: InteressadoNoPainel }) {
  return (
    <>
      <span className="ei-pessoa-retrato" aria-hidden="true">
        {i.foto ? (
          <img src={i.foto} alt="" loading="lazy" />
        ) : (
          i.nome.trim().charAt(0).toLocaleUpperCase("pt-BR")
        )}
      </span>
      <span className="ei-pessoa-texto">
        <span className="ei-pessoa-nome ei-uma-linha">{i.nome}</span>
        {/* A VAGA em que ela se interessou, e não o bairro: com três vagas
            abertas ao mesmo tempo, "Joana" sozinha não diz para qual delas
            ela levantou a mão. */}
        <span className="ei-pessoa-oficio ei-uma-linha">{i.vagaTitulo}</span>
      </span>
    </>
  );
}

/* Os três estados de uma vaga, na ordem em que a empresa pensa neles.
   "Encerradas" e não "fechadas": a empresa encerra um processo seletivo,
   não fecha um arquivo. */
const GRUPOS_DE_VAGA = [
  {
    estado: "active" as const,
    titulo: "Vagas no ar",
    vazio: "Publique uma vaga e quem tiver interesse aparece aqui.",
  },
  {
    estado: "paused" as const,
    titulo: "Pausadas",
    vazio: "",
  },
  {
    estado: "closed" as const,
    titulo: "Encerradas",
    vazio: "",
  },
];

/* Os ícones moram aqui e não numa biblioteca: são poucos, e uma dependência
   de ícones custa dezenas de KB para desenhar meia dúzia deles. Todos com
   `stroke="currentColor"`, então herdam a cor de quem os contém — é o que
   deixa o mesmo desenho servir dentro do círculo cinza e fora dele. */
function svgProps() {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function IconePessoas() {
  return (
    <svg {...svgProps()}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16.5 5.4a3.2 3.2 0 0 1 0 5.2" />
      <path d="M17.5 14.2A6 6 0 0 1 21 20" />
    </svg>
  );
}

function IconeSelo() {
  return (
    <svg {...svgProps()}>
      <path d="M12 3l2.6 1.9 3.2-.2.6 3.1 2.3 2.2-1.6 2.8 1.6 2.8-2.3 2.2-.6 3.1-3.2-.2L12 22.6 9.4 20.7l-3.2.2-.6-3.1-2.3-2.2L4.9 12.8 3.3 10l2.3-2.2.6-3.1 3.2.2z" />
      <path d="M9 12.2l2.1 2.1L15.4 10" />
    </svg>
  );
}

function IconeLoja() {
  return (
    <svg {...svgProps()}>
      <path d="M4 9.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19V9.5" />
      <path d="M3 6.5L4.4 3.5h15.2L21 6.5a2.6 2.6 0 0 1-4.5 2 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5-2z" />
      <path d="M9.5 20.5v-5h5v5" />
    </svg>
  );
}

function IconeMegafone() {
  return (
    <svg {...svgProps()} width="30" height="30">
      <path d="M3.5 10v4a1.5 1.5 0 0 0 1.5 1.5h2.5l7 4.5V5.5l-7 4.5H5A1.5 1.5 0 0 0 3.5 10z" />
      <path d="M18 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M7.5 15.5v3.2a1.3 1.3 0 0 0 1.3 1.3h1" />
    </svg>
  );
}

function IconeMala() {
  return (
    <svg {...svgProps()}>
      <rect x="2.5" y="7.5" width="19" height="12" rx="2.5" />
      <path d="M8.5 7.5V5.8a1.8 1.8 0 0 1 1.8-1.8h3.4a1.8 1.8 0 0 1 1.8 1.8v1.7" />
      <path d="M2.5 12.5h19" />
    </svg>
  );
}

function IconeSeta() {
  return (
    <svg {...svgProps()} width="20" height="20" strokeWidth={2.2}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

