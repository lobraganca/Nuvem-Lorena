import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  isAdmin,
  listReports,
  reactivateProfessional,
  suspendProfessional,
  getDestaquesAtivos,
  getDemandaDeDestaque,
  type DestaqueAtivo,
  type DemandaDestaque,
  updateReportStatus,
  type ReportStatus,
  type ReportWithProfessional,
} from "../lib/admin";
import {
  DEFAULT_PAGE_SIZE,
  getCategoriasComAnuncio,
  isCurrentlyBoosted,
  isCurrentlyVerified,
  searchProfessionals,
  type ProfessionalWithRating,
} from "../lib/professionals";
import { listSuggestions, updateSuggestionStatus } from "../lib/suggestions";
import { atualizarStatusIndicacao, listarIndicacoes, type Indicacao } from "../lib/indicacoes";
import { CITIES, type Suggestion, type SuggestionStatus } from "../types/domain";
import { AdminBanners } from "../components/AdminBanners";

const STATUS_LABEL: Record<ReportStatus, string> = {
  pending: "Pendente",
  reviewed: "Revisada",
  dismissed: "Descartada",
};

const SUGGESTION_STATUS_LABEL: Record<SuggestionStatus, string> = {
  new: "Nova",
  reviewed: "Revisada",
};

export function AdminPage() {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState(false);
  const [reports, setReports] = useState<ReportWithProfessional[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [updatingSuggestion, setUpdatingSuggestion] = useState<string | null>(null);

  const [pros, setPros] = useState<ProfessionalWithRating[]>([]);
  const [prosLoading, setProsLoading] = useState(false);
  const [prosLoadingMore, setProsLoadingMore] = useState(false);
  const [prosPage, setProsPage] = useState(0);
  const [prosHasMore, setProsHasMore] = useState(false);
  const [cityFilter, setCityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  // Mesma regra da busca pública: os serviços do filtro vêm dos cadastros,
  // então os ofícios escritos à mão pelos anunciantes também são filtráveis
  // aqui — sem isso, moderar um deles exigiria rolar a lista inteira.
  const [categorias, setCategorias] = useState<string[]>([]);
  const [destaques, setDestaques] = useState<DestaqueAtivo[]>([]);
  const [demanda, setDemanda] = useState<DemandaDestaque[]>([]);
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);
  const [onlySuspended, setOnlySuspended] = useState(false);

  const [suspending, setSuspending] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});

  async function fetchPros(page: number) {
    return searchProfessionals({
      city: cityFilter || undefined,
      category: categoryFilter || undefined,
      onlySuspended: onlySuspended || undefined,
      page,
    });
  }

  async function refreshAll() {
    getCategoriasComAnuncio().then(setCategorias);
    getDestaquesAtivos().then(setDestaques);
    getDemandaDeDestaque().then(setDemanda);
    listarIndicacoes().then(setIndicacoes);
    setReports(await listReports());
    setSuggestions(await listSuggestions());
    const data = await fetchPros(0);
    setPros(data);
    setProsPage(0);
    setProsHasMore(data.length === DEFAULT_PAGE_SIZE);
  }

  async function loadMorePros() {
    const nextPage = prosPage + 1;
    setProsLoadingMore(true);
    try {
      const data = await fetchPros(nextPage);
      setPros((prev) => [...prev, ...data]);
      setProsPage(nextPage);
      setProsHasMore(data.length === DEFAULT_PAGE_SIZE);
    } finally {
      setProsLoadingMore(false);
    }
  }

  async function handleSuspend(professionalId: string, banDoc: boolean) {
    const reason = (reasonDraft[professionalId] ?? "").trim();
    if (!reason) {
      setMessage("Informe o motivo antes de tirar o anúncio do ar.");
      return;
    }
    setSuspending(professionalId);
    setMessage("");
    try {
      const { emailSent } = await suspendProfessional(professionalId, reason, banDoc);
      await refreshAll();
      setMessage(
        emailSent
          ? "Anúncio suspenso e dono avisado por e-mail."
          : "Anúncio suspenso. Não foi possível confirmar o envio do e-mail de aviso (ver README sobre configurar a Resend)."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao suspender anúncio.");
    } finally {
      setSuspending(null);
    }
  }

  async function handleReactivate(professionalId: string) {
    setSuspending(professionalId);
    setMessage("");
    try {
      await reactivateProfessional(professionalId);
      await refreshAll();
      setMessage("Anúncio reativado.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao reativar anúncio.");
    } finally {
      setSuspending(null);
    }
  }

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }
    setChecking(true);
    isAdmin(user.id).then(async (ok) => {
      setAdmin(ok);
      if (ok) {
        setReports(await listReports());
        setSuggestions(await listSuggestions());
        getCategoriasComAnuncio().then(setCategorias);
        getDestaquesAtivos().then(setDestaques);
        getDemandaDeDestaque().then(setDemanda);
        listarIndicacoes().then(setIndicacoes);
        const data = await searchProfessionals({ page: 0 });
        setPros(data);
        setProsPage(0);
        setProsHasMore(data.length === DEFAULT_PAGE_SIZE);
      }
      setChecking(false);
    });
  }, [user]);

  async function handleFilter(city: string, category: string, suspendedOnly: boolean) {
    setCityFilter(city);
    setCategoryFilter(category);
    setOnlySuspended(suspendedOnly);
    setProsLoading(true);
    try {
      const data = await searchProfessionals({
        city: city || undefined,
        category: category || undefined,
        onlySuspended: suspendedOnly || undefined,
        page: 0,
      });
      setPros(data);
      setProsPage(0);
      setProsHasMore(data.length === DEFAULT_PAGE_SIZE);
    } finally {
      setProsLoading(false);
    }
  }

  async function handleStatus(reportId: string, status: ReportStatus) {
    setUpdating(reportId);
    setMessage("");
    try {
      await updateReportStatus(reportId, status);
      setReports(await listReports());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao atualizar denúncia.");
    } finally {
      setUpdating(null);
    }
  }

  async function handleSuggestionReviewed(suggestionId: string) {
    setUpdatingSuggestion(suggestionId);
    setMessage("");
    try {
      await updateSuggestionStatus(suggestionId, "reviewed");
      setSuggestions(await listSuggestions());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao atualizar sugestão.");
    } finally {
      setUpdatingSuggestion(null);
    }
  }

  if (loading || checking) {
    return <div className="container" style={{ paddingTop: 40 }}>Carregando…</div>;
  }

  if (!user) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <p>Você precisa entrar para acessar esta página.</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <p>Acesso restrito.</p>
      </div>
    );
  }

  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1>Painel administrativo</h1>
      <p className="muted">
        {pendingCount === 0
          ? "Nenhuma denúncia pendente."
          : `${pendingCount} denúncia${pendingCount > 1 ? "s" : ""} pendente${pendingCount > 1 ? "s" : ""}.`}
      </p>
      {message && <p className="card">{message}</p>}

      {/* Primeiro do painel porque é o único bloco em que ela cria alguma
          coisa; os outros são para conferir o que já aconteceu. */}
      <section style={{ marginTop: 24 }}>
        <h2>Banners de publicidade</h2>
        <AdminBanners />
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Denúncias</h2>
        {reports.length === 0 && <p className="muted">Nenhuma denúncia recebida ainda.</p>}
        <div className="grid">
          {reports.map((r) => (
            <div
              key={r.id}
              className="card"
              style={
                r.status === "pending"
                  ? { border: "1px solid var(--color-primary)" }
                  : undefined
              }
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>
                  {r.professional_name ? (
                    <Link to={`/profissional/${r.professional_id}`}>{r.professional_name}</Link>
                  ) : (
                    "Anúncio removido"
                  )}
                </strong>
                <span
                  className="badge"
                  style={
                    r.status === "pending"
                      ? { color: "var(--color-primary)", borderColor: "var(--color-primary)" }
                      : { color: "var(--color-accent-teal)", borderColor: "var(--color-accent-teal)" }
                  }
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              <p style={{ margin: "8px 0 4px" }}>
                <strong>Motivo:</strong> {r.reason}
              </p>
              {r.details && <p className="muted" style={{ margin: "0 0 8px" }}>{r.details}</p>}
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                {new Date(r.created_at).toLocaleString("pt-BR")}
              </p>
              {r.status === "pending" && (
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-teal"
                    disabled={updating === r.id}
                    onClick={() => handleStatus(r.id, "reviewed")}
                  >
                    Marcar como revisada
                  </button>
                  <button
                    className="btn btn-outline"
                    disabled={updating === r.id}
                    onClick={() => handleStatus(r.id, "dismissed")}
                  >
                    Descartar
                  </button>
                </div>
              )}

              {r.professional_suspended ? (
                <div style={{ marginTop: 10 }}>
                  <span className="badge" style={{ color: "var(--color-primary)", borderColor: "var(--color-primary)" }}>
                    Anúncio fora do ar
                  </span>{" "}
                  <button
                    className="btn btn-outline"
                    style={{ marginTop: 8 }}
                    disabled={suspending === r.professional_id}
                    onClick={() => handleReactivate(r.professional_id)}
                  >
                    Reativar anúncio
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 10, borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
                  <input
                    placeholder="Motivo para tirar o anúncio do ar"
                    value={reasonDraft[r.professional_id] ?? ""}
                    onChange={(e) => setReasonDraft({ ...reasonDraft, [r.professional_id]: e.target.value })}
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn btn-outline"
                      disabled={suspending === r.professional_id}
                      onClick={() => handleSuspend(r.professional_id, false)}
                    >
                      Tirar anúncio do ar
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={suspending === r.professional_id}
                      onClick={() => handleSuspend(r.professional_id, true)}
                    >
                      Tirar do ar e bloquear novo cadastro
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Sugestões dos usuários</h2>
        {suggestions.length === 0 && <p className="muted">Nenhuma sugestão recebida ainda.</p>}
        <div className="grid">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="card"
              style={s.status === "new" ? { border: "1px solid var(--color-primary)" } : undefined}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  className="badge"
                  style={
                    s.status === "new"
                      ? { color: "var(--color-primary)", borderColor: "var(--color-primary)" }
                      : { color: "var(--color-accent-teal)", borderColor: "var(--color-accent-teal)" }
                  }
                >
                  {SUGGESTION_STATUS_LABEL[s.status]}
                </span>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  {new Date(s.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <p style={{ margin: "8px 0 4px" }}>{s.message}</p>
              {s.status === "new" && (
                <button
                  className="btn btn-teal"
                  style={{ marginTop: 8 }}
                  disabled={updatingSuggestion === s.id}
                  onClick={() => handleSuggestionReviewed(s.id)}
                >
                  Marcar como revisada
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Quem a cidade procurou e não achou</h2>
        <p className="muted" style={{ marginTop: -6 }}>
          Indicações deixadas por quem buscou e não encontrou ninguém. É a sua lista de prospecção — gente
          indicada por quem já conhece o trabalho.
        </p>
        {indicacoes.filter((i) => i.status === "nova").length === 0 ? (
          <p className="muted">Nenhuma indicação nova.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {indicacoes
              .filter((i) => i.status === "nova")
              .map((i) => (
                <div key={i.id} className="card" style={{ display: "grid", gap: 6 }}>
                  <strong>{i.nome_indicado || "(sem nome)"}</strong>
                  <span style={{ fontSize: "0.9rem" }}>
                    {i.contato_indicado ? (
                      <a href={`tel:${(i.contato_indicado ?? "").replace(/\D/g, "")}`}>{i.contato_indicado}</a>
                    ) : (
                      <span className="muted">sem telefone</span>
                    )}
                  </span>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>
                    Procuravam: <strong>{i.servico_buscado || "não informado"}</strong>
                    {i.cidade ? ` · ${i.cidade}` : ""} ·{" "}
                    {new Date(i.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn btn-outline"
                      onClick={async () => {
                        await atualizarStatusIndicacao(i.id, "contatada");
                        setIndicacoes(await listarIndicacoes());
                      }}
                    >
                      Já convidei
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={async () => {
                        await atualizarStatusIndicacao(i.id, "descartada");
                        setIndicacoes(await listarIndicacoes());
                      }}
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Destaques</h2>

        {/* A fila vem antes da lista de quem está turbinado de propósito: ela
            é a única informação aqui que pede uma decisão sua. Categoria com
            gente esperando é categoria onde o destaque está barato demais —
            e é o momento em que dá para subir o preço sem perder ninguém. */}
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>Quem está esperando vaga</strong>
          {demanda.length === 0 ? (
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.88rem" }}>
              Ninguém na fila. Todas as categorias têm vaga de destaque.
            </p>
          ) : (
            <>
              <p className="muted" style={{ margin: "6px 0 10px", fontSize: "0.85rem" }}>
                São 5 vagas por categoria e cidade. Fila cheia significa procura maior que a oferta.
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                {demanda.map((d) => (
                  <li key={`${d.city}-${d.category}`} style={{ fontSize: "0.9rem" }}>
                    <strong>
                      {d.esperando} {d.esperando === 1 ? "esperando" : "esperando"}
                    </strong>{" "}
                    em {d.category} · {d.city}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="card">
          <strong>Turbinados agora ({destaques.length})</strong>
          {destaques.length === 0 ? (
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.88rem" }}>
              Nenhum anúncio turbinado no momento.
            </p>
          ) : (
            <>
              <p className="muted" style={{ margin: "6px 0 10px", fontSize: "0.85rem" }}>
                Do que vence primeiro para o que vence por último — é a ordem em que as vagas voltam a abrir.
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
                {destaques.map((d) => {
                  const dias = d.boosted_until
                    ? Math.ceil((new Date(d.boosted_until).getTime() - Date.now()) / 86400000)
                    : null;
                  return (
                    <li key={d.id} style={{ fontSize: "0.9rem" }}>
                      <strong>{d.name}</strong> · {d.category} · {d.city}
                      <br />
                      <span className="muted" style={{ fontSize: "0.83rem" }}>
                        {d.boosted_until
                          ? `até ${new Date(d.boosted_until).toLocaleDateString("pt-BR")}${
                              dias !== null ? ` (${dias} ${dias === 1 ? "dia" : "dias"})` : ""
                            }`
                          : "sem data de término"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Profissionais cadastrados</h2>
        <p className="muted">{pros.length} anúncio{pros.length !== 1 ? "s" : ""} {prosLoading ? "(atualizando…)" : ""}</p>
        <div className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
          <select value={cityFilter} onChange={(e) => handleFilter(e.target.value, categoryFilter, onlySuspended)}>
            <option value="">Todas as cidades</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={categoryFilter} onChange={(e) => handleFilter(cityFilter, e.target.value, onlySuspended)}>
            <option value="">Todos os serviços</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.88rem" }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={onlySuspended}
              onChange={(e) => handleFilter(cityFilter, categoryFilter, e.target.checked)}
            />
            Somente suspensos
          </label>
        </div>
        <div className="grid">
          {pros.map((p) => {
            const verified = isCurrentlyVerified(p);
            const boosted = isCurrentlyBoosted(p);
            return (
            <div
              key={p.id}
              className="card"
              style={p.suspended ? { border: "1px solid var(--color-primary)" } : undefined}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Link to={`/profissional/${p.id}`}>
                  <strong>{p.name}</strong>
                </Link>
                <div style={{ display: "flex", gap: 6 }}>
                  {verified && <span className="badge badge-verified">Premium ativo</span>}
                  {boosted && <span className="badge badge-boosted">Destaque</span>}
                  {p.suspended && (
                    <span className="badge" style={{ color: "var(--color-primary)", borderColor: "var(--color-primary)" }}>
                      Fora do ar
                    </span>
                  )}
                </div>
              </div>
              <p className="muted">{p.category} · {p.city}</p>
              {p.suspended ? (
                <>
                  {p.suspended_reason && <p className="muted" style={{ fontSize: "0.85rem" }}>Motivo: {p.suspended_reason}</p>}
                  <button
                    className="btn btn-outline"
                    disabled={suspending === p.id}
                    onClick={() => handleReactivate(p.id)}
                  >
                    Reativar anúncio
                  </button>
                </>
              ) : (
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  <input
                    placeholder="Motivo para tirar o anúncio do ar"
                    value={reasonDraft[p.id] ?? ""}
                    onChange={(e) => setReasonDraft({ ...reasonDraft, [p.id]: e.target.value })}
                  />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="btn btn-outline" disabled={suspending === p.id} onClick={() => handleSuspend(p.id, false)}>
                      Tirar do ar
                    </button>
                    <button className="btn btn-primary" disabled={suspending === p.id} onClick={() => handleSuspend(p.id, true)}>
                      Tirar do ar e bloquear cadastro
                    </button>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
        {!prosLoading && prosHasMore && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button className="btn btn-outline" onClick={loadMorePros} disabled={prosLoadingMore}>
              {prosLoadingMore ? "Carregando…" : "Ver mais profissionais"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
