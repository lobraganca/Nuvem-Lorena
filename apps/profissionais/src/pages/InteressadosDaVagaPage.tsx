import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  obterVaga,
  obterRespostasDaVaga,
  marcarResposta,
  type RespostaComPessoa,
} from "../lib/company";
import { mensagemDeErro } from "../lib/erros";
import { Pagina, Abas } from "../components/ei/Pagina";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import type { JobListing, JobResponse } from "../types/domain";
import Esqueleto from "../components/ei/Esqueleto";

/**
 * Como cada marca da triagem aparece na lista.
 *
 * `new` e `read` não ganham selo: "ainda não decidi" é o estado normal de
 * quem acabou de chegar, e um selo em todo mundo não separa nada — que é
 * justamente o que a lista precisa fazer quando fica grande.
 */
const SELO: Record<JobResponse["status"], { texto: string; classe: string } | null> = {
  new: null,
  read: null,
  accepted: { texto: "Gostei", classe: "ei-selo ei-selo-verde" },
  rejected: { texto: "Não é para a vaga", classe: "ei-selo ei-selo-cinza" },
};

/**
 * Quem se candidatou a uma vaga, em tela própria.
 *
 * A dona: "no painel da vaga acho que pode ter botões sobre as ondas e
 * outro para as pessoas que são interessadas."
 *
 * É a tela pela qual a empresa paga o plano — e ela vivia no fim de uma
 * rolagem que começava na ficha da vaga e passava pelas três ondas. Aqui
 * ela abre direto, com o telefone a um toque de distância.
 */
export function InteressadosDaVagaPage() {
  const { id: vagaId } = useParams<{ id: string }>();
  const navegar = useNavigate();
  useTituloDaPagina("Interessados");

  const [vaga, setVaga] = useState<JobListing | null>(null);
  const [respostas, setRespostas] = useState<RespostaComPessoa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  /* A dona: "pra que ele possa filtrar... se uma lista for grande." */
  /* ── ABRE EM "PARA VER", E NÃO EM "TODOS" — 04/09 ──────────────────
     A dona: "as pessoas que você não acha interessante ainda continuam na
     tela para escolher um candidato."

     Ela está certa, e o defeito era do padrão: a tela abria em "Todos",
     que inclui os descartados. Quem marcasse cinco pessoas como "não é
     para a vaga" voltava no dia seguinte e reencontrava as cinco, no meio
     de quem ainda faltava decidir — relendo nomes que já tinha
     descartado, toda visita.

     A pilha de trabalho é a dos indecididos. Se não houver nenhum (tudo
     já triado), a tela cai em "Todos" sozinha, no `useEffect` abaixo:
     abrir numa lista vazia seria pior que abrir na lista errada. */
  const [aba, setAba] = useState<"todos" | "ver" | "gostei" | "nao">("ver");
  /* Qual linha está sendo marcada agora — para desligar só os botões dela
     enquanto o banco responde, e não a lista inteira. */
  const [marcando, setMarcando] = useState<string | null>(null);

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
        setRespostas(await obterRespostasDaVaga(vagaId));
      } catch (err) {
        setErro(mensagemDeErro(err, "Não foi possível carregar os interessados."));
      } finally {
        setCarregando(false);
      }
    })();
  }, [vagaId, navegar]);

  /* Tudo já triado? Então "Para ver" está vazia, e abrir numa lista vazia
     faz a tela parecer quebrada. Cai em "Todos", que aí é a única com
     conteúdo. Roda uma vez, quando as respostas chegam. */
  useEffect(() => {
    if (carregando) return;
    const faltaDecidir = respostas.some(
      (r) => r.status !== "accepted" && r.status !== "rejected"
    );
    if (!faltaDecidir && respostas.length > 0) setAba("todos");
  }, [carregando, respostas]);

  /* Marca sem sair da lista.

     ── O QUE ISTO CONSERTA ──────────────────────────────────────────
     Para dizer "não é para a vaga" era preciso ABRIR o perfil da pessoa,
     decidir lá dentro e voltar. Triar vinte candidatos custava vinte idas
     e vindas, e a empresa que não tinha paciência para isso simplesmente
     não triava — e aí a lista nunca diminuía, que é a queixa da dona.

     A decisão passa a caber na própria linha. O perfil continua a um
     toque, para quem quer ver antes de decidir. */
  async function marcar(
    respostaId: string,
    status: "accepted" | "rejected" | "read"
  ) {
    setMarcando(respostaId);
    setErro("");
    /* A lista muda na hora, antes do banco responder: numa triagem em
       sequência, esperar meio segundo por linha é o que faz a pessoa
       desistir no quinto nome. Se o banco recusar, o estado volta e o
       erro aparece — nunca fica um "marcado" que não foi gravado. */
    const antes = respostas;
    setRespostas((lista) =>
      lista.map((r) => (r.id === respostaId ? { ...r, status } : r))
    );
    try {
      await marcarResposta(respostaId, status);
    } catch (err) {
      setRespostas(antes);
      setErro(mensagemDeErro(err, "Não consegui marcar esta pessoa."));
    } finally {
      setMarcando(null);
    }
  }

  /* "Para ver" junta `new` e `read`: as duas querem dizer "ainda não
     decidi", e separar "chegou" de "eu abri" seria uma distinção que só o
     app entende — a empresa quer saber de quem ainda falta decidir. */
  const naAba = (r: RespostaComPessoa, qual: typeof aba) =>
    qual === "todos" ||
    (qual === "gostei" && r.status === "accepted") ||
    (qual === "nao" && r.status === "rejected") ||
    (qual === "ver" && r.status !== "accepted" && r.status !== "rejected");

  const contar = (qual: typeof aba) => respostas.filter((r) => naAba(r, qual)).length;
  /* ── EM "TODOS", O DESCARTADO AFUNDA — 04/09 ──────────────────────
     Mesmo com a aba certa como padrão, "Todos" continua existindo e
     continua sendo para onde a empresa vai quando quer rever tudo. Ali o
     descartado não some (esconder decisão tomada é pior: a pessoa procura
     onde foi parar), mas ele desce para o fim da lista — nunca fica entre
     duas pessoas que ainda esperam decisão. */
  const ordem = (r: RespostaComPessoa) =>
    r.status === "rejected" ? 2 : r.status === "accepted" ? 1 : 0;
  const daAba = respostas
    .filter((r) => naAba(r, aba))
    .slice()
    .sort((a, b) => (aba === "todos" ? ordem(a) - ordem(b) : 0));

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
          <Pagina titulo="Interessados" voltar="/painel-empresa" />
          <p className="ei-apoio ei-margem">{erro || "Vaga não encontrada."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ei">
      <div className="ei-tela detalhe-vaga">
        <Pagina titulo="Interessados" voltar={`/vaga/${vaga.id}`}>
          <p className="ei-apoio ei-margem" style={{ marginTop: 4 }}>
            {vaga.title}
          </p>
        </Pagina>

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 12 }} role="alert">
            {erro}
          </p>
        )}

      {/* ── O FILTRO DA TRIAGEM — 04/09 ────────────────────────────────
          A dona: "ter botões para a empresa marcar se ele interessou, não
          interessou ou analisar. Pra que ele possa filtrar e posteriormente
          conseguir filtrar se uma lista for grande."

          As abas só aparecem com gente na lista: numa vaga sem resposta
          elas seriam quatro botões filtrando o vazio. */}
      {respostas.length > 0 && (
        <Abas
          valor={aba}
          aoTrocar={setAba}
          opcoes={[
            { chave: "todos", rotulo: "Todos", contagem: respostas.length },
            { chave: "ver", rotulo: "Para ver", contagem: contar("ver") },
            { chave: "gostei", rotulo: "Gostei", contagem: contar("gostei") },
            { chave: "nao", rotulo: "Não", contagem: contar("nao") },
          ]}
        />
      )}

      {/* Respostas */}
      <section className="ei-cartao">
        {/* Sem repetir "interessados": o título da tela já diz. Aqui só a
            contagem, que é o que muda de uma visita para a outra. */}
        {respostas.length > 0 && (
          <p className="muted" style={{ marginBottom: 10 }}>
            {daAba.length === 1 ? "1 pessoa" : `${daAba.length} pessoas`}
          </p>
        )}

        {respostas.length > 0 && daAba.length === 0 ? (
          /* Filtro vazio é diferente de vaga sem candidato: dizer "ninguém
             se interessou" aqui seria falso, e a empresa concluiria que o
             anúncio não funcionou por causa de uma aba. */
          <p className="muted">Ninguém nesta marca ainda.</p>
        ) : respostas.length === 0 ? (
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
            {daAba.map((resp) => (
              /* O link usa `cadastroId`, e não `professional_id`: aquele é
                 o id da CONTA, e abriria "perfil não encontrado". Quem
                 está sem cadastro visível vira linha sem toque.

                 `?resposta=` vai junto para o perfil saber QUAL candidatura
                 está sendo triada: a mesma pessoa pode ter se interessado
                 por três vagas da mesma empresa, e marcar "gostei" tem que
                 valer para esta vaga, não para as três. */
              <div key={resp.id} className="ei-triagem-linha">
              <Link
                to={
                  /* `vaga` vai junto para a ficha marcar com um visto o
                     que bate com esta vaga — ver PerfilPublicoPage. */
                  resp.cadastroId
                    ? `/profissional/${resp.cadastroId}?resposta=${resp.id}&vaga=${vagaId}`
                    : "#"
                }
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
                    {/* Só o dia e o mês. Com o retrato maior (04/09) a linha
                        encurtou, e "Praia · respondeu em 04/09/2026" passou a
                        ser cortada JUSTO NA DATA — sobrava "respondeu em …",
                        que é a metade sem informação nenhuma. */}
                    {resp.bairro ? `${resp.bairro} · ` : ""}
                    {new Date(resp.responded_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                  {/* A marca da triagem no próprio card, e não só na aba:
                      quem está em "Todos" precisa ver quem já foi decidido
                      sem trocar de filtro. */}
                  {SELO[resp.status] && (
                    <span className={SELO[resp.status]!.classe}>
                      {SELO[resp.status]!.texto}
                    </span>
                  )}
                </span>
                {resp.cadastroId && (
                  <span className="ei-linha-seta" aria-hidden="true">
                    <IconeSeta />
                  </span>
                )}
              </Link>
              {/* ── A DECISÃO NA PRÓPRIA LINHA — 04/09 ─────────────────
                  Fora do `<Link>` de propósito: botão dentro de link é o
                  jeito mais rápido de a pessoa abrir o perfil quando
                  queria descartar. Aqui eles são vizinhos, não filhos.

                  Quem já foi decidido mostra só o caminho de volta
                  ("Rever"): dois botões acesos numa linha já resolvida
                  fariam a empresa se perguntar qual dos dois está
                  valendo. */}
              <div className="ei-triagem">
                {resp.status === "accepted" || resp.status === "rejected" ? (
                  <button
                    type="button"
                    className="ei-triagem-botao"
                    disabled={marcando === resp.id}
                    onClick={() => marcar(resp.id, "read")}
                  >
                    Rever
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ei-triagem-botao ei-triagem-sim"
                      disabled={marcando === resp.id}
                      onClick={() => marcar(resp.id, "accepted")}
                    >
                      Gostei
                    </button>
                    <button
                      type="button"
                      className="ei-triagem-botao ei-triagem-nao"
                      disabled={marcando === resp.id}
                      onClick={() => marcar(resp.id, "rejected")}
                    >
                      Não é para a vaga
                    </button>
                  </>
                )}
              </div>
              </div>
            ))}
          </div>
        )}
      </section>
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
