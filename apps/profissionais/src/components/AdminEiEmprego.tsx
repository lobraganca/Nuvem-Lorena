import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  panoramaDoEi,
  ligarPlano,
  desligarPlano,
  type EmpresaNoPainel,
  type NumerosDoEi,
} from "../lib/adminEi";
import { mensagemDeErro } from "../lib/erros";
import { PLANOS_EMPRESA, type JobListing, type PlanoEmpresa } from "../types/domain";

/**
 * O Ei Emprego dentro do painel de administração — em DUAS seções.
 *
 * ── O pedido ─────────────────────────────────────────────────────────
 *
 * A dona: "fazer o painel adm bem organizado. Onde cada sessão tenha um
 * botão para entrar, não complique tudo na mesma tela. Ter filtros para
 * encontrar mais fácil."
 *
 * A primeira versão empilhava tudo: cinco números, a lista de empresas
 * com os botões de plano e, embaixo, a lista de vagas. Numa cidade com
 * trinta empresas isso é uma tela de rolar sem fim, e para conferir uma
 * vaga era preciso passar por todas as empresas antes.
 *
 * Agora são duas portas — Empresas e Vagas —, e cada uma abre no seu
 * endereço (`/admin/empresas`, `/admin/vagas`). Os NÚMEROS subiram para o
 * menu do painel: eles respondem "como está o app hoje" sem entrar em
 * nada, que é justamente o que se quer de um resumo.
 *
 * ── Os filtros ───────────────────────────────────────────────────────
 *
 * Um campo de procurar e uma fileira de peneiras em cada lista. Procurar
 * cobre o caso de quem sabe o nome; as peneiras cobrem as perguntas que a
 * administração faz de verdade — "quem está sem plano?", "que vaga está
 * parada?" —, e essas não se digitam.
 *
 * ── O que este painel NÃO faz ────────────────────────────────────────
 *
 * Apagar empresa ou vaga (a 0112 nem dá a permissão): exclusão leva junto
 * as candidaturas, e painel é onde um toque errado apaga o trabalho de
 * outra pessoa.
 */
const DIAS_PADRAO = 30;

/** Um panorama só, servido às duas seções e ao resumo do menu. */
function usarPanorama() {
  const [numeros, setNumeros] = useState<NumerosDoEi | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaNoPainel[]>([]);
  const [vagas, setVagas] = useState<JobListing[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregar() {
    setErro("");
    try {
      const p = await panoramaDoEi();
      setNumeros(p.numeros);
      setEmpresas(p.empresas);
      setVagas(p.vagas);
    } catch (err) {
      /* Erro SOBE até a tela. "0 empresas" porque a permissão caiu é a
         pior coisa que um painel pode dizer: parece um app sem clientes. */
      setErro(mensagemDeErro(err, "Não consegui ler os dados do Ei Emprego."));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  return { numeros, empresas, vagas, carregando, erro, setErro, carregar };
}

const agoraMais = () => Date.now();
const emDia = (e: { plano: string | null; plano_ate: string | null }) =>
  !!e.plano && !!e.plano_ate && new Date(e.plano_ate).getTime() > agoraMais();
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

/** Sem acento e em minúsculas — quem procura "pao" tem de achar "Pão". */
const simples = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/* ══════════════════════════════════════════════════════════════════════
   OS NÚMEROS, no menu do painel
   ══════════════════════════════════════════════════════════════════════ */
export function AdminNumerosDoEi() {
  const { numeros, carregando, erro } = usarPanorama();

  if (carregando) return <p className="muted">Contando as empresas e as vagas…</p>;
  if (erro) return <p className="admin-resumo-erro">{erro}</p>;
  if (!numeros) return null;

  return (
    <div className="admin-resumo">
      <div className="admin-numero">
        <strong>{numeros.empresas}</strong>
        <span>{numeros.empresas === 1 ? "empresa" : "empresas"}</span>
      </div>
      {/* Empresas e ASSINANTES são números diferentes de propósito: a
          distância entre os dois é a distância entre um app usado e um app
          que fatura. */}
      <div className="admin-numero">
        <strong>{numeros.comPlano}</strong>
        <span>com plano em dia</span>
      </div>
      <div className="admin-numero">
        <strong>{numeros.vagasNoAr}</strong>
        <span>vagas no ar</span>
      </div>
      <div className="admin-numero">
        <strong>{numeros.vagasNovasNaSemana}</strong>
        <span>vagas nos 7 dias</span>
      </div>
      <div className="admin-numero">
        <strong>{numeros.candidaturas}</strong>
        <span>candidaturas</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   EMPRESAS
   ══════════════════════════════════════════════════════════════════════ */
type PeneiraEmpresa = "todas" | "com-plano" | "sem-plano" | "com-vaga" | "sem-telefone";

export function AdminEmpresas() {
  const { empresas, carregando, erro, setErro, carregar } = usarPanorama();
  const [busca, setBusca] = useState("");
  const [peneira, setPeneira] = useState<PeneiraEmpresa>("todas");
  const [mexendo, setMexendo] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const lista = useMemo(() => {
    const q = simples(busca.trim());
    return empresas.filter((e) => {
      if (peneira === "com-plano" && !emDia(e)) return false;
      if (peneira === "sem-plano" && emDia(e)) return false;
      if (peneira === "com-vaga" && e.vagasNoAr === 0) return false;
      if (peneira === "sem-telefone" && e.phone_verified) return false;
      if (!q) return true;
      /* Nome, telefone e documento: a administração procura pelos três, e
         quem liga para conferir tem o telefone na mão, não o nome exato. */
      return simples(
        [e.company_name, e.phone, e.cnpj, e.city].filter(Boolean).join(" ")
      ).includes(q);
    });
  }, [empresas, busca, peneira]);

  async function mudarPlano(empresa: EmpresaNoPainel, plano: PlanoEmpresa | null) {
    setMexendo(empresa.id);
    setErro("");
    try {
      if (plano) await ligarPlano(empresa.id, plano, DIAS_PADRAO);
      else await desligarPlano(empresa.id);
      await carregar();
      setAberta(null);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui mudar o plano desta empresa."));
    } finally {
      setMexendo(null);
    }
  }

  if (carregando) return <p className="muted">Lendo as empresas…</p>;

  return (
    <section>
      {erro && <p className="admin-resumo-erro">{erro}</p>}

      <Filtros
        busca={busca}
        setBusca={setBusca}
        rotuloBusca="Procurar por nome, telefone ou documento"
        opcoes={[
          ["todas", `Todas (${empresas.length})`],
          ["com-plano", `Com plano (${empresas.filter(emDia).length})`],
          ["sem-plano", `Sem plano (${empresas.filter((e) => !emDia(e)).length})`],
          ["com-vaga", `Com vaga no ar (${empresas.filter((e) => e.vagasNoAr > 0).length})`],
          ["sem-telefone", `Telefone não confirmado (${empresas.filter((e) => !e.phone_verified).length})`],
        ]}
        escolhida={peneira}
        escolher={(v) => setPeneira(v as PeneiraEmpresa)}
      />

      <p className="muted" style={{ margin: "10px 0 12px", fontSize: "0.85rem" }}>
        {lista.length === empresas.length
          ? `${empresas.length} ${empresas.length === 1 ? "empresa" : "empresas"}`
          : `${lista.length} de ${empresas.length}`}
      </p>

      {lista.length === 0 ? (
        <p className="muted">Nenhuma empresa com esse filtro.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {lista.map((e) => (
            <div key={e.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ overflowWrap: "anywhere" }}>{e.company_name}</strong>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.85rem" }}>
                    {[e.city, e.phone].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="muted" style={{ fontSize: "0.85rem", textAlign: "right", flexShrink: 0 }}>
                  {emDia(e)
                    ? `Plano ${PLANOS_EMPRESA[e.plano as PlanoEmpresa]?.nome ?? e.plano} até ${dia(e.plano_ate)}`
                    : "Sem plano"}
                </span>
              </div>

              <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
                {e.vagasNoAr === 0 ? "Nenhuma vaga no ar" : `${e.vagasNoAr} no ar`}
                {" · "}
                {e.candidaturas === 1 ? "1 candidatura" : `${e.candidaturas} candidaturas`}
                {e.phone_verified ? " · telefone confirmado" : " · telefone NÃO confirmado"}
              </p>

              {aberta === e.id ? (
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {/* Os planos com o nome que a empresa vê na tela de preços,
                      e não a palavra do banco: "tres" no botão faria a
                      administração ligar o plano errado. */}
                  {(Object.keys(PLANOS_EMPRESA) as PlanoEmpresa[]).map((p) => (
                    <button
                      key={p}
                      className="btn btn-outline"
                      disabled={mexendo === e.id}
                      onClick={() => mudarPlano(e, p)}
                    >
                      Ligar {PLANOS_EMPRESA[p].nome} por {DIAS_PADRAO} dias
                    </button>
                  ))}
                  {emDia(e) && (
                    <button
                      className="btn btn-outline"
                      style={{ color: "var(--color-danger)" }}
                      disabled={mexendo === e.id}
                      onClick={() => mudarPlano(e, null)}
                    >
                      Desligar o plano
                    </button>
                  )}
                  <button className="btn btn-text" onClick={() => setAberta(null)}>
                    Fechar
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-outline"
                    disabled={mexendo === e.id}
                    onClick={() => setAberta(e.id)}
                  >
                    {emDia(e) ? "Mudar ou renovar plano" : "Ligar um plano"}
                  </button>
                  {e.vagasNoAr > 0 && (
                    <Link className="btn btn-outline" to={`/empresa/${e.id}`}>
                      Ver como aparece
                    </Link>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   VAGAS
   ══════════════════════════════════════════════════════════════════════ */
type PeneiraVaga = "no-ar" | "pausadas" | "encerradas" | "todas";

const NOME_SITUACAO: Record<string, string> = {
  active: "No ar",
  paused: "Pausada",
  closed: "Encerrada",
};

export function AdminVagas() {
  const { empresas, vagas, carregando, erro } = usarPanorama();
  const [busca, setBusca] = useState("");
  /* Abre em "no ar" e não em "todas": a pergunta que traz alguém a esta
     tela é quase sempre sobre o que está publicado agora. */
  const [peneira, setPeneira] = useState<PeneiraVaga>("no-ar");

  const nomeDaEmpresa = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of empresas) m.set(e.id, e.company_name);
    return m;
  }, [empresas]);

  const lista = useMemo(() => {
    const q = simples(busca.trim());
    return vagas.filter((v) => {
      if (peneira === "no-ar" && v.status !== "active") return false;
      if (peneira === "pausadas" && v.status !== "paused") return false;
      if (peneira === "encerradas" && v.status !== "closed") return false;
      if (!q) return true;
      return simples(
        [v.title, v.profession, nomeDaEmpresa.get(v.company_id) ?? ""].filter(Boolean).join(" ")
      ).includes(q);
    });
  }, [vagas, busca, peneira, nomeDaEmpresa]);

  if (carregando) return <p className="muted">Lendo as vagas…</p>;

  const quantas = (s: string) => vagas.filter((v) => v.status === s).length;

  return (
    <section>
      {erro && <p className="admin-resumo-erro">{erro}</p>}

      <Filtros
        busca={busca}
        setBusca={setBusca}
        rotuloBusca="Procurar por vaga, ofício ou empresa"
        opcoes={[
          ["no-ar", `No ar (${quantas("active")})`],
          ["pausadas", `Pausadas (${quantas("paused")})`],
          ["encerradas", `Encerradas (${quantas("closed")})`],
          ["todas", `Todas (${vagas.length})`],
        ]}
        escolhida={peneira}
        escolher={(v) => setPeneira(v as PeneiraVaga)}
      />

      <p className="muted" style={{ margin: "10px 0 12px", fontSize: "0.85rem" }}>
        {lista.length === 1 ? "1 vaga" : `${lista.length} vagas`}
      </p>

      {lista.length === 0 ? (
        <p className="muted">Nenhuma vaga com esse filtro.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {lista.map((v) => (
            /* Cartão, e não link azul sublinhado: numa lista de vinte vagas
               o sublinhado vira uma parede de texto riscado. */
            <Link
              key={v.id}
              to={`/vaga-aberta/${v.id}`}
              className="card"
              style={{ padding: 12, display: "block", color: "inherit", textDecoration: "none" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ overflowWrap: "anywhere" }}>{v.title}</strong>
                <span className="muted" style={{ fontSize: "0.8rem", flexShrink: 0 }}>
                  {NOME_SITUACAO[v.status] ?? v.status}
                </span>
              </div>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.85rem" }}>
                {[
                  nomeDaEmpresa.get(v.company_id),
                  v.profession,
                  new Date(v.created_at).toLocaleDateString("pt-BR"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   O filtro das duas listas
   ══════════════════════════════════════════════════════════════════════

   Campo de procurar em cima, peneiras embaixo. As peneiras trazem a
   CONTAGEM no próprio rótulo: "Sem plano (7)" já responde a pergunta sem
   ninguém precisar tocar nela. */
function Filtros({
  busca,
  setBusca,
  rotuloBusca,
  opcoes,
  escolhida,
  escolher,
}: {
  busca: string;
  setBusca: (v: string) => void;
  rotuloBusca: string;
  opcoes: Array<[string, string]>;
  escolhida: string;
  escolher: (v: string) => void;
}) {
  return (
    <div className="admin-filtros">
      <label className="ei-campo-rotulo" htmlFor="admin-busca">
        {rotuloBusca}
      </label>
      <input
        id="admin-busca"
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <div className="admin-peneiras" role="group" aria-label="Filtrar a lista">
        {opcoes.map(([id, texto]) => (
          <button
            key={id}
            type="button"
            className={escolhida === id ? "admin-peneira ativa" : "admin-peneira"}
            aria-pressed={escolhida === id}
            onClick={() => escolher(id)}
          >
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}
