import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { mensagemDeErro } from "../../lib/erros";
import { marcarVagaComoVista, todosOsAvisos, type Aviso } from "../../lib/minhasVagas";
import { pedirPermissaoDePush, pushServeAqui, situacaoDaPermissao } from "../../lib/push";
import { Callout, Pagina } from "../../components/ei/Pagina";
import { nomeDoContrato, salarioEmTexto } from "../../types/domain";
import { IconeInicio } from "../../components/IconesInicio";

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

  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  /* Quais chegaram sem terem sido vistas ANTES desta visita. Guardado à
     parte porque a primeira coisa que a tela faz é marcar tudo como visto —
     se o selo lesse `visto_em`, ele sumiria no mesmo instante em que a
     pessoa abriu, sem nunca ter sido visto por ela. */
  const [novos, setNovos] = useState<Set<string>>(new Set());
  const [ligandoAviso, setLigandoAviso] = useState(false);
  const [avisoLigado, setAvisoLigado] = useState(false);

  useEffect(() => {
    if (carregandoConta) return;
    if (!user) {
      navegar("/login?lado=trabalhar", { replace: true });
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
  }, [user, carregandoConta, navegar]);

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
          <p className="ei-apoio ei-margem" style={{ paddingTop: 24 }}>Carregando…</p>
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
            Quer receber no celular assim que chegar vaga do seu ofício?{" "}
            <button
              type="button"
              className="ei-btn-inline"
              disabled={ligandoAviso}
              onClick={ligarAviso}
            >
              {ligandoAviso ? "Ligando…" : "Ligar o aviso"}
            </button>
          </Callout>
        )}

        {avisos.length === 0 ? (
          <Callout>
            Ainda não chegou nenhum aviso. Assim que uma empresa publicar vaga do seu
            ofício em Itabirito, ela aparece aqui — e no seu celular, se o aviso
            estiver ligado.
          </Callout>
        ) : (
          <div className="ei-lista">
            {avisos.map((a) => {
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
        )}
      </div>
    </div>
  );
}
