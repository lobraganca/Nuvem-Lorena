import { useEffect, useState } from "react";
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
 * O Ei Emprego dentro do painel de administração.
 *
 * ── Por que faltava ──────────────────────────────────────────────────
 *
 * O painel veio inteiro do outro produto: denúncias, banners, destaques,
 * dinheiro de créditos. Do app que existe hoje — empresas publicando vaga
 * e gente se candidatando — não havia uma linha. A dona não tinha como
 * responder "quantas empresas assinaram?" nem "quantas vagas estão no
 * ar?" sem abrir o banco.
 *
 * ── E por que ele liga plano ─────────────────────────────────────────
 *
 * Porque a cobrança ainda não existe, e ligar plano era um `update` colado
 * à mão no SQL Editor, uma empresa por vez. Um comando sem `where`, num
 * dia cansado, liga plano para a cidade inteira. Aqui é um botão, com o
 * nome da empresa na frente.
 *
 * ── O que ele NÃO faz ────────────────────────────────────────────────
 *
 * Apagar empresa ou vaga (a 0112 nem dá essa permissão): exclusão leva
 * junto as candidaturas, e um painel é onde o toque errado apaga o
 * trabalho de outra pessoa. Tirar do ar já resolve, e se desfaz.
 */
const DIAS_PADRAO = 30;

export function AdminEiEmprego() {
  const [numeros, setNumeros] = useState<NumerosDoEi | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaNoPainel[]>([]);
  const [vagas, setVagas] = useState<JobListing[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mexendo, setMexendo] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

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

  if (carregando) return <p className="muted">Lendo as empresas e as vagas…</p>;

  const agora = Date.now();
  const emDia = (e: EmpresaNoPainel) =>
    !!e.plano && !!e.plano_ate && new Date(e.plano_ate).getTime() > agora;
  const dia = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

  const vagasNoAr = vagas.filter((v) => v.status === "active");

  return (
    <section>
      {erro && <p className="admin-resumo-erro">{erro}</p>}

      {numeros && (
        <div className="admin-resumo">
          <div className="admin-numero">
            <strong>{numeros.empresas}</strong>
            <span>{numeros.empresas === 1 ? "empresa" : "empresas"}</span>
          </div>
          {/* Empresas e ASSINANTES são números diferentes de propósito: a
              distância entre os dois é a distância entre um app usado e um
              app que fatura. */}
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
      )}

      <h2 style={{ fontSize: "1rem", margin: "18px 0 8px" }}>Empresas</h2>
      {empresas.length === 0 ? (
        <p className="muted">Nenhuma empresa cadastrada ainda.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {empresas.map((e) => (
            <div key={e.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ overflowWrap: "anywhere" }}>{e.company_name}</strong>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.85rem" }}>
                    {[e.city, e.phone].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span
                  className="muted"
                  style={{ fontSize: "0.85rem", textAlign: "right", flexShrink: 0 }}
                >
                  {emDia(e)
                    ? `Plano ${PLANOS_EMPRESA[e.plano as PlanoEmpresa]?.nome ?? e.plano} até ${dia(e.plano_ate)}`
                    : "Sem plano"}
                </span>
              </div>

              <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
                {e.vagasNoAr === 0 ? "Nenhuma vaga no ar" : `${e.vagasNoAr} no ar`}
                {" · "}
                {e.candidaturas === 1 ? "1 candidatura" : `${e.candidaturas} candidaturas`}
                {e.phone_verified ? " · telefone confirmado" : " · telefone não confirmado"}
              </p>

              {aberta === e.id ? (
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {/* Os planos com o nome que a empresa vê na tela de
                      preços, e não a palavra do banco: "tres" no botão
                      faria a administração ligar o plano errado. */}
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

      <h2 style={{ fontSize: "1rem", margin: "22px 0 8px" }}>
        Vagas no ar {vagasNoAr.length > 0 && `(${vagasNoAr.length})`}
      </h2>
      {vagasNoAr.length === 0 ? (
        <p className="muted">Nenhuma vaga publicada no momento.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {vagasNoAr.map((v) => {
            const empresa = empresas.find((e) => e.id === v.company_id);
            return (
              /* Cartão, e não link azul sublinhado: numa lista de vinte
                 vagas o sublinhado vira uma parede de texto riscado. */
              <Link
                key={v.id}
                to={`/vaga-aberta/${v.id}`}
                className="card"
                style={{ padding: 12, display: "block", color: "inherit", textDecoration: "none" }}
              >
                <strong style={{ overflowWrap: "anywhere" }}>{v.title}</strong>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.85rem" }}>
                  {[empresa?.company_name, v.profession, new Date(v.created_at).toLocaleDateString("pt-BR")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
