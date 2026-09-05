import { useEffect, useMemo, useRef, useState } from "react";
import { IconeFogo } from "../../components/ei/IconeFogo";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { mensagemDeErro } from "../../lib/erros";
import { useAuth } from "../../lib/useAuth";
import { bancoDeVagas, type VagaNoBanco } from "../../lib/bancoDeVagas";
import { responderVaga } from "../../lib/minhasVagas";
import {
  vagaEmDestaque,
  precoDoDestaqueDeVagaEmTexto,
  DESTAQUE_DIAS,
} from "../../lib/destaque";
import { podeVender } from "../../lib/plataforma";
import { lerMeuPerfil } from "../../lib/meuPerfil";
import { nomeDoContrato, salarioEmTexto } from "../../types/domain";
import { Pagina } from "../../components/ei/Pagina";
import Esqueleto from "../../components/ei/Esqueleto";

/**
 * O banco de vagas.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "tem que criar um banco de vagas, assim como o de talentos, nela
 * as pessoas poderão acessar as vagas que estão em aberto das empresas.
 * (Verificar se poderão se candidatar sem ter compatibilidade / perguntar
 * isso pra empresa ao cadastrar a vaga?)"
 *
 * ── AS DUAS PERGUNTAS DELA, RESPONDIDAS ────────────────────────────────
 *
 * *Pode responder sem ter compatibilidade?* Pode, e a tela mostra o quanto
 * combina em vez de esconder a vaga. A conta de compatibilidade compara
 * TEXTO que as pessoas escreveram: ela erra para quem se cadastrou como
 * "auxiliar de limpeza" e é exatamente a camareira que a vaga procura.
 * Barrar por esse palpite descarta justamente quem menos sabe se descrever.
 *
 * *Pergunta-se isso à empresa?* Sim — é a coluna
 * `aceita_sem_compatibilidade` da 0105, com o padrão em SIM. Quando a
 * empresa marcar que não aceita, a tela avisa ANTES, em vez de deixar a
 * pessoa responder e nunca receber retorno. (Entra aqui quando a 0105
 * estiver aplicada.)
 *
 * ── COMO ELE É DIFERENTE DE "VAGAS PARA MIM" ───────────────────────────
 *
 * "Vagas para mim" é o que a ONDA escolheu mandar: a empresa publica, o app
 * cruza os cadastros e avisa quem combina. É bom e continua existindo.
 *
 * Só que a onda decide por quem procura trabalho. Quem ela não escolheu
 * nunca fica sabendo que a vaga existe — e ela erra, porque compara texto.
 * Aqui está TUDO que está no ar, na ordem de quem mais combina, para a
 * pessoa procurar com os próprios olhos.
 */
export function BancoDeVagasPage() {
  useTituloDaPagina("Vagas abertas");

  const { user, loading } = useAuth();
  const [lista, setLista] = useState<VagaNoBanco[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  /* A busca e o filtro moram na URL, e não no estado da tela: sem isso,
     abrir uma vaga e voltar apaga o que a pessoa digitou. É o defeito que
     o CLAUDE.md registra como já tendo custado horas, e que voltou uma vez
     nesta mesma família de telas. */
  const [params, setParams] = useSearchParams();
  const filtro = params.get("q") ?? "";
  const cidade = params.get("c");
  /* O modo também mora na URL, pelo mesmo motivo dos filtros: abrir uma
     vaga e voltar não pode jogar a pessoa de volta para a lista quando
     ela estava nos cartões. */
  const modo = params.get("m") === "cartoes" ? "cartoes" : "lista";
  /* ── O TIPO DE VAGA — 04/09 ────────────────────────────────────────
     A dona: "criar uma área pra freelancer" e "ter uma opção da pessoa
     colocar no cadastro que é 1º emprego".

     As duas áreas são a MESMA tela com um recorte diferente, e não telas
     novas: quem entra por "Bicos e freelas" quer ver vagas, e uma tela
     paralela com a própria busca, os próprios filtros e o próprio modo
     de cartão seria uma segunda tela para envelhecer sozinha.

     O recorte vive na URL como os outros filtros, então abrir uma vaga e
     voltar não joga a pessoa de volta na lista inteira. */
  const tipo = params.get("t");

  function mudarParams(mudanca: {
    q?: string;
    c?: string | null;
    m?: string | null;
    t?: string | null;
  }) {
    const novo = new URLSearchParams(params);
    for (const [chave, valor] of Object.entries(mudanca)) {
      if (valor) novo.set(chave, valor);
      else novo.delete(chave);
    }
    /* `replace` para a busca não encher o histórico: senão, voltar depois
       de digitar oito letras exige oito toques no botão de voltar. */
    setParams(novo, { replace: true });
  }

  useEffect(() => {
    if (loading) return;
    bancoDeVagas(user?.id)
      .then(setLista)
      .catch((err) => {
        /* Erro nunca vira lista vazia. "Nenhuma vaga em Itabirito hoje" e
           "não consegui ler as vagas" são a mesma tela e coisas opostas —
           e aqui a mentira calada custa o emprego de alguém. */
        setErro(mensagemDeErro(err, "Não consegui carregar as vagas."));
      })
      .finally(() => setCarregando(false));
  }, [user, loading]);

  /* As cidades saem do que existe de verdade na lista, e não de uma lista
     fixa: um filtro "Ouro Preto" numa semana sem vaga de Ouro Preto é um
     botão que só sabe devolver tela vazia. */
  const cidades = useMemo(() => {
    const conta = new Map<string, number>();
    for (const v of lista) {
      if (v.vaga.city) conta.set(v.vaga.city, (conta.get(v.vaga.city) ?? 0) + 1);
    }
    return [...conta.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
      .map(([c]) => c);
  }, [lista]);

  const visiveis = useMemo(() => {
    const t = filtro.trim().toLocaleLowerCase("pt-BR");
    return lista.filter((v) => {
      if (cidade && v.vaga.city !== cidade) return false;
      /* Freela é o conjunto do trabalho avulso, e não só o contrato
         chamado "freelance": diária e temporário são a mesma coisa para
         quem procura um bico, e separá-los deixaria a área quase vazia
         numa cidade em que quase ninguém escreve "freelance". */
      if (tipo === "freela" && !["freelance", "diaria", "temporario"].includes(v.vaga.tipo_contrato ?? "")) {
        return false;
      }
      if (tipo === "primeiro" && !v.vaga.aceita_primeiro_emprego) return false;
      if (tipo === "pcd" && !v.vaga.vaga_para_pcd) return false;
      if (!t) return true;
      return (
        (v.vaga.title ?? "").toLocaleLowerCase("pt-BR").includes(t) ||
        (v.vaga.profession ?? "").toLocaleLowerCase("pt-BR").includes(t) ||
        (v.vaga.specialty ?? "").toLocaleLowerCase("pt-BR").includes(t) ||
        v.empresa.toLocaleLowerCase("pt-BR").includes(t)
      );
    });
  }, [lista, filtro, cidade, tipo]);

  /* As pagas primeiro, e em lista própria — ver o comentário da área de
     destaque, mais abaixo. A ordem dentro de cada uma é a que já vinha do
     banco. */
  const destacadas = useMemo(() => visiveis.filter((v) => vagaEmDestaque(v.vaga)), [visiveis]);

  /* Uma linha da lista. Vira função porque agora ela é desenhada em DOIS
     lugares (a área de destaque e o resto), e duas cópias do mesmo JSX de
     quarenta linhas é o tipo de coisa que diverge no primeiro conserto. */
  const linhaDaVaga = (v: VagaNoBanco) => (
              /* `ei-vaga-linha` e não `ei-pessoa`: a linha de pessoa tem
                 duas linhas de texto e centraliza o retrato na vertical.
                 Aqui são quatro, e o retrato centralizado descia para o
                 meio do bloco, deixando um buraco branco em cima. */
              <Link key={v.vaga.id} to={`/vaga-aberta/${v.vaga.id}`} className="ei-pessoa ei-vaga-linha">
                <Marca foto={v.empresa_foto} nome={v.empresa || v.vaga.title} />
                <div className="ei-pessoa-texto">
                  {/* ── O TÍTULO PODE OCUPAR DUAS LINHAS — 04/09 ─────────
                      A dona: "os títulos das vagas estão quebrados."

                      Estavam cortados: "Motorista entrega…", "Pedreiro
                      para obr…". A linha de vaga tem QUATRO linhas de
                      texto e ganhou um retrato maior no mesmo dia — e o
                      título, que é a única coisa pela qual alguém decide
                      abrir a vaga, foi o que pagou a conta.

                      Cortar o cargo é pior que ocupar mais uma linha:
                      "Motorista entrega…" pode ser entregador, entregas
                      rápidas ou entrega de gás, e a pessoa tem de abrir
                      para descobrir. Duas linhas, e só então reticências. */}
                  <div className="ei-pessoa-nome ei-duas-linhas">{v.vaga.title}</div>
                  <div className="ei-pessoa-oficio ei-uma-linha">
                    {[v.empresa, v.vaga.city].filter(Boolean).join(" · ")}
                  </div>
                  {(v.vaga.aceita_primeiro_emprego ||
                    v.vaga.vaga_para_pcd ||
                    vagaEmDestaque(v.vaga)) && (
                    <div className="ei-chips" style={{ marginTop: 4 }}>
                      {/* O destaque vem primeiro porque é o que explica a
                          POSIÇÃO da vaga na lista: sem o selo, quem paga
                          sobe e ninguém entende por quê — e a lista passa
                          a parecer bagunçada em vez de patrocinada. */}
                      {vagaEmDestaque(v.vaga) && (
                        <span className="ei-selo ei-selo-laranja">Em destaque</span>
                      )}
                      {v.vaga.aceita_primeiro_emprego && (
                        <span className="ei-selo ei-selo-verde">Aceita primeiro emprego</span>
                      )}
                      {v.vaga.vaga_para_pcd && (
                        <span className="ei-selo ei-selo-verde">Aceita PCD</span>
                      )}
                    </div>
                  )}
                  <div className="ei-vaga-linha-detalhe ei-uma-linha">
                    {[salarioEmTexto(v.vaga) ?? "Salário não informado",
                      nomeDoContrato(v.vaga.tipo_contrato)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {/* A compatibilidade EXPLICADA, e não só um número: "72%"
                      sozinho não diz o que fazer com ele — e sugere uma
                      precisão que uma comparação de texto não tem.

                      Numa linha só, cortada com reticências se não couber:
                      quatro linhas de altura já é o limite antes de a lista
                      virar uma pilha de blocos em vez de uma lista. */}
                  {v.interessado === true ? (
                    <div className="ei-compat ei-compat-respondida ei-uma-linha">
                      Você já respondeu que tem interesse
                    </div>
                  ) : (
                    v.compatibilidade !== null && (
                      <div className={`ei-compat ei-uma-linha ${classeDaCompat(v.compatibilidade)}`}>
                        {/* A empresa marcou que NÃO aceita quem não bate
                            (item 16, 0105). A pessoa fica sabendo AQUI, e
                            não depois de responder e nunca receber
                            retorno — que é a única forma pior de não ser
                            chamada. */}
                        {!v.vaga.aceita_sem_compatibilidade && v.compatibilidade < 75
                          ? "Esta empresa só chama quem bate com o pedido"
                          : rotuloDaCompat(v.compatibilidade)}
                        {/* Só o primeiro motivo: dois estouram a linha, e o segundo
                            nunca é o que decide. */}
                        {v.vaga.aceita_sem_compatibilidade !== false &&
                          v.porque.length > 0 &&
                          ` · ${v.porque[0]}`}
                      </div>
                    )
                  )}
                </div>
                <span className="ei-linha-seta" aria-hidden="true">
                  <IconeSeta />
                </span>
              </Link>
  );

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina
          titulo={
            tipo === "freela"
              ? "Bicos e freelas"
              : tipo === "primeiro"
                ? "Primeiro emprego"
                : tipo === "pcd"
                  ? "Vagas que aceitam PCD"
                  : "Vagas abertas"
          }
        />

        <div className="ei-busca" style={{ marginTop: 14 }}>
          <IconeLupa />
          <input
            type="search"
            placeholder="Procurar"
            value={filtro}
            onChange={(e) => mudarParams({ q: e.target.value })}
            aria-label="Procurar vaga"
          />
          {filtro && (
            <button
              type="button"
              className="ei-busca-limpar"
              aria-label="Limpar a busca"
              onClick={() => mudarParams({ q: "" })}
            >
              ✕
            </button>
          )}
        </div>

        {/* ── OS RECORTES — 04/09 ───────────────────────────────────────
            "Bicos e freelas" e "Primeiro emprego" são a MESMA lista com um
            recorte, e não telas novas (ver o comentário em `tipo`). A
            fileira fica sempre visível para quem entrou por uma delas
            poder sair sem voltar duas telas — e para quem entrou pela
            lista inteira descobrir que os recortes existem. */}
        <div className="ei-filtros" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="ei-chip"
            aria-pressed={!tipo}
            onClick={() => mudarParams({ t: null })}
          >
            Todas
          </button>
          {/* O chip "Bico e freela" saiu em 04/09, junto com a porta, a
              pedido da dona ("não vou colocar isso por enquanto"). O
              filtro continua funcionando por endereço (`?t=freela`): é
              uma linha de código, e apagá-la tiraria também o caminho de
              quem já tiver o link. */}
          <button
            type="button"
            className="ei-chip"
            aria-pressed={tipo === "primeiro"}
            onClick={() => mudarParams({ t: tipo === "primeiro" ? null : "primeiro" })}
          >
            Primeiro emprego
          </button>
          <button
            type="button"
            className="ei-chip"
            aria-pressed={tipo === "pcd"}
            onClick={() => mudarParams({ t: tipo === "pcd" ? null : "pcd" })}
          >
            Aceita PCD
          </button>
        </div>

        {/* A fileira só aparece com mais de uma cidade: com uma só, ela
            seria um botão que não filtra nada. */}
        {cidades.length > 1 && (
          <div className="ei-filtros" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="ei-chip"
              aria-pressed={cidade === null}
              onClick={() => mudarParams({ c: null })}
            >
              Todas
            </button>
            {cidades.map((c) => (
              <button
                key={c}
                type="button"
                className="ei-chip"
                aria-pressed={cidade === c}
                onClick={() => mudarParams({ c: cidade === c ? null : c })}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* ── LISTA OU CARTÕES — 04/09 ─────────────────────────────────
            A dona: "quando abre o banco de vagas, precisamos pensar em ter
            um jeito das vagas disponíveis irem deslizando horizontalmente,
            onde a pessoa pode ir escolhendo se tem interesse ou não."

            A lista é boa para PROCURAR (a pessoa sabe o que quer e usa a
            busca). Os cartões são bons para PASSAR OS OLHOS: uma vaga por
            vez, inteira, com as duas respostas do lado — que é como se lê
            no ônibus, com uma mão só.

            Os dois modos existem porque servem a momentos diferentes, e
            trocar um pelo outro perderia metade das pessoas. A lista
            continua sendo o padrão: é ela que responde "o que tem hoje?"
            numa olhada. */}
        {!carregando && !erro && visiveis.length > 0 && (
          <div className="ei-margem" style={{ marginTop: 14 }}>
            <div className="segmentado" role="group" aria-label="Como ver as vagas">
              <button
                type="button"
                className={modo === "lista" ? "segmentado-opcao ativa" : "segmentado-opcao"}
                aria-pressed={modo === "lista"}
                onClick={() => mudarParams({ m: null })}
              >
                Lista
              </button>
              <button
                type="button"
                className={modo === "cartoes" ? "segmentado-opcao ativa" : "segmentado-opcao"}
                aria-pressed={modo === "cartoes"}
                onClick={() => mudarParams({ m: "cartoes" })}
              >
                Uma por uma
              </button>
            </div>
          </div>
        )}

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 16 }} role="alert">
            {erro}
          </p>
        )}

        {carregando && (
          <Esqueleto />
        )}

        {!carregando && !erro && (
          <div className="ei-secao-linha">
            {/* No modo cartão o número do topo dizia "3 vagas" enquanto o
                baralho dizia "1 de 2" e, no fim, "você passou pelas 2
                vagas abertas" — dois números diferentes para a mesma
                coisa, na mesma tela. O baralho conta o que sobrou para
                responder; aqui, no modo cartão, o título sai de cena e
                deixa o baralho falar sozinho. */}
            <h2>
              {modo === "cartoes"
                ? "Uma por uma"
                : `${visiveis.length} ${visiveis.length === 1 ? "vaga" : "vagas"}`}
            </h2>
            {(cidade || filtro) && (
              <button
                type="button"
                className="ei-secao-acao"
                onClick={() => setParams(new URLSearchParams(), { replace: true })}
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {!carregando && !erro && visiveis.length === 0 && (
          <div className="ei-cartao" style={{ padding: 0 }}>
            <div className="ei-vazio">
              <span className="ei-vazio-icone" aria-hidden="true">
                <IconeLupa grande />
              </span>
              <h3 className="ei-titulo">
                {filtro.trim() || cidade ? "Nada com esse filtro" : "Nenhuma vaga no ar agora"}
              </h3>
              <p className="ei-apoio">
                {tipo === "freela"
                  ? "Nenhuma vaga de diária, obra ou serviço avulso no ar agora. Toque em “Todas” para ver as outras."
                  : tipo === "pcd"
                    ? "Nenhuma empresa marcou que aceita PCD, por enquanto. Toque em “Todas”: a marcação é nova e muitas vagas ainda não têm."
                  : tipo === "primeiro"
                    ? "Nenhuma empresa marcou que aceita quem está começando, por enquanto. Toque em “Todas”: muitas vagas não pedem experiência mesmo sem essa marcação."
                    : filtro.trim() || cidade
                      ? "Tente outra palavra, ou tire o filtro para ver todas."
                      : "Assim que uma empresa publicar, a vaga aparece aqui — e você recebe um aviso se ela combinar com o seu cadastro."}
              </p>
            </div>
          </div>
        )}

        {visiveis.length > 0 && modo === "cartoes" && (
          <Baralho vagas={visiveis} verLista={() => mudarParams({ m: null })} />
        )}

        {/* ── A ÁREA DE DESTAQUE — 04/09 ───────────────────────────────
            A dona: "na lista de vagas, criar área de destaque pra quem
            quer aparecer e pagar pra estar ali."

            A vaga em destaque já existia e já subia para o topo, mas
            misturada: quem pagava ficava na mesma lista, com um selinho
            do lado, e nada dizia que aquele lugar podia ser comprado. Sem
            área, o destaque não tem vitrine — e uma vitrine que ninguém
            vê não se vende.

            Separar também é honestidade com quem procura emprego: uma
            lista cuja ordem foi paga tem de DIZER que foi paga. Misturado,
            o app parecia ordenar por relevância e ordenava por dinheiro. */}
        {/* ── A VITRINE APARECE MESMO VAZIA — 05/09 ────────────────────
            A dona: "mesmo não tendo ninguém, acho interessante a área
            aparecer para as pessoas verem que é possível e se
            interessarem. Nela você coloca um botão discreto para
            direcionar ao pagamento."

            Vitrine que só aparece cheia nunca enche: ninguém compra um
            lugar que não viu. Some inteira dentro do app da Play Store
            (`podeVender`).

            O botão leva ao painel, e não a um checkout: o destaque é de
            UMA vaga, e qual delas só a empresa sabe — ela escolhe lá
            dentro. */}
        {modo === "lista" && (destacadas.length > 0 || podeVender()) && (
          <>
            <h2 className="ei-secao ei-secao-fogo">
              <IconeFogo />
              Em destaque
            </h2>
            {destacadas.length > 0 ? (
              <div className="ei-lista ei-lista-destaque">{destacadas.map(linhaDaVaga)}</div>
            ) : (
              <div className="ei-vitrine-vazia">
                <p className="ei-vitrine-vazia-texto">
                  Nenhuma vaga em destaque agora. A vaga que fica aqui
                  aparece no topo por {DESTAQUE_DIAS} dias, com o selo “Em
                  destaque”.
                </p>
                <Link to="/painel-empresa" className="ei-btn-inline ei-btn-miudo">
                  Destacar minha vaga — {precoDoDestaqueDeVagaEmTexto()}
                </Link>
              </div>
            )}
          </>
        )}

        {/* ── QUEM PAGA FICA NOS DOIS LUGARES — 05/09 ──────────────────
            A dona: "para as pessoas que pagarem para estar em destaque
            precisam de uma sessão diferente. ALÉM de estar na lista
            também."

            A lista de baixo era `resto` — quem pagava SAÍA da lista comum
            e passava a existir só na área de destaque. É o contrário do
            que se compra: destaque é um lugar A MAIS, não uma mudança de
            lugar. Quem rolasse direto para a lista, ou filtrasse por um
            ofício, deixava de ver justamente quem pagou para ser visto.

            Agora vai `visiveis` inteira, e a vaga em destaque aparece
            duas vezes, com o selo nas duas. */}
        {modo === "lista" && destacadas.length > 0 && visiveis.length > 0 && (
          <h2 className="ei-secao">Todas as vagas</h2>
        )}

        {visiveis.length > 0 && modo === "lista" && (
          <div className="ei-lista">{visiveis.map(linhaDaVaga)}</div>
        )}

        {/* O convite para a empresa, no pé da área. Fica DEPOIS das vagas
            porque a tela é de quem procura trabalho: quem entra aqui vem
            ver vagas, não comprar espaço. Quem contrata rola até o fim e
            encontra — e é ela que precisa achar.

            Dentro do app da Play Store não aparece (`podeVender`): vender
            por fora da cobrança do Google é infração, e apontar o caminho
            é a mesma infração que vender. */}
        {modo === "lista" && visiveis.length > 0 && podeVender() && (
          <Link to="/painel-empresa" className="ei-convite-destaque">
            <span className="ei-convite-destaque-titulo">
              Sua vaga aqui em cima, na área de destaque
            </span>
            <span className="ei-convite-destaque-nota">
              {precoDoDestaqueDeVagaEmTexto()} por {DESTAQUE_DIAS} dias, com selo “Em destaque”.
              Abra a vaga no seu painel para contratar.
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

/* Faixas, e não a porcentagem crua.
   ─────────────────────────────────
   "68%" tem uma precisão que a conta não tem: ela compara texto escrito à
   mão por duas pessoas diferentes. Um número com dois dígitos convida a
   comparar 68 com 71, que é uma diferença que não significa nada.

   Três faixas dizem o que dá para dizer com honestidade — e nenhuma delas
   diz "não tente". */
function rotuloDaCompat(n: number): string {
  if (n >= 75) return "Combina com você";
  if (n >= 40) return "Combina em parte";
  return "Outro ofício";
}

function classeDaCompat(n: number): string {
  if (n >= 75) return "ei-compat-alta";
  if (n >= 40) return "ei-compat-media";
  return "ei-compat-baixa";
}

/**
 * A marca da empresa na linha.
 *
 * Sem foto, a inicial — e não um ícone genérico, que faria todas as
 * empresas sem logo virarem o mesmo quadrado cinza. O `onError` cobre o
 * pior caso: a foto que existe no cadastro mas não abre mais, que o
 * navegador desenha como imagem quebrada.
 */
function Marca({ foto, nome }: { foto: string | null; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  const inicial = nome.trim().charAt(0).toLocaleUpperCase("pt-BR");
  return (
    <span className="ei-pessoa-retrato" aria-hidden="true">
      {foto && !falhou ? (
        <img src={foto} alt="" loading="lazy" onError={() => setFalhou(true)} />
      ) : (
        inicial
      )}
    </span>
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

function IconeLupa({ grande = false }: { grande?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={grande ? 30 : 20} height={grande ? 30 : 20}
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </svg>
  );
}

/**
 * As vagas uma por uma, deslizando para o lado.
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "quando abre o banco de vagas, precisamos pensar em ter um jeito
 * das vagas disponíveis irem deslizando horizontalmente, onde a pessoa
 * pode ir escolhendo se tem interesse ou não."
 *
 * ── Por que arrastar E botões, e não só arrastar ──────────────────────
 *
 * Arrastar é rápido para quem já conhece o gesto — e invisível para quem
 * não conhece. Numa cidade onde muita gente usa o celular só para WhatsApp
 * e foto, um cartão que só responde a um gesto que ninguém ensinou é um
 * cartão parado. Os dois botões ficam sempre embaixo, escritos, e o gesto
 * é o atalho de quem descobrir.
 *
 * ── O "não" também é gravado ──────────────────────────────────────────
 *
 * Não é só passar adiante: a resposta vai para o banco como
 * `interessado = false`, do mesmo jeito da tela da vaga. Sem isso, a vaga
 * recusada voltaria amanhã no mesmo lugar, e a pessoa recusaria de novo —
 * e a empresa continuaria sem saber que a vaga foi vista e dispensada.
 *
 * ── As mesmas travas da tela da vaga ──────────────────────────────────
 *
 * Sem conta, o "tenho interesse" leva para entrar. Com conta e sem
 * cadastro preenchido, leva para o cadastro — senão a empresa recebe uma
 * linha sem nome e sem telefone, e não tem como chamar ninguém. O "não é
 * para mim" continua livre: cobrar cadastro para alguém recusar seria
 * cobrar trabalho pela recusa.
 */
function Baralho({ vagas, verLista }: { vagas: VagaNoBanco[]; verLista: () => void }) {
  const { user } = useAuth();
  const navegar = useNavigate();

  /* A fila é congelada na primeira montagem: se ela seguisse a lista viva,
     responder a uma vaga a tiraria do baralho e o cartão de baixo pularia
     para a mão da pessoa antes de ela ver o que respondeu. */
  const [fila, setFila] = useState(() => vagas.filter((v) => v.interessado === undefined));
  const [i, setI] = useState(0);
  const [arrasto, setArrasto] = useState(0);
  const [saindo, setSaindo] = useState<null | "sim" | "nao">(null);
  const [erro, setErro] = useState("");
  const [cadastro, setCadastro] = useState<"sem" | "falta" | "ok" | null>(null);
  /* O que foi respondido NESTA passada. A lista que chega por `vagas` é a
     do carregamento da tela e não volta a ser lida — sem isto, quem
     responde e toca em "passar de novo" revê os próprios cartões sem
     nenhum sinal do que acabou de marcar, que é o mesmo às cegas que o
     selo existe para evitar. */
  const [respondidasAgora, setRespondidasAgora] = useState<Record<string, boolean>>({});
  const inicio = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    lerMeuPerfil(user.id)
      .then((p) => {
        if (!vivo) return;
        if (!p) setCadastro("sem");
        else if (!p.confirmado) setCadastro("falta");
        else setCadastro("ok");
      })
      /* Não conseguir conferir não pode virar uma porta trancada: quem tem
         cadastro ficaria impedido de se candidatar por causa de uma
         consulta que falhou. */
      .catch(() => vivo && setCadastro("ok"));
    return () => {
      vivo = false;
    };
  }, [user]);

  const atual = fila[i];

  /* ── "VER DE NOVO" TEM DE PASSAR DE NOVO — 04/09 ─────────────────────
     A dona: "quando clica em uma por uma e a pessoa já viu, ao clicar em
     ver de novo não passa de novo."

     O botão existia e mentia: ele chamava `verLista`, que troca o modo
     para a LISTA. Quem tocava em "ver todas de novo" esperando o baralho
     recomeçar caía numa tela de outro formato — e concluía, com razão,
     que o botão não fez o que diz.

     Agora ele recomeça o baralho com TODAS as vagas, inclusive as já
     respondidas: responder não apaga a vaga, e mudar de ideia é a coisa
     mais normal do mundo (`responderVaga` já sabe atualizar a resposta
     que existe, desde os dois toques em "Tenho interesse" que quebraram
     isto uma vez).

     A lista continua a um toque, no botão ao lado — só deixou de ser a
     única coisa que esse caminho fazia. */
  function passarDeNovo() {
    setErro("");
    setFila(vagas);
    setI(0);
  }

  async function responder(quero: boolean) {
    if (!atual) return;

    if (!user) {
      navegar("/login?lado=trabalhar");
      return;
    }
    if (quero && cadastro !== "ok") {
      navegar("/painel?motivo=candidatura");
      return;
    }

    setSaindo(quero ? "sim" : "nao");
    setErro("");
    try {
      await responderVaga(atual.vaga.id, user.id, quero);
      setRespondidasAgora((r) => ({ ...r, [atual.vaga.id]: quero }));
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui guardar sua resposta."));
      setSaindo(null);
      return;
    }
    /* O cartão sai da tela antes de o próximo entrar: sem a pausa, a troca
       é instantânea e a pessoa não vê que respondeu — o que faz duvidar de
       ter tocado no botão certo. */
    setTimeout(() => {
      setSaindo(null);
      setI((n) => n + 1);
    }, 220);
  }

  function aoSoltar() {
    const dx = arrasto;
    inicio.current = null;
    setArrasto(0);
    /* 90px: menos que isso e um rolar torto da tela viraria resposta. */
    if (dx > 90) responder(true);
    else if (dx < -90) responder(false);
  }

  if (fila.length === 0) {
    return (
      <div className="ei-cartao" style={{ padding: 0 }}>
        <div className="ei-vazio">
          <h3 className="ei-titulo">Você já respondeu a todas</h3>
          {/* ── E SE EU QUISER OLHAR DE NOVO? — 04/09 ──────────────────
              A pergunta é da dona, lendo esta tela. Era um beco: a pessoa
              passava pelas vagas uma a uma, chegava aqui, e a única saída
              era a barra de baixo — nada dizia que as vagas continuavam
              todas ali, do outro lado do botão "Lista".

              Responder não apaga a vaga: ela continua no ar e a pessoa
              pode mudar de ideia (a tela da vaga tem "mudei de ideia, tenho
              interesse"). Faltava só dizer isso, e levar. */}
          <p className="ei-apoio">
            Assim que uma empresa publicar uma vaga nova, ela aparece aqui.
            As que você já respondeu continuam abertas — dá para rever e
            mudar de ideia.
          </p>
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <button type="button" className="ei-btn ei-btn-cheio" onClick={passarDeNovo}>
              Passar de novo, uma por uma
            </button>
            <button type="button" className="ei-btn ei-btn-contorno" onClick={verLista}>
              Ver em lista
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!atual) {
    return (
      <div className="ei-cartao" style={{ padding: 0 }}>
        <div className="ei-vazio">
          <h3 className="ei-titulo">Acabaram as vagas de hoje</h3>
          <p className="ei-apoio">
            Você passou pelas {fila.length}{" "}
            {fila.length === 1 ? "vaga aberta" : "vagas abertas"}. Quem você marcou
            aparece para a empresa com o seu telefone.
          </p>
          {/* O mesmo par de saídas do outro fim de baralho: passar de novo
              (é o que a dona esperava do "ver de novo") ou trocar para a
              lista. Aqui havia só o caminho da lista, escrito como link
              laranja — a pessoa terminava a pilha e a única coisa que
              podia fazer era mudar de formato. */}
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <button type="button" className="ei-btn ei-btn-cheio" onClick={passarDeNovo}>
              Passar de novo, uma por uma
            </button>
            <button type="button" className="ei-btn ei-btn-contorno" onClick={verLista}>
              Ver em lista
            </button>
          </div>
        </div>
      </div>
    );
  }

  const v = atual;
  /* O que vale é a resposta desta passada, se houver; senão, a que veio do
     banco no carregamento. */
  const jaRespondeu = respondidasAgora[v.vaga.id] ?? v.interessado;
  /* A PRÓXIMA aparece pela beirada — 04/09
     ──────────────────────────────────────
     A dona: "precisa ficar com mais cara de card, para o usuário ver que
     essa é uma funcionalidade; talvez a próxima tenha que ficar
     aparecendo".

     Ela tem razão e o motivo é simples: um cartão sozinho no meio da tela
     é uma TELA, não um baralho. Ninguém arrasta uma tela. Ver o começo do
     próximo cartão na borda é o que faz o dedo entender que há mais de um
     — e é o mesmo truque das prateleiras de aplicativo de vídeo. */
  const proxima = fila[i + 1] ?? null;
  const deslocamento = saindo === "sim" ? 420 : saindo === "nao" ? -420 : arrasto;

  return (
    <div className="ei-baralho">
      <p className="ei-baralho-conta">
        {i + 1} de {fila.length}
      </p>

      {erro && (
        <p className="ei-campo-erro ei-margem" role="alert">
          {erro}
        </p>
      )}

      <div className="ei-baralho-palco">
        {/* O espelho da próxima: só o começo dela, cortado pela borda da
            tela. `aria-hidden` porque é enfeite — quem usa leitor de tela
            já ouve "1 de 5" logo acima. */}
        {proxima && (
          <div className="ei-baralho-proximo" aria-hidden="true">
            <div className="ei-baralho-proximo-titulo">{proxima.vaga.title}</div>
            <div className="ei-baralho-proximo-empresa">
              {proxima.empresa || proxima.vaga.city}
            </div>
          </div>
        )}
      <div
        className="ei-baralho-cartao"
        style={{
          transform: `translateX(${deslocamento}px) rotate(${deslocamento / 28}deg)`,
          transition: saindo || arrasto === 0 ? "transform .22s ease-out" : "none",
        }}
        onPointerDown={(e) => {
          inicio.current = e.clientX;
        }}
        onPointerMove={(e) => {
          if (inicio.current === null) return;
          setArrasto(e.clientX - inicio.current);
        }}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        <div className="ei-baralho-topo">
          <Marca foto={v.empresa_foto} nome={v.empresa || v.vaga.title} />
          <div className="ei-pessoa-texto">
            <div className="ei-pessoa-nome ei-uma-linha">{v.empresa || "Empresa"}</div>
            <div className="ei-pessoa-oficio ei-uma-linha">
              {[v.vaga.neighborhood, v.vaga.city].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>

        {/* O que ela já tinha respondido, quando está passando de novo.
            Sem isto, quem toca em "passar de novo" revê as vagas às cegas:
            as já respondidas ficam idênticas às novas, e a pessoa responde
            de novo sem saber que está mudando uma resposta que a empresa
            já recebeu.

            Em linha própria, e não ao lado do nome da empresa lá em cima:
            medido, sobravam 82px para o nome naquela linha e "Padaria Pão
            de Minas" virava "Pa…". Aqui o selo tem a largura do cartão
            inteiro e não espreme nada. */}
        {jaRespondeu !== undefined && (
          <div className="ei-chips" style={{ marginBottom: 8 }}>
            <span className={jaRespondeu ? "ei-selo ei-selo-verde" : "ei-selo ei-selo-cinza"}>
              {jaRespondeu ? "Você marcou: tenho interesse" : "Você marcou: não é para mim"}
            </span>
          </div>
        )}

        <h3 className="ei-baralho-titulo">{v.vaga.title}</h3>

        <dl className="ei-baralho-fichas">
          <div>
            <dt>Salário</dt>
            <dd>{salarioEmTexto(v.vaga) ?? "A combinar"}</dd>
          </div>
          <div>
            <dt>Contratação</dt>
            <dd>{nomeDoContrato(v.vaga.tipo_contrato) ?? "Não informado"}</dd>
          </div>
        </dl>

        {v.compatibilidade !== null && (
          <p className={`ei-compat ${classeDaCompat(v.compatibilidade)}`}>
            {rotuloDaCompat(v.compatibilidade)}
            {v.porque.length > 0 && ` · ${v.porque[0]}`}
          </p>
        )}

        {v.vaga.description?.trim() && (
          <p className="ei-baralho-texto">{v.vaga.description}</p>
        )}

        <Link className="ei-btn-inline" to={`/vaga-aberta/${v.vaga.id}`}>
          Ver a vaga inteira
        </Link>
      </div>
      </div>

      {/* Os botões ficam FORA do cartão que se move: dentro, eles sairiam
          da tela junto com ele e a pessoa acertaria o vazio. */}
      <div className="ei-baralho-acoes">
        <button
          type="button"
          className="ei-btn ei-btn-contorno ei-btn-alto"
          onClick={() => responder(false)}
          disabled={!!saindo}
        >
          Não é para mim
        </button>
        <button
          type="button"
          className="ei-btn-laranja"
          onClick={() => responder(true)}
          disabled={!!saindo}
        >
          Tenho interesse
        </button>
      </div>

      <p className="ei-baralho-dica">
        Arraste o cartão: <strong>direita</strong> é interesse, <strong>esquerda</strong> passa.
      </p>
    </div>
  );
}
