import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { mensagemDeErro } from "../../lib/erros";
import { marcarVagaComoVista, todosOsAvisos, type Aviso } from "../../lib/minhasVagas";
import { useOnboardingStatus } from "../../lib/useOnboardingStatus";
import {
  avisosDeCandidatura,
  marcarCandidaturasComoLidas,
  type AvisoDeCandidatura,
} from "../../lib/company";
import { pedirPermissaoDePush, pushServeAqui, situacaoDaPermissao } from "../../lib/push";
import { Callout, Pagina } from "../../components/ei/Pagina";
import { nomeDoContrato, salarioEmTexto } from "../../types/domain";
import { IconeInicio } from "../../components/IconesInicio";
import Esqueleto from "../../components/ei/Esqueleto";

/**
 * Os avisos: tudo o que chegou para esta pessoa pelos disparos.
 *
 * ── Por que existe, separado de "Vagas" ───────────────────────────────
 *
 * A dona: "na barra, vagas, meu perfil e conta, coloque também as
 * notificações que as pessoas receberem dos disparos."
 *
 * "Vagas" é o que dá para RESPONDER: só vaga aberta, porque uma vaga que já
 * encheu naquela lista é pior que lista vazia — a pessoa se anima, responde
 * e não recebe resposta nenhuma.
 *
 * Só que essa regra tem um custo que ninguém enxergava: **o aviso some**. A
 * pessoa recebe a notificação no celular, demora dois dias para abrir o
 * app, a empresa já encerrou — e não há nada. Nem a vaga, nem o registro de
 * que ela existiu. Fica parecendo que a notificação foi engano do app.
 *
 * Aqui está o histórico inteiro, na ordem em que chegou: o que a pessoa
 * recebeu, o que ela respondeu, e o que aconteceu com cada vaga.
 *
 * ── O selo de "novas" existia e nunca aparecia ────────────────────────
 *
 * `quantasVagasNovas` estava escrita desde o começo, com o comentário "para
 * o aviso no menu", e não era chamada em lugar nenhum. O contador existia;
 * o menu que ele servia, não.
 */
export function AvisosPage() {
  useTituloDaPagina("Avisos");
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();
  /* Esta tela tem DOIS donos.
     ─────────────────────────
     A dona: "toda pessoa que se candidata em uma vaga que você anunciou
     deve receber uma notificação e essa vai pro painel dos avisos."

     Do lado de quem procura trabalho, aviso é vaga que chegou pela onda.
     Do lado de quem contrata, é gente que se candidatou. São duas listas
     de coisas diferentes com o mesmo nome — e é o mesmo nome de propósito:
     "avisos" é onde a pessoa vai procurar novidade, seja de que lado for.

     Duas telas separadas seriam duas entradas na barra de baixo para o
     mesmo botão, e a barra já decide o que mostrar pelo lado. */
  const lado = useOnboardingStatus();
  const empresa = lado === "company";

  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  /* Quais chegaram sem terem sido vistas ANTES desta visita. Guardado à
     parte porque a primeira coisa que a tela faz é marcar tudo como visto —
     se o selo lesse `visto_em`, ele sumiria no mesmo instante em que a
     pessoa abriu, sem nunca ter sido visto por ela. */
  const [novos, setNovos] = useState<Set<string>>(new Set());
  const [candidaturas, setCandidaturas] = useState<AvisoDeCandidatura[]>([]);
  const [ligandoAviso, setLigandoAviso] = useState(false);
  const [avisoLigado, setAvisoLigado] = useState(false);

  useEffect(() => {
    if (carregandoConta) return;
    if (!user) {
      navegar("/login?lado=trabalhar", { replace: true });
      return;
    }

    /* `lado` ainda nulo é "não sei de que lado esta pessoa está" — não é
       "profissional". Carregar a lista errada aqui faria a empresa ver, por
       um instante, um "você ainda não recebeu nenhum aviso" que não é dela. */
    if (lado === null) return;

    if (empresa) {
      avisosDeCandidatura(user.id)
        .then((lista) => {
          setCandidaturas(lista);
          /* Quem estava "Novo" ANTES desta visita fica guardado à parte: a
             primeira coisa que a tela faz é marcar tudo como lido, e um selo
             que lesse o banco sumiria no mesmo instante em que a pessoa
             abriu — sem nunca ter sido visto. */
          setNovos(new Set(lista.filter((c) => c.novo).map((c) => c.id)));
          marcarCandidaturasComoLidas(lista.filter((c) => c.novo).map((c) => c.id));
        })
        .catch((err) => {
          setErro(mensagemDeErro(err, "Não consegui carregar seus avisos."));
        })
        .finally(() => setCarregando(false));
      return;
    }

    todosOsAvisos(user.id)
      .then((lista) => {
        setAvisos(lista);
        setNovos(new Set(lista.filter((a) => !a.visto_em).map((a) => a.aviso_id)));
        lista.filter((a) => !a.visto_em).forEach((a) => marcarVagaComoVista(a.aviso_id));
      })
      .catch((err) => {
        /* Erro NUNCA vira lista vazia. "Você não recebeu nenhum aviso" e
           "não consegui ler os avisos" são a mesma tela e coisas opostas —
           e a primeira faz a pessoa concluir que não aparece vaga na
           cidade. */
        setErro(mensagemDeErro(err, "Não consegui carregar seus avisos."));
      })
      .finally(() => setCarregando(false));
  }, [user, carregandoConta, navegar, lado, empresa]);

  async function ligarAviso() {
    setLigandoAviso(true);
    setErro("");
    const deu = await pedirPermissaoDePush();
    setAvisoLigado(deu);
    if (!deu) {
      setErro(
        "Não consegui ligar o aviso neste aparelho. Você continua vendo tudo aqui " +
          "sempre que abrir o app."
      );
    }
    setLigandoAviso(false);
  }

  if (carregandoConta || carregando) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Esqueleto />
        </div>
      </div>
    );
  }

  /* O lado da empresa: quem se candidatou, do mais recente para o mais
     antigo, com o caminho para a vaga (é lá que estão o telefone e o resto
     da triagem). Sem push por enquanto — o pedido foi o painel. */
  if (empresa) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Avisos" />

          {erro && (
            <p className="ei-campo-erro ei-margem" style={{ marginTop: 12 }} role="alert">
              {erro}
            </p>
          )}

          {candidaturas.length === 0 ? (
            <Callout>
              Ainda não se candidatou ninguém. Assim que alguém disser que tem interesse
              numa vaga sua, o nome aparece aqui.
            </Callout>
          ) : (
            <div className="ei-lista">
              {candidaturas.map((c) => (
                /* ── O AVISO ABRE O PERFIL, NÃO A VAGA — 04/09 ──────────
                   A dona: "o aviso que chega pra empresa é que uma pessoa
                   se interessou pela vaga que você publicou e ter opção
                   dele abrir e verificar o perfil e marcar se gostou."

                   Ia para `/vaga/{id}` — a ficha da vaga, que a empresa
                   escreveu e já conhece. O que ela quer ver ao receber o
                   aviso é QUEM se interessou. O `?resposta=` leva junto a
                   candidatura, e é ele que acende os botões de triagem lá
                   dentro. Sem cadastro visível não há perfil para abrir, e
                   o caminho continua sendo a vaga. */
                <Link
                  key={c.id}
                  to={
                    c.cadastroId
                      ? `/profissional/${c.cadastroId}?resposta=${c.id}`
                      : `/vaga/${c.vagaId}`
                  }
                  className="ei-linha-item"
                >
                  <span className="ei-empresa-marca" aria-hidden="true">
                    {c.foto ? (
                      <img src={c.foto} alt="" loading="lazy" />
                    ) : (
                      c.nome.trim().charAt(0).toLocaleUpperCase("pt-BR")
                    )}
                  </span>

                  <span className="ei-linha-nome">
                    <span className="ei-uma-linha">{c.nome}</span>
                    {/* O aviso DIZ o que aconteceu, e não só mostra dois
                        nomes soltos — a dona pediu a frase inteira: "uma
                        pessoa se interessou pela vaga que você publicou".
                        Nome em cima porque numa cidade pequena é ele que
                        decide se a empresa liga hoje ou amanhã. */}
                    {/* Esta linha PODE quebrar em duas — é a única do
                        cartão sem `ei-uma-linha`. O nome da vaga cortado
                        ("se interessou por “Pedreiro p…”") esconde
                        justamente o que a empresa precisa para saber de
                        qual das três vagas dela se trata. */}
                    <span className="ei-linha-sub">
                      se interessou por “{c.vagaTitulo}”
                    </span>
                    <span className="ei-linha-sub ei-uma-linha">
                      {c.bairro ? `${c.bairro} · ` : ""}toque para ver o perfil
                    </span>
                    <span className="ei-linha-sub ei-uma-linha">
                      {c.quando
                        ? new Date(c.quando).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })
                        : ""}
                    </span>
                  </span>

                  {novos.has(c.id) && <span className="ei-selo ei-selo-laranja">Novo</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const permissao = situacaoDaPermissao();
  const podeOferecerAviso =
    pushServeAqui() && permissao === "default" && !avisoLigado && avisos.length > 0;

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="Avisos" />

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 12 }} role="alert">
            {erro}
          </p>
        )}

        {podeOferecerAviso && (
          <Callout icone={<IconeInicio nome="sino" tamanho={17} />}>
            {/* O botão numa linha própria, e não colado no fim da
                pergunta: uma pastilha de 36px dentro de um parágrafo de
                14px dobra o vão da linha em que cai, e a faixa inteira
                parece estourada. Ver o mesmo conserto em
                VagasParaMimPage. */}
            Quer receber no celular assim que chegar vaga do seu ofício?
            <span className="ei-callout-acao">
              <button
                type="button"
                className="ei-btn-inline"
                disabled={ligandoAviso}
                onClick={ligarAviso}
              >
                {ligandoAviso ? "Ligando…" : "Ligar o aviso"}
              </button>
            </span>
          </Callout>
        )}

        {avisos.length === 0 ? (
          <Callout>
            Ainda não chegou nenhum aviso. Assim que uma empresa publicar vaga do seu
            ofício em Itabirito, ela aparece aqui — e no seu celular, se o aviso
            estiver ligado.
          </Callout>
        ) : (
          /* POR QUE estas vagas estão aqui, dito uma vez no alto — a dona:
             "o aviso que chega pro funcionário é que uma vaga foi publicada
             e que o perfil dele se adequa ao seu."

             Uma vez, e não em cada linha: repetir "combina com você" em
             dez cartões vira ruído e empurra para baixo o salário, que é o
             que a pessoa usa para decidir se abre. */
          <>
            <p className="ei-apoio ei-margem" style={{ marginTop: 10, marginBottom: 4 }}>
              Estas vagas foram publicadas agora e combinam com o seu cadastro.
            </p>
          {/* ── O QUE VOCÊ JÁ RECUSOU DESCE — 04/09 ──────────────────
              A dona apontou isto do lado da empresa ("as pessoas que você
              não acha interessante ainda continuam na tela"), e o mesmo
              defeito estava aqui, do lado de quem procura: a vaga marcada
              como "não quis" continuava no meio das outras, na mesma
              ordem, para sempre. Quem recusa três vagas relê as três toda
              vez que abre os avisos.

              Ela não some — sumir faria a pessoa achar que o app perdeu a
              vaga, e existe quem mude de ideia. Ela vai para o fim, com o
              selo que já tinha, e o que ainda espera resposta fica em
              cima, que é onde o polegar chega primeiro. */}
          <div className="ei-lista">
            {[...avisos]
              .sort(
                (x, y) =>
                  Number(x.interessado === false) - Number(y.interessado === false)
              )
              .map((a) => {
              const salario = salarioEmTexto(a.vaga);
              const contrato = nomeDoContrato(a.vaga.tipo_contrato);
              return (
                <Link
                  key={a.aviso_id}
                  to={`/vaga-aberta/${a.vaga.id}`}
                  className="ei-linha-item"
                >
                  <span className="ei-empresa-marca" aria-hidden="true">
                    {a.empresa_foto ? (
                      <img src={a.empresa_foto} alt="" loading="lazy" />
                    ) : (
                      a.empresa.trim().charAt(0).toLocaleUpperCase("pt-BR")
                    )}
                  </span>

                  <span className="ei-linha-nome">
                    <span className="ei-uma-linha">{a.vaga.title}</span>
                    {/* DUAS linhas de apoio, e não uma.
                        ──────────────────────────────────
                        Empresa, salário e contrato numa linha só não cabiam
                        em 390px: o salário era cortado no meio ("R$ 180
                        a …"), que é justamente o dado que a pessoa usa para
                        decidir se abre. Meio salário não informa nada.

                        Quem é e quando chegou em cima; quanto paga e como
                        contrata embaixo. A data vai sem o ano — são avisos
                        recentes, e "2026" ocupava o espaço do resto. */}
                    <span className="ei-linha-sub ei-uma-linha">
                      {a.empresa} ·{" "}
                      {new Date(a.criado_em).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                    <span className="ei-linha-sub ei-uma-linha">
                      {salario ?? "Salário não informado"}
                      {contrato ? ` · ${contrato}` : ""}
                    </span>
                  </span>

                  {/* O QUE ACONTECEU com este aviso — é a razão de a tela
                      existir. Sem isto seria a mesma lista de "Vagas" com
                      outro nome. */}
                  {novos.has(a.aviso_id) && !a.respondida && (
                    <span className="ei-selo ei-selo-laranja">Novo</span>
                  )}
                  {a.interessado === true && (
                    <span className="ei-selo ei-selo-verde">Tenho interesse</span>
                  )}
                  {a.interessado === false && (
                    <span className="ei-selo ei-selo-cinza">Não quis</span>
                  )}
                  {!a.aberta && <span className="ei-selo ei-selo-cinza">Encerrada</span>}
                </Link>
              );
            })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
