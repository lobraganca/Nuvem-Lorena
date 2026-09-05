import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
  resumoDeCadastros,
  type ResumoDeCadastros,
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
import { CITIES, type Suggestion, type SuggestionStatus } from "../types/domain";
import { AdminEmpresas, AdminVagas, AdminNumerosDoEi, AdminReembolsos } from "../components/AdminEiEmprego";
import {
  ligarDestaque,
  desligarDestaque,
  destaqueValendo,
  diasDeDestaqueRestantes,
  DESTAQUE_DIAS,
} from "../lib/destaque";
import { AdminCorrigir } from "../components/AdminCorrigir";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { mensagemDeErro } from "../lib/erros";

const STATUS_LABEL: Record<ReportStatus, string> = {
  pending: "Pendente",
  reviewed: "Revisada",
  dismissed: "Descartada",
};

const SUGGESTION_STATUS_LABEL: Record<SuggestionStatus, string> = {
  new: "Nova",
  reviewed: "Revisada",
};

/**
 * As seções do painel, cada uma com endereço próprio.
 *
 * Eram sete blocos empilhados numa página só: dinheiro, banners,
 * denúncias, sugestões, indicações, destaques e a lista de cadastros. No
 * celular isso é mais de vinte telas de rolagem, e a única forma de
 * chegar na última era passar pelas seis primeiras — inclusive quando a
 * pessoa abriu o painel sabendo exatamente o que ia fazer.
 *
 * Agora o painel abre como um menu, e cada seção é um endereço: dá para
 * ir direto, voltar, e mandar o link de uma delas.
 *
 * O `id` entra na URL, então mexer nele quebra links já salvos.
 */
const SECOES = [
  /* O Ei Emprego vem PRIMEIRO: é o app que está no ar hoje. As seções
     abaixo dele nasceram no outro produto e continuam servindo (denúncia,
     sugestão, banner), mas nenhuma responde "quantas empresas assinaram?"
     — que é a pergunta que a dona faz todo dia. */
  { id: "empresas", simbolo: "🏢", titulo: "Empresas", resumo: "Quem cadastrou, o plano de cada uma, e ligar ou renovar." },
  { id: "vagas", simbolo: "📢", titulo: "Vagas", resumo: "Tudo o que já foi publicado, com filtro por situação." },
  /* Reembolso vem logo depois de Vagas, e antes de Dinheiro: é o único
     item do painel em que alguém está ESPERANDO resposta. */
  { id: "reembolsos", simbolo: "↩️", titulo: "Pedidos de reembolso", resumo: "Quem pediu o dinheiro de volta, e por quê." },
  /* ── "DINHEIRO", "BANNERS" E "PROCURADOS" SAÍRAM — 04/09 ───────────
     A dona: "tudo dos apps tem que ser separados."

     As três eram do procurô e não tinham como funcionar aqui:

       Dinheiro   lia `processed_payments`, que o Ei NUNCA escreve —
                  a cobrança dele é manual, por Pix e WhatsApp. O painel
                  mostrava R$ 0 e ia continuar mostrando.
       Banners    publicidade vendida. O Ei não vende banner nem os
                  exibe em tela nenhuma.
       Procurados serviços que faltam na cidade, do outro produto.

     "Sugestões" e "Denúncias" FICARAM: o rodapé do Ei tem "Enviar
     sugestão", que escreve na primeira, e a segunda é a tabela para onde
     um dia vai a denúncia que hoje sai pelo WhatsApp. */
  { id: "denuncias", simbolo: "🚩", titulo: "Denúncias", resumo: "Reclamações sobre cadastros, para apurar." },
  { id: "sugestoes", simbolo: "💬", titulo: "Sugestões", resumo: "O que as pessoas pediram pelo app." },
  { id: "destaques", simbolo: "🔥", titulo: "Destaques", resumo: "Quem está no topo da busca e quem está na fila." },
  { id: "cadastros", simbolo: "📋", titulo: "Cadastros", resumo: "Ver, editar, reenquadrar foto e tirar do ar." },
] as const;

type SecaoId = (typeof SECOES)[number]["id"];

export function AdminPage() {
  useTituloDaPagina("Administração");
  const { user, loading } = useAuth();
  const { secao, tipo, id: idParaCorrigir } = useParams<{
    secao?: string;
    tipo?: string;
    id?: string;
  }>();
  /* A tela de corrigir é uma seção como as outras, só que com um id junto.
     Ela entra por `/admin/corrigir/:tipo/:id`, e é tratada antes de tudo:
     as listas nem chegam a ser lidas. */
  const corrigindo = !!tipo && !!idParaCorrigir;
  const secaoAberta = SECOES.find((s) => s.id === secao)?.id ?? null;
  /* Endereço inventado ("/admin/qualquercoisa") cai no menu em vez de numa
     página vazia — a pessoa erra o link e vê o painel, não um branco. */
  const mostrar = (id: SecaoId) => secaoAberta === id;
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
  /* Os números do topo dos cadastros. `null` enquanto carrega, e o erro é
     guardado à parte: um resumo que falha não pode virar zero na tela — a
     dona leria "0 hoje" e concluiria que ninguém se cadastrou. */
  const [resumo, setResumo] = useState<ResumoDeCadastros | null>(null);
  const [erroResumo, setErroResumo] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  // Mesma regra da busca pública: os serviços do filtro vêm dos cadastros,
  // então os ofícios escritos à mão por quem se cadastra também são filtráveis
  // aqui — sem isso, moderar um deles exigiria rolar a lista inteira.
  const [categorias, setCategorias] = useState<string[]>([]);
  const [destaques, setDestaques] = useState<DestaqueAtivo[]>([]);
  const [demanda, setDemanda] = useState<DemandaDestaque[]>([]);
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
    setErroResumo("");
    resumoDeCadastros()
      .then(setResumo)
      .catch((err) => setErroResumo(mensagemDeErro(err, "Não foi possível contar os cadastros.")));
    getCategoriasComAnuncio().then(setCategorias);
    getDestaquesAtivos().then(setDestaques);
    getDemandaDeDestaque().then(setDemanda);
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
    } catch (err) {
      setMessage(mensagemDeErro(err, "Não foi possível carregar mais cadastros."));
    } finally {
      setProsLoadingMore(false);
    }
  }

  async function handleSuspend(professionalId: string, banDoc: boolean) {
    const reason = (reasonDraft[professionalId] ?? "").trim();
    if (!reason) {
      setMessage("Informe o motivo antes de tirar o cadastro do ar.");
      return;
    }
    setSuspending(professionalId);
    setMessage("");
    try {
      const { emailSent } = await suspendProfessional(professionalId, reason, banDoc);
      await refreshAll();
      setMessage(
        emailSent
          ? "Cadastro suspenso e dono avisado por e-mail."
          : "Cadastro suspenso. Não foi possível confirmar o envio do e-mail de aviso (ver README sobre configurar a Resend)."
      );
    } catch (err) {
      setMessage(mensagemDeErro(err, "Erro ao suspender cadastro."));
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
      setMessage("Cadastro reativado.");
    } catch (err) {
      setMessage(mensagemDeErro(err, "Erro ao reativar cadastro."));
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
      /* O `finally` é o que garante que o painel abre.
         Sem ele, qualquer uma destas consultas falhando deixava
         `checking` ligado para sempre — e o painel inteiro parado em
         "Carregando…", sem nada escrito na tela explicando por quê. Foi
         essa a forma de várias horas perdidas por aqui. */
      try {
        /* Chama o `refreshAll` em vez de repetir o que ele faz. Este bloco
           era uma segunda cópia da mesma sequência, e as duas já tinham
           se afastado: o que se acrescentava aqui não acontecia depois de
           suspender um cadastro, e o que se acrescentava lá não acontecia
           ao abrir o painel. Foi assim que a contagem de cadastros entrou
           e não apareceu na tela — estava só na cópia errada. */
        if (ok) await refreshAll();
      } catch (err) {
        setMessage(mensagemDeErro(err, "Não foi possível carregar o painel."));
      } finally {
        setChecking(false);
      }
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
    } catch (err) {
      setMessage(mensagemDeErro(err, "Não foi possível filtrar os cadastros."));
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
      setMessage(mensagemDeErro(err, "Erro ao atualizar denúncia."));
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
      setMessage(mensagemDeErro(err, "Erro ao atualizar sugestão."));
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

  const novasSugestoes = suggestions.filter((s) => s.status === "new").length;
  /* Contagem só onde ela é completa. A lista de cadastros vem paginada, e
     um "20" no menu leria como "a cidade tem 20 cadastros" quando é só o
     tamanho da primeira página — número errado no lugar mais visível. */
  const pendencias: Partial<Record<SecaoId, number>> = {
    denuncias: pendingCount,
    sugestoes: novasSugestoes,
  };
  const aberta = SECOES.find((s) => s.id === secaoAberta);

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      {corrigindo ? (
        <>
          <Link to="/admin" className="voltar-link">
            ← Painel administrativo
          </Link>
          <h1 style={{ marginTop: 10 }}>
            {tipo === "empresa" ? "Corrigir empresa" : "Corrigir cadastro"}
          </h1>
          <p className="muted painel-subtitulo">
            Ajustar uma palavra, um bairro, uma foto — sem precisar pedir para a
            pessoa fazer.
          </p>
        </>
      ) : aberta ? (
        <>
          <Link to="/admin" className="voltar-link">
            ← Painel administrativo
          </Link>
          <h1 style={{ marginTop: 10 }}>{aberta.titulo}</h1>
          <p className="muted painel-subtitulo">{aberta.resumo}</p>
        </>
      ) : (
        <>
          <h1>Painel administrativo</h1>
          <p className="muted">
            {pendingCount === 0
              ? "Nenhuma denúncia pendente."
              : `${pendingCount} denúncia${pendingCount > 1 ? "s" : ""} pendente${pendingCount > 1 ? "s" : ""}.`}
          </p>
          {/* Os números do app ANTES do menu: eles respondem "como estamos
              hoje?" sem entrar em seção nenhuma, que é justamente o que se
              espera de um resumo. Dentro de uma seção eles obrigariam a
              abrir uma porta para saber se era preciso abri-la. */}
          <AdminNumerosDoEi />
        </>
      )}
      {message && <p className="card">{message}</p>}

      {/* O menu. Cada seção é um alvo grande com o nome, uma linha do que
          tem lá dentro e — onde a conta é confiável — quantas coisas estão
          esperando resposta. É o que responde "o que precisa de mim hoje?"
          sem abrir nada. */}
      {!aberta && !corrigindo && (
        <div className="admin-menu">
          {SECOES.map((s) => {
            const quantas = pendencias[s.id] ?? 0;
            return (
              <Link key={s.id} to={`/admin/${s.id}`} className="admin-menu-item">
                <span className="admin-menu-simbolo" aria-hidden="true">{s.simbolo}</span>
                <span className="admin-menu-texto">
                  <strong>{s.titulo}</strong>
                  <span className="muted">{s.resumo}</span>
                </span>
                {quantas > 0 && <span className="admin-menu-conta">{quantas}</span>}
              </Link>
            );
          })}
        </div>
      )}

      {mostrar("denuncias") && (
      <section>
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
                    "Cadastro removido"
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
                    Cadastro fora do ar
                  </span>{" "}
                  <button
                    className="btn btn-outline"
                    style={{ marginTop: 8 }}
                    disabled={suspending === r.professional_id}
                    onClick={() => handleReactivate(r.professional_id)}
                  >
                    Reativar cadastro
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 10, borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
                  {/* Rótulo visível no lugar do exemplo dentro do campo:
                      o que some ao digitar deixa de responder "o que era
                      para escrever aqui?" na hora em que a dúvida vem. */}
                  <span className="ei-campo-rotulo">Motivo para tirar o cadastro do ar</span>
                  <input
                    aria-label="Motivo para tirar o cadastro do ar"
                    value={reasonDraft[r.professional_id] ?? ""}
                    onChange={(e) => setReasonDraft({ ...reasonDraft, [r.professional_id]: e.target.value })}
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn btn-outline"
                      disabled={suspending === r.professional_id}
                      onClick={() => handleSuspend(r.professional_id, false)}
                    >
                      Tirar cadastro do ar
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
      )}

      {mostrar("sugestoes") && (
      <section>
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
      )}

      {mostrar("destaques") && (
      <section>

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
              Nenhum cadastro turbinado no momento.
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
      )}

      {corrigindo && <AdminCorrigir />}

      {mostrar("empresas") && <AdminEmpresas />}

      {mostrar("vagas") && <AdminVagas />}

      {mostrar("reembolsos") && <AdminReembolsos />}

      {mostrar("cadastros") && (
      <section>
        {/* Aqui ficava `pros.length`: o tamanho da lista já carregada, que
            chega de vinte em vinte. Dizia "20 cadastros" para qualquer
            cidade com mais de vinte — número errado no lugar onde se olha
            justamente para saber se o app está crescendo. */}
        {erroResumo ? (
          <p className="admin-resumo-erro">{erroResumo}</p>
        ) : !resumo ? (
          <p className="muted">Contando os cadastros…</p>
        ) : (
          <div className="admin-resumo">
            <div className="admin-numero">
              <strong>{resumo.pessoas}</strong>
              <span>{resumo.pessoas === 1 ? "pessoa" : "pessoas"}</span>
            </div>
            {/* Cadastros e pessoas são números diferentes de propósito: uma
                pessoa pode ter até cinco cadastros, e a distância entre 40
                cadastros e 12 pessoas é a distância entre uma cidade que
                aderiu e uma que não aderiu. */}
            <div className="admin-numero">
              <strong>{resumo.cadastros}</strong>
              <span>{resumo.cadastros === 1 ? "cadastro" : "cadastros"}</span>
            </div>
            <div className="admin-numero">
              <strong>{resumo.hoje}</strong>
              <span>hoje</span>
            </div>
            <div className="admin-numero">
              <strong>{resumo.semana}</strong>
              <span>nos 7 dias</span>
            </div>
            {resumo.foraDoAr > 0 && (
              <div className="admin-numero admin-numero-alerta">
                <strong>{resumo.foraDoAr}</strong>
                <span>não aparecem</span>
              </div>
            )}
          </div>
        )}
        {/* O detalhe do "não aparecem" fica escrito por extenso, e não em
            mais cinco caixinhas: cada motivo tem um conserto diferente, e
            "cidade fora da lista" é o único que a pessoa cadastrada não
            tem como perceber sozinha. */}
        {resumo && resumo.foraDoAr > 0 && (
          <p className="muted admin-resumo-detalhe">
            {[
              resumo.suspensos > 0 && `${resumo.suspensos} suspenso${resumo.suspensos > 1 ? "s" : ""} pela administração`,
              resumo.pausados > 0 && `${resumo.pausados} pausado${resumo.pausados > 1 ? "s" : ""} pelo próprio dono`,
              resumo.cidadeDeFora > 0 && `${resumo.cidadeDeFora} com cidade fora da lista do app`,
              resumo.semServico > 0 && `${resumo.semServico} sem nenhum serviço marcado`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {prosLoading && <p className="muted">Atualizando a lista…</p>}
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
              {/* A foto entra na lista porque é ela que a administração
                  precisa julgar: foto torta, cortada no pescoço ou tirada
                  de longe demais não dá erro em lugar nenhum — só afunda o
                  cadastro na busca, e o dono nunca fica sabendo. Sem ver a
                  foto aqui, não havia como saber quais valia a pena
                  reenquadrar. */}
              <div className="admin-topo-cadastro">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.name} className="admin-foto" loading="lazy" decoding="async" />
                ) : (
                  <span className="admin-foto admin-foto-vazia" aria-hidden="true">
                    {p.entity_type === "pj" ? "🏢" : "👤"}
                  </span>
                )}
                <div className="admin-topo-texto">
                  <Link to={`/profissional/${p.id}`}>
                    <strong>{p.name}</strong>
                  </Link>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  {verified && <span className="badge badge-verified">Premium ativo</span>}
                  {boosted && <span className="badge badge-boosted">Em destaque</span>}
                  {p.suspended && (
                    <span className="badge" style={{ color: "var(--color-primary)", borderColor: "var(--color-primary)" }}>
                      Fora do ar
                    </span>
                  )}
                </div>
                </div>
              </div>
              <p className="muted">{p.category} · {p.city}</p>
              {/* ── ESTE BOTÃO IA PARA LUGAR NENHUM — 03/09 ─────────────
                  Ele apontava para `/painel/editar/:id`, uma rota que NÃO
                  EXISTE no app: quem tocasse caía numa tela em branco. O
                  comentário antigo dizia que ele levava "à mesma tela que o
                  dono usa" — e essa tela edita o cadastro de QUEM ESTÁ
                  LOGADO, não o de outra pessoa; ela nem aceitaria um id.

                  Agora vai para a tela de correção da administração, que a
                  dona pediu: consertar uma palavra, um bairro, uma foto. Ela
                  mexe só nisso — telefone confirmado, plano e situação
                  continuam cada um no seu lugar. */}
              <Link
                className="btn btn-outline"
                to={`/admin/corrigir/profissional/${p.id}`}
                style={{ marginTop: 4 }}
              >
                Corrigir cadastro e foto
              </Link>

              {/* ── LIGAR O DESTAQUE DE 7 DIAS — 04/09 ──────────────────
                  A dona: "vou fazer um plano pra quem quer aparecer na
                  lista primeiro. R$ 10,90 por 7 dias."

                  Enquanto a cobrança dentro do app não existe, quem vende
                  é ela, por Pix — e ligar o destaque não pode ser um
                  `update` escrito à mão no painel do Supabase, que é como
                  o plano de empresa era ligado antes (e um `update` sem
                  `where`, num dia cansado, põe a cidade inteira no topo).

                  A validade é contada a partir de AGORA, e não somada à
                  antiga: quem paga de novo quer 7 dias inteiros. */}
              <BotaoDestaque profissional={p} />
              {p.suspended ? (
                <>
                  {p.suspended_reason && <p className="muted" style={{ fontSize: "0.85rem" }}>Motivo: {p.suspended_reason}</p>}
                  <button
                    className="btn btn-outline"
                    disabled={suspending === p.id}
                    onClick={() => handleReactivate(p.id)}
                  >
                    Reativar cadastro
                  </button>
                </>
              ) : (
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  {/* Rótulo visível no lugar do exemplo dentro do campo:
                      o que some ao digitar deixa de responder "o que era
                      para escrever aqui?" na hora em que a dúvida vem. */}
                  <span className="ei-campo-rotulo">Motivo para tirar o cadastro do ar</span>
                  <input
                    aria-label="Motivo para tirar o cadastro do ar"
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
      )}
    </div>
  );
}

/**
 * Liga e desliga o destaque de 7 dias de um cadastro.
 *
 * Fica aqui, e não em `AdminEiEmprego`, porque a lista de cadastros mora
 * nesta tela — e uma linha só de estado (o botão que está mexendo agora)
 * não justifica um arquivo novo.
 *
 * O estado é local ao botão de propósito: a lista de cadastros do painel
 * chega em páginas e é remontada quando se carrega mais, e guardar o
 * resultado lá em cima faria o "ligado até tal dia" sumir a cada página
 * nova.
 */
/* Os prazos que o painel oferece. O primeiro é o VENDIDO (7 dias); os
   outros dois existem para o brinde, que é o pedido da dona. Lista fixa e
   não campo livre: ver o comentário em `ligar`. */
const PRAZOS_DE_DESTAQUE = [7, 15, 30] as const;

function BotaoDestaque({
  profissional,
}: {
  profissional: { id: string; boosted?: boolean | null; boosted_until?: string | null };
}) {
  const [ate, setAte] = useState<string | null>(profissional.boosted_until ?? null);
  const [ligado, setLigado] = useState(destaqueValendo(profissional));
  const [mexendo, setMexendo] = useState(false);
  const [erro, setErro] = useState("");

  /* ── O BRINDE ESCOLHE O PRAZO — 05/09 ──────────────────────────────
     A dona: "no painel, pode ter a opção de eu destacar uma pessoa por
     minha conta própria. Como um brinde."

     O botão já existia e já sabia receber um número de dias — só nunca
     oferecia a escolha: era sempre 7, que é o prazo VENDIDO. E brinde com
     o prazo da venda não é brinde, é uma amostra: não dá para agradecer
     quem indicou a cidade inteira com a mesma semana que o vizinho pagou.

     Três prazos, e não um campo de digitar: data escrita à mão no painel
     é onde nasce o "destaque até 2027" por um dedo errado — e como o
     destaque só sai sozinho pela data, um erro desses fica no ar um ano.

     Vale para os dois usos, o brinde e a entrega de quem pagou por fora
     enquanto a cobrança automática não existe. */
  async function ligar(dias = DESTAQUE_DIAS) {
    setMexendo(true);
    setErro("");
    try {
      const nova = await ligarDestaque(profissional.id, dias);
      setAte(nova);
      setLigado(true);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui ligar o destaque."));
    } finally {
      setMexendo(false);
    }
  }

  async function desligar() {
    setMexendo(true);
    setErro("");
    try {
      await desligarDestaque(profissional.id);
      setAte(null);
      setLigado(false);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui desligar o destaque."));
    } finally {
      setMexendo(false);
    }
  }

  const faltam = diasDeDestaqueRestantes(ate);

  return (
    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
      {ligado ? (
        <>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Em alta — {faltam === 1 ? "termina amanhã" : `faltam ${faltam} dias`}
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRAZOS_DE_DESTAQUE.map((d) => (
              <button
                key={d}
                className="btn btn-outline"
                disabled={mexendo}
                onClick={() => ligar(d)}
              >
                +{d} dias
              </button>
            ))}
            <button className="btn btn-outline" disabled={mexendo} onClick={desligar}>
              Desligar destaque
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Ligar destaque — de brinde, ou para quem pagou por fora
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRAZOS_DE_DESTAQUE.map((d) => (
              <button
                key={d}
                className="btn btn-outline"
                disabled={mexendo}
                onClick={() => ligar(d)}
              >
                {d} dias
              </button>
            ))}
          </div>
        </>
      )}
      {erro && <p className="admin-resumo-erro">{erro}</p>}
    </div>
  );
}
