import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { mensagemDeErro } from "../../lib/erros";
import { useAuth } from "../../lib/useAuth";
import { bancoDeVagas, type VagaNoBanco } from "../../lib/bancoDeVagas";
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

  function mudarParams(mudanca: { q?: string; c?: string | null }) {
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

        {visiveis.length > 0 && (
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
