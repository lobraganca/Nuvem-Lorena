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
import { aoTocarNoRetrato, MarcaDeLupa, useVisorDeFoto } from "../components/ei/BotaoVerFoto";

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

  /* A foto em tela cheia, aberta do próprio cartão — 06/09.
     A dona: "ainda não consegui ver a função pra ver a foto. Coloque
     dentro do card do candidato também."

     É a tela onde isso mais serve: escolher entre doze interessados é
     comparar rostos, e até aqui ver a foto de cada um exigia abrir a
     ficha, voltar, abrir a próxima. */
  const { abrir: abrirFoto, visor } = useVisorDeFoto();

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
          /* Sem a margem que todo `p` traz de nascença: somada aos 18px de
             respiro do cartão, ela abria 33px em cima de "1 pessoa" e
             deixava a contagem boiando sozinha no alto — 06/09. */
          <p className="muted ei-triagem-conta">
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
                className="ei-pessoa ei-pessoa-triagem"
                style={resp.cadastroId ? undefined : { pointerEvents: "none", opacity: 0.6 }}
                /* Toque no retrato abre a FOTO em tela cheia; em qualquer
                   outro lugar do cartão, abre a ficha. É a tela onde isso
                   mais serve — escolher entre doze interessados é comparar
                   rostos, e até aqui cada rosto custava abrir a ficha e
                   voltar. Ver `BotaoVerFoto`. */
                onClick={aoTocarNoRetrato(resp.foto, resp.nome, abrirFoto)}
              >
                <span className="ei-pessoa-retrato" aria-hidden="true">
                  {resp.foto ? (
                    <>
                      <img src={resp.foto} alt="" loading="lazy" />
                      <MarcaDeLupa />
                    </>
                  ) : (
                    (resp.nome || "?").trim().charAt(0).toLocaleUpperCase("pt-BR")
                  )}
                </span>
                {/* O nome é filho DIRETO do cartão, e o resto vai na faixa
                    de baixo. Não é arrumação de código: enquanto tudo
                    estava embrulhado num `ei-pessoa-texto`, sobravam 168px
                    de largura ao lado do retrato de 84px — e as duas
                    pastilhas de função (179px juntas) não cabiam lado a
                    lado, cada uma descia para uma linha. Medido. */}
                <span className="ei-pessoa-nome ei-uma-linha">
                  {resp.nome || "Sem nome"}
                </span>
                {resp.cadastroId && (
                  <span className="ei-linha-seta" aria-hidden="true">
                    <IconeSeta />
                  </span>
                )}
                <span className="ei-pessoa-ficha">
                  {/* ── O QUE A PESSOA FAZ — 05/09 ────────────────────
                      A dona: "como escolher nessa tela se não tem nada
                      informando o que a pessoa faz e as experiências?"

                      Não tinha: nome, foto e a data. Para escolher entre
                      dois interessados era preciso abrir o perfil de um,
                      voltar, abrir o do outro e comparar de cabeça — numa
                      lista que pode ter vinte nomes.

                      As FUNÇÕES vêm primeiro e em pastilha, porque é a
                      resposta da pergunta "essa pessoa faz o que eu
                      preciso?". Três, e o resto vira "+2": quatro
                      pastilhas já empurram o cartão para três linhas, e
                      quem tem muitas funções marcadas é justamente quem
                      não se decidiu por nenhuma. */}
                  {/* "Primeiro emprego" entra NA MESMA fileira das funções,
                      e não numa linha própria embaixo — 06/09. Sozinho ele
                      era uma pastilha verde do tamanho de uma frase,
                      encostada à esquerda debaixo de duas pastilhas cinzas
                      pequenas: fora de escala, e foi um dos "desalinhados"
                      do print da dona. Junto, ele é o que sempre foi — mais
                      uma coisa que se sabe sobre a pessoa. */}
                  {(resp.funcoes.length > 0 || resp.primeiroEmprego) && (
                    <span className="ei-chips ei-pessoa-funcoes">
                      {resp.funcoes.slice(0, 3).map((f) => (
                        <span key={f} className="ei-selo ei-selo-cinza">
                          {f}
                        </span>
                      ))}
                      {resp.funcoes.length > 3 && (
                        <span className="ei-selo ei-selo-cinza">
                          +{resp.funcoes.length - 3}
                        </span>
                      )}
                      {/* "Está atrás do primeiro emprego" é INFORMAÇÃO, e
                          não falta dela: sem isto, um cadastro sem
                          experiência nenhuma é lido como cadastro pela
                          metade — e é o contrário, é alguém começando. */}
                      {resp.primeiroEmprego && (
                        <span className="ei-selo ei-selo-verde">Primeiro emprego</span>
                      )}
                    </span>
                  )}

                  {/* O resumo que a pessoa escreveu, em duas linhas. É o
                      que mais se aproxima de "conte de você" numa lista —
                      e some inteiro quando ela não escreveu, em vez de
                      deixar um vão. */}
                  {resp.resumo?.trim() && (
                    <span className="ei-pessoa-resumo">{resp.resumo.trim()}</span>
                  )}

                  {/* O bairro, a data e a marca da triagem numa fileira só,
                      no pé do cartão — 06/09. Empilhados, cada um numa
                      linha, "Praia · 04/09" caía logo abaixo do resumo com
                      o mesmo tamanho e a mesma cor, e lia como se fosse a
                      última frase do que a pessoa escreveu. Aqui embaixo, e
                      menor, ele volta a ser o que é: de onde e de quando. */}
                  <span className="ei-pessoa-rodape">
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
                </span>
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
      {/* Fora da lista: o visor cobre a tela inteira, e dentro de um
          cartão ele deixaria de ser fixo. */}
      {visor}
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
