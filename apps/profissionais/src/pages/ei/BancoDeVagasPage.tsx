import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { mensagemDeErro } from "../../lib/erros";
import { useAuth } from "../../lib/useAuth";
import { bancoDeVagas, type VagaNoBanco } from "../../lib/bancoDeVagas";
import { responderVaga } from "../../lib/minhasVagas";
import { lerMeuPerfil } from "../../lib/meuPerfil";
import { nomeDoContrato, salarioEmTexto } from "../../types/domain";
import { Pagina } from "../../components/ei/Pagina";

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

  function mudarParams(mudanca: { q?: string; c?: string | null; m?: string | null }) {
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
      if (!t) return true;
      return (
        (v.vaga.title ?? "").toLocaleLowerCase("pt-BR").includes(t) ||
        (v.vaga.profession ?? "").toLocaleLowerCase("pt-BR").includes(t) ||
        (v.vaga.specialty ?? "").toLocaleLowerCase("pt-BR").includes(t) ||
        v.empresa.toLocaleLowerCase("pt-BR").includes(t)
      );
    });
  }, [lista, filtro, cidade]);

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="Vagas abertas" />

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
          <p className="ei-apoio ei-margem" style={{ marginTop: 20 }}>
            Carregando…
          </p>
        )}

        {!carregando && !erro && (
          <div className="ei-secao-linha">
            <h2>
              {visiveis.length} {visiveis.length === 1 ? "vaga" : "vagas"}
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
                {filtro.trim() || cidade
                  ? "Tente outra palavra, ou tire o filtro para ver todas."
                  : "Assim que uma empresa publicar, a vaga aparece aqui — e você recebe um aviso se ela combinar com o seu cadastro."}
              </p>
            </div>
          </div>
        )}

        {visiveis.length > 0 && modo === "cartoes" && (
          <Baralho vagas={visiveis} />
        )}

        {visiveis.length > 0 && modo === "lista" && (
          <div className="ei-lista">
            {visiveis.map((v) => (
              /* `ei-vaga-linha` e não `ei-pessoa`: a linha de pessoa tem
                 duas linhas de texto e centraliza o retrato na vertical.
                 Aqui são quatro, e o retrato centralizado descia para o
                 meio do bloco, deixando um buraco branco em cima. */
              <Link key={v.vaga.id} to={`/vaga-aberta/${v.vaga.id}`} className="ei-pessoa ei-vaga-linha">
                <Marca foto={v.empresa_foto} nome={v.empresa || v.vaga.title} />
                <div className="ei-pessoa-texto">
                  <div className="ei-pessoa-nome ei-uma-linha">{v.vaga.title}</div>
                  <div className="ei-pessoa-oficio ei-uma-linha">
                    {[v.empresa, v.vaga.city].filter(Boolean).join(" · ")}
                  </div>
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
            ))}
          </div>
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
function Baralho({ vagas }: { vagas: VagaNoBanco[] }) {
  const { user } = useAuth();
  const navegar = useNavigate();

  /* A fila é congelada na primeira montagem: se ela seguisse a lista viva,
     responder a uma vaga a tiraria do baralho e o cartão de baixo pularia
     para a mão da pessoa antes de ela ver o que respondeu. */
  const [fila] = useState(() => vagas.filter((v) => v.interessado === undefined));
  const [i, setI] = useState(0);
  const [arrasto, setArrasto] = useState(0);
  const [saindo, setSaindo] = useState<null | "sim" | "nao">(null);
  const [erro, setErro] = useState("");
  const [cadastro, setCadastro] = useState<"sem" | "falta" | "ok" | null>(null);
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
          <p className="ei-apoio">
            Assim que uma empresa publicar uma vaga nova, ela aparece aqui.
          </p>
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
          <Link className="ei-btn-inline" to="/vagas">
            Ver em lista
          </Link>
        </div>
      </div>
    );
  }

  const v = atual;
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

      <p className="ei-apoio ei-margem" style={{ marginTop: 4 }}>
        Dá para arrastar o cartão para o lado: direita é interesse, esquerda passa.
      </p>
    </div>
  );
}
