import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { obterVaga, obterOndasDaVaga, obterRespostasDaVaga, fecharVaga } from "../lib/company";
import { mensagemDeErro } from "../lib/erros";
import type { JobListing, JobDispatch, JobResponse } from "../types/domain";

/**
 * Detalhes de uma vaga: dados, ondas, e respostas de profissionais.
 */
export function DetalheVagaPage() {
  const { id: vagaId } = useParams<{ id: string }>();
  const navegar = useNavigate();
  const { user } = useAuth();

  const [vaga, setVaga] = useState<JobListing | null>(null);
  const [ondas, setOndas] = useState<JobDispatch[]>([]);
  const [respostas, setRespostas] = useState<JobResponse[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [fechando, setFechando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!vagaId) {
      navegar("/painel-empresa", { replace: true });
      return;
    }

    carregarDados();
  }, [vagaId, navegar]);

  async function carregarDados() {
    try {
      const v = await obterVaga(vagaId!);
      if (!v) {
        setErro("Vaga não encontrada.");
        return;
      }
      setVaga(v);

      const o = await obterOndasDaVaga(vagaId!);
      setOndas(o);

      const r = await obterRespostasDaVaga(vagaId!);
      setRespostas(r);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível carregar a vaga."));
    } finally {
      setCarregando(false);
    }
  }

  async function fecharVagaFunc() {
    if (!vagaId) return;
    setFechando(true);

    try {
      await fecharVaga(vagaId);
      navegar("/painel-empresa", { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível fechar a vaga."));
      setFechando(false);
    }
  }

  if (carregando) {
    return <div className="container" style={{ paddingTop: 48 }}>
      <span className="muted">Carregando…</span>
    </div>;
  }

  if (!vaga) {
    return <div className="container" style={{ paddingTop: 48 }}>
      <p className="muted">{erro || "Vaga não encontrada."}</p>
      <button className="btn btn-primary" onClick={() => navegar("/painel-empresa")}>
        Voltar ao painel
      </button>
    </div>;
  }

  const totalProfissionais = ondas.reduce((sum, o) => sum + o.professionals_count, 0);

  return (
    <div className="container detalhe-vaga" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <button
        className="btn btn-link"
        onClick={() => navegar("/painel-empresa")}
        style={{ marginBottom: 16 }}
      >
        ← Voltar
      </button>

      <h1>{vaga.title}</h1>
      <p className="muted">{vaga.profession}</p>

      {erro && (
        <div style={{ color: "var(--color-danger)", marginBottom: 16, padding: 12, backgroundColor: "var(--color-danger-light)", borderRadius: 8 }}>
          {erro}
        </div>
      )}

      {/* Dados da vaga */}
      <section className="card" style={{ marginBottom: 24, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Detalhes da vaga</h2>

        {vaga.description && (
          <div style={{ marginBottom: 12 }}>
            <strong>Descrição:</strong>
            <p style={{ margin: "4px 0 0 0" }}>{vaga.description}</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <strong>Modalidade:</strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.95em" }}>{vaga.work_modality}</p>
          </div>
          <div>
            <strong>Criada em:</strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.95em" }}>
              {new Date(vaga.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
          {vaga.required_experience && (
            <div>
              <strong>Experiência:</strong>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.95em" }}>{vaga.required_experience}</p>
            </div>
          )}
          {vaga.salary_range_min && vaga.salary_range_max && (
            <div>
              <strong>Faixa salarial:</strong>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.95em" }}>
                R$ {(vaga.salary_range_min / 100).toLocaleString("pt-BR")} - R$ {(vaga.salary_range_max / 100).toLocaleString("pt-BR")}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Status das ondas */}
      <section className="card" style={{ marginBottom: 24, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Status das ondas</h2>

        {ondas.length === 0 ? (
          <p className="muted">Nenhuma onda disparada ainda.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {ondas.map((onda) => (
              <div
                key={onda.id}
                style={{
                  padding: 12,
                  backgroundColor: "var(--color-bg-input)",
                  borderRadius: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>Onda {onda.wave}</strong>
                  <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.9em" }}>
                    Disparada em {new Date(onda.sent_at).toLocaleDateString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>
                    {onda.professionals_count}
                  </div>
                  <div className="muted" style={{ fontSize: "0.85em" }}>profissionais</div>
                </div>
              </div>
            ))}

            <div
              style={{
                padding: 12,
                backgroundColor: "var(--color-primary-light)",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              <strong>Total: {totalProfissionais} profissionais disparados</strong>
            </div>
          </div>
        )}
      </section>

      {/* Respostas */}
      <section className="card" style={{ marginBottom: 24, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>
          Profissionais interessados
          {respostas.length > 0 && ` (${respostas.length})`}
        </h2>

        {respostas.length === 0 ? (
          <p className="muted">Nenhum profissional respondeu ainda.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {respostas.map((resp) => (
              <div
                key={resp.id}
                style={{
                  padding: 12,
                  backgroundColor: "var(--color-bg-input)",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>Profissional ID: {resp.professional_id.substring(0, 8)}…</strong>
                    <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.9em" }}>
                      Respondeu em {new Date(resp.responded_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <button className="btn btn-primary btn-sm">
                    Ver perfil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ações */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          className="btn btn-secondary"
          onClick={() => navegar("/painel-empresa")}
        >
          Voltar
        </button>
        {vaga.status === "active" && (
          <button
            className="btn btn-danger"
            onClick={fecharVagaFunc}
            disabled={fechando}
          >
            {fechando ? "Fechando…" : "Fechar vaga"}
          </button>
        )}
      </div>
    </div>
  );
}
