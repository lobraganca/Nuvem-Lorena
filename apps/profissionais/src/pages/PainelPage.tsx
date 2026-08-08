import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  getMyProfessionals,
  countRecentProfileViews,
  getContactRequests,
  updateContactRequestStatus,
  isCurrentlyBoosted,
  isCurrentlyVerified,
  isCurrentlyPlusActive,
  upsertProfessional,
  getLeadCredits,
  updateContactMode,
  getMySponsorships,
} from "../lib/professionals";
import {
  startSubscriptionCheckout,
  startAnnualSubscriptionCheckout,
  startAnnualCheckout,
  startCreditsCheckout,
  startSponsorshipCheckout,
  annualPrice,
  PRICES,
} from "../lib/payments";
import { CATEGORIES, CITIES, DEFAULT_CITY, CREDIT_PACKS, MAX_CATEGORIES, SPONSORSHIP_PLANS, type CategorySponsorship, type ContactMode, type ContactRequest, type ContactRequestStatus, type LeadCredits, type Professional, type SubscriptionType } from "../types/domain";
import { formatDocument, isValidDocument } from "../lib/documents";
import { uploadProfessionalPhoto } from "../lib/storage";
import { BottomSheet } from "../components/BottomSheet";

type FormState = Omit<
  Professional,
  | "id"
  | "created_at"
  | "verified"
  | "verified_until"
  | "boosted"
  | "boosted_until"
  | "suspended"
  | "suspended_reason"
  | "contact_mode"
  | "plus_active"
  | "plus_until"
> & { id?: string };

const EMPTY: FormState = {
  owner_id: "",
  name: "",
  category: CATEGORIES[0],
  categories: [CATEGORIES[0]],
  city: DEFAULT_CITY,
  bio: "",
  phone: "",
  whatsapp: "",
  email: "",
  instagram: "",
  linkedin: "",
  entity_type: "pf",
  document: "",
  company_name: "",
  photo_url: null,
  responsible_name: "",
};

const NAME_MAX_LENGTH = 80;

export function PainelPage() {
  const { user, loading } = useAuth();
  const [mine, setMine] = useState<Professional[]>([]);
  /** Visualizações dos últimos 30 dias por anúncio — grátis para todo anunciante. */
  const [views30, setViews30] = useState<Record<string, number>>({});
  /** Pedidos de contato por anúncio (quem deixou o número pedindo retorno). */
  const [pedidos, setPedidos] = useState<Record<string, ContactRequest[]>>({});
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [leadCreditsByProfessional, setLeadCreditsByProfessional] = useState<Record<string, LeadCredits | null>>({});
  const [sponsorSheetFor, setSponsorSheetFor] = useState<Professional | null>(null);
  const [sponsorDays, setSponsorDays] = useState<number>(SPONSORSHIP_PLANS[0].days);
  const [mySponsorships, setMySponsorships] = useState<Record<string, CategorySponsorship[]>>({});
  const [planSheetFor, setPlanSheetFor] = useState<{ professional: Professional; type: SubscriptionType } | null>(null);

  const isEditing = !!form.id;

  useEffect(() => {
    if (user) getMyProfessionals(user.id).then(setMine);
  }, [user]);

  useEffect(() => {
    mine.forEach((p) => {
      getLeadCredits(p.id).then((credits) => setLeadCreditsByProfessional((prev) => ({ ...prev, [p.id]: credits })));
      getMySponsorships(p.id).then((list) => setMySponsorships((prev) => ({ ...prev, [p.id]: list })));
    });
  }, [mine]);

  async function handleContactModeChange(professionalId: string, mode: ContactMode) {
    setMessage("");
    try {
      await updateContactMode(professionalId, mode);
      setMine((prev) => prev.map((p) => (p.id === professionalId ? { ...p, contact_mode: mode } : p)));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível atualizar o modo de contato.");
    }
  }

  async function handleBuyCredits(professionalId: string, quantity: number) {
    setCheckoutLoading(`${professionalId}:credits`);
    setMessage("");
    try {
      const { initPoint } = await startCreditsCheckout(professionalId, quantity);
      window.location.href = initPoint;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível iniciar a compra de créditos.");
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleSponsor(professional: Professional) {
    setCheckoutLoading(`${professional.id}:sponsor`);
    setMessage("");
    try {
      const { initPoint } = await startSponsorshipCheckout(professional.id, professional.category, professional.city, sponsorDays);
      window.location.href = initPoint;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível iniciar o patrocínio de categoria.");
    } finally {
      setCheckoutLoading(null);
      setSponsorSheetFor(null);
    }
  }

  function resetForm() {
    setForm(EMPTY);
    setPhotoFile(null);
    setPhotoPreview(null);
    setAcceptedTerms(false);
  }

  function startEdit(p: Professional) {
    setForm({
      id: p.id,
      owner_id: p.owner_id,
      name: p.name,
      category: p.category,
      categories: p.categories?.length ? p.categories : [p.category],
      city: p.city,
      bio: p.bio,
      phone: p.phone,
      whatsapp: p.whatsapp ?? "",
      email: p.email ?? "",
      instagram: p.instagram ?? "",
      linkedin: p.linkedin ?? "",
      entity_type: p.entity_type,
      document: p.document ? formatDocument(p.document, p.entity_type) : "",
      company_name: p.company_name ?? "",
      photo_url: p.photo_url,
      responsible_name: p.responsible_name ?? "",
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setAcceptedTerms(true);
    setMessage("");
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  useEffect(() => {
    if (mine.length === 0) return;
    let active = true;
    Promise.all(mine.map((p) => countRecentProfileViews(p.id).then((n) => [p.id, n] as const))).then((pares) => {
      if (active) setViews30(Object.fromEntries(pares));
    });
    return () => {
      active = false;
    };
  }, [mine]);

  async function carregarPedidos() {
    const pares = await Promise.all(
      mine.map((p) =>
        getContactRequests(p.id, { includeArchived: mostrarArquivados }).then((lista) => [p.id, lista] as const)
      )
    );
    setPedidos(Object.fromEntries(pares));
  }

  useEffect(() => {
    if (mine.length === 0) return;
    let active = true;
    Promise.all(
      mine.map((p) =>
        getContactRequests(p.id, { includeArchived: mostrarArquivados }).then((lista) => [p.id, lista] as const)
      )
    ).then((pares) => {
      if (active) setPedidos(Object.fromEntries(pares));
    });
    return () => {
      active = false;
    };
  }, [mine, mostrarArquivados]);

  async function marcarPedido(requestId: string, status: ContactRequestStatus) {
    await updateContactRequestStatus(requestId, status);
    await carregarPedidos();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setMessage("");

    if (form.categories.length === 0) {
      setMessage("Marque pelo menos um serviço que você faz.");
      return;
    }
    if (form.document && !isValidDocument(form.document, form.entity_type)) {
      setMessage(form.entity_type === "pj" ? "CNPJ inválido. Confira os números digitados." : "CPF inválido. Confira os números digitados.");
      return;
    }
    if (form.entity_type === "pf" && !photoFile && !form.photo_url) {
      setMessage("Envie uma foto de rosto para publicar o anúncio de pessoa física.");
      return;
    }
    if (form.entity_type === "pj" && !form.responsible_name?.trim()) {
      setMessage("Informe o nome do responsável pela empresa.");
      return;
    }
    if (!acceptedTerms) {
      setMessage("Para publicar, é preciso concordar com os Termos de Uso.");
      return;
    }

    setSaving(true);
    try {
      let photoUrl = form.photo_url;
      if (photoFile) {
        photoUrl = await uploadProfessionalPhoto(user.id, photoFile);
      }
      await upsertProfessional({
        ...form,
        owner_id: user.id,
        document: form.document ? form.document.replace(/\D/g, "") : null,
        company_name: form.entity_type === "pj" ? form.company_name || null : null,
        responsible_name: form.entity_type === "pj" ? form.responsible_name || null : null,
        photo_url: photoUrl,
      });
      const wasEditing = isEditing;
      resetForm();
      setMine(await getMyProfessionals(user.id));
      setMessage(wasEditing ? "Anúncio atualizado." : "Anúncio salvo.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubscribeMonthly(professionalId: string, type: SubscriptionType) {
    setCheckoutLoading(`${professionalId}:${type}:monthly`);
    setMessage("");
    try {
      const { initPoint } = await startSubscriptionCheckout(professionalId, type);
      window.location.href = initPoint;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível iniciar o checkout do Mercado Pago.");
    } finally {
      setCheckoutLoading(null);
      setPlanSheetFor(null);
    }
  }

  /** Anual no cartão: preapproval de 12 meses — renova sozinho todo ano. */
  async function handleSubscribeAnnualCard(professionalId: string, type: SubscriptionType) {
    setCheckoutLoading(`${professionalId}:${type}:annual-card`);
    setMessage("");
    try {
      const { initPoint } = await startAnnualSubscriptionCheckout(professionalId, type);
      window.location.href = initPoint;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível iniciar o checkout do Mercado Pago.");
    } finally {
      setCheckoutLoading(null);
      setPlanSheetFor(null);
    }
  }

  /**
   * Anual no Pix/boleto: pagamento único (Pix/boleto não têm débito
   * automático). Perto do vencimento, o dono recebe um e-mail com a nova
   * cobrança pronta — mas a renovação em si depende de ele pagar.
   */
  async function handleSubscribeAnnualOneTime(professionalId: string, type: SubscriptionType) {
    setCheckoutLoading(`${professionalId}:${type}:annual-pix`);
    setMessage("");
    try {
      const { initPoint } = await startAnnualCheckout(professionalId, type);
      window.location.href = initPoint;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível iniciar o checkout do Mercado Pago.");
    } finally {
      setCheckoutLoading(null);
      setPlanSheetFor(null);
    }
  }

  if (loading) return <div className="container" style={{ paddingTop: 40 }}>Carregando…</div>;
  if (!user) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <p>Entre na sua conta para cuidar do seu anúncio.</p>
      </div>
    );
  }

  const isPj = form.entity_type === "pj";

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1>Painel do profissional</h1>
      {message && <p className="card">{message}</p>}

      <section style={{ marginTop: 24 }}>
        <h2>Meus anúncios</h2>
        {mine.length === 0 && <p className="muted">Você ainda não tem anúncio. Preencha aí embaixo que em dois minutos você aparece na busca.</p>}
        <div className="grid">
          {mine.map((p) => {
            const verified = isCurrentlyVerified(p);
            const boosted = isCurrentlyBoosted(p);
            const plusActive = isCurrentlyPlusActive(p);
            const credits = leadCreditsByProfessional[p.id];
            const sponsorships = mySponsorships[p.id] ?? [];
            const activeSponsorship = sponsorships.find((s) => s.status === "active" && new Date(s.ends_at) > new Date());
            return (
              <div key={p.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{p.name}</strong>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span className={p.entity_type === "pj" ? "badge badge-entity-pj" : "badge badge-entity-pf"}>
                      {p.entity_type === "pj" ? "Empresa" : "Autônomo"}
                    </span>
                    {verified && <span className="badge badge-verified">✓ Verificado</span>}
                    {boosted && <span className="badge badge-boosted">Destaque</span>}
                  </div>
                </div>
                <p className="muted">{p.category} · {p.city}</p>
                <p className="views-line">
                  <strong>{views30[p.id] ?? 0}</strong>{" "}
                  {(views30[p.id] ?? 0) === 1 ? "pessoa viu" : "pessoas viram"} seu anúncio nos últimos 30 dias
                </p>
                {p.entity_type === "pj" && p.responsible_name && (
                  <p className="muted" style={{ margin: "4px 0" }}>Responsável: {p.responsible_name}</p>
                )}
                {(() => {
                  const lista = pedidos[p.id] ?? [];
                  const novos = lista.filter((r) => r.status === "new").length;
                  return (
                    <div className="requests">
                      <div className="requests-head">
                        <strong>
                          Pedidos de contato{novos > 0 && <span className="requests-badge">{novos} novo{novos > 1 ? "s" : ""}</span>}
                        </strong>
                        <button type="button" className="requests-toggle" onClick={() => setMostrarArquivados((v) => !v)}>
                          {mostrarArquivados ? "Esconder arquivados" : "Ver arquivados"}
                        </button>
                      </div>

                      {lista.length === 0 ? (
                        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                          Ninguém pediu retorno ainda. Quando alguém deixar o número, ele aparece aqui.
                        </p>
                      ) : (
                        <ul className="requests-list">
                          {lista.map((r) => (
                            <li key={r.id} className={r.status === "new" ? "request request-new" : "request"}>
                              <div>
                                <strong>{r.name}</strong>{" "}
                                <a href={`tel:${r.phone.replace(/\D/g, "")}`}>{r.phone}</a>
                                {r.status === "contacted" && <span className="request-tag">já retornado</span>}
                                {r.status === "archived" && <span className="request-tag">arquivado</span>}
                              </div>
                              {r.message && <p className="muted request-msg">{r.message}</p>}
                              <div className="request-actions">
                                {r.status !== "contacted" && (
                                  <button type="button" className="btn btn-outline" onClick={() => marcarPedido(r.id, "contacted")}>
                                    Já falei com essa pessoa
                                  </button>
                                )}
                                {r.status !== "archived" && (
                                  <button type="button" className="btn btn-outline" onClick={() => marcarPedido(r.id, "archived")}>
                                    Arquivar
                                  </button>
                                )}
                                {r.status === "archived" && (
                                  <button type="button" className="btn btn-outline" onClick={() => marcarPedido(r.id, "new")}>
                                    Desarquivar
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}

                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button className="btn btn-outline" onClick={() => startEdit(p)}>
                    Editar
                  </button>
                  <button
                    className="btn btn-teal"
                    disabled={verified}
                    onClick={() => setPlanSheetFor({ professional: p, type: "verification" })}
                  >
                    {verified
                      ? "Selo ativo"
                      : `Assinar selo de verificação — a partir de R$ ${PRICES.verification.amount.toFixed(2).replace(".", ",")}/mês`}
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={boosted}
                    onClick={() => setPlanSheetFor({ professional: p, type: "boost" })}
                  >
                    {boosted
                      ? "Anúncio turbinado"
                      : `Turbinar anúncio — a partir de R$ ${PRICES.boost.amount.toFixed(2).replace(".", ",")}/mês`}
                  </button>
                  {p.entity_type === "pj" && (
                    <button
                      className="btn btn-outline"
                      disabled={plusActive}
                      onClick={() => setPlanSheetFor({ professional: p, type: "plus" })}
                    >
                      {plusActive
                        ? "Empresa Plus ativo"
                        : `Assinar Empresa Plus — a partir de R$ ${PRICES.plus.amount.toFixed(2).replace(".", ",")}/mês`}
                    </button>
                  )}
                  {plusActive && (
                    <Link className="btn btn-outline" to={`/analytics/${p.id}`}>
                      Ver estatísticas
                    </Link>
                  )}
                </div>

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: "0.85rem" }}>Modo de contato</p>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
                      <input
                        type="radio"
                        name={`contact-mode-${p.id}`}
                        checked={p.contact_mode === "whatsapp_livre"}
                        onChange={() => handleContactModeChange(p.id, "whatsapp_livre")}
                        style={{ width: "auto" }}
                      />
                      WhatsApp livre (grátis, ilimitado)
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
                      <input
                        type="radio"
                        name={`contact-mode-${p.id}`}
                        checked={p.contact_mode === "pay_per_lead"}
                        onChange={() => handleContactModeChange(p.id, "pay_per_lead")}
                        style={{ width: "auto" }}
                      />
                      Pagar por contato (R$ {(PRICES.leadCreditCents / 100).toFixed(2).replace(".", ",")}/lead)
                    </label>
                  </div>
                  {p.contact_mode === "pay_per_lead" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span className="muted" style={{ fontSize: "0.85rem" }}>
                        Saldo atual: <strong>{credits?.balance ?? 0}</strong> crédito(s)
                      </span>
                      {CREDIT_PACKS.map((qty) => (
                        <button
                          key={qty}
                          className="btn btn-outline"
                          style={{ fontSize: "0.78rem", padding: "4px 8px" }}
                          disabled={checkoutLoading === `${p.id}:credits`}
                          onClick={() => handleBuyCredits(p.id, qty)}
                        >
                          Comprar {qty} créditos — R$ {((PRICES.leadCreditCents / 100) * qty).toFixed(2).replace(".", ",")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: "0.85rem" }}>Categoria patrocinada</p>
                  {activeSponsorship ? (
                    <p className="muted" style={{ fontSize: "0.85rem" }}>
                      Patrocínio ativo em "{activeSponsorship.category}" até{" "}
                      {new Date(activeSponsorship.ends_at).toLocaleDateString("pt-BR")}.
                    </p>
                  ) : (
                    <button className="btn btn-outline" style={{ fontSize: "0.85rem" }} onClick={() => setSponsorSheetFor(p)}>
                      Patrocinar categoria "{p.category}"
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>{isEditing ? "Editar anúncio" : "Cadastrar anúncio"}</h2>
        <form className="card" onSubmit={handleSave} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name="entity_type"
                checked={form.entity_type === "pf"}
                onChange={() => setForm({ ...form, entity_type: "pf", document: "" })}
                style={{ width: "auto" }}
              />
              Pessoa física
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name="entity_type"
                checked={form.entity_type === "pj"}
                onChange={() => setForm({ ...form, entity_type: "pj", document: "" })}
                style={{ width: "auto" }}
              />
              Pessoa jurídica (empresa)
            </label>
          </div>

          <input
            placeholder={isPj ? "Nome exibido (ex: Escolinha Golfinho Azul)" : "Nome"}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            maxLength={NAME_MAX_LENGTH}
          />

          {isPj && (
            <>
              <input
                placeholder="Nome da empresa (razão social/nome fantasia)"
                value={form.company_name ?? ""}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              />
              <input
                placeholder="Responsável pela empresa (ex: Maria Silva)"
                value={form.responsible_name ?? ""}
                onChange={(e) => setForm({ ...form, responsible_name: e.target.value })}
                required
              />
            </>
          )}

          <input
            placeholder={isPj ? "CNPJ" : "CPF"}
            value={form.document ?? ""}
            onChange={(e) => setForm({ ...form, document: formatDocument(e.target.value, form.entity_type) })}
            inputMode="numeric"
            maxLength={isPj ? 18 : 14}
          />

          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted">{isPj ? "Logo da empresa" : "Foto de rosto"} {!isPj && "(obrigatória)"}</span>
            <input type="file" accept="image/*" onChange={handlePhotoChange} />
            {(photoPreview || form.photo_url) && (
              <img
                src={photoPreview || form.photo_url || undefined}
                alt={form.name ? `Pré-visualização de ${form.name}` : "Pré-visualização"}
                style={{ width: 96, height: 96, objectFit: "cover", borderRadius: isPj ? 10 : "50%", border: "1px solid var(--color-border)" }}
              />
            )}
          </label>

          <fieldset className="contact-fields">
            <legend>O que você faz</legend>
            <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.85rem" }}>
              Marque tudo o que você atende — até {MAX_CATEGORIES}. Quem faz encanamento e elétrica aparece nas
              duas buscas, sem precisar de dois anúncios. A primeira marcada é a que aparece em destaque.
            </p>
            <div className="chip-list">
              {CATEGORIES.map((c) => {
                const marcada = form.categories.includes(c);
                const cheio = form.categories.length >= MAX_CATEGORIES;
                return (
                  <button
                    key={c}
                    type="button"
                    className={marcada ? "chip chip-selected" : "chip"}
                    aria-pressed={marcada}
                    disabled={!marcada && cheio}
                    onClick={() => {
                      const lista = marcada
                        ? form.categories.filter((x) => x !== c)
                        : [...form.categories, c];
                      // A principal é sempre a primeira da lista; se ela sair,
                      // a seguinte assume — o anúncio nunca fica sem destaque.
                      setForm({ ...form, categories: lista, category: lista[0] ?? "" });
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <textarea placeholder="Conte o que você faz, com suas palavras" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
          <fieldset className="contact-fields">
            <legend>Como querem falar com você</legend>
            <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.85rem" }}>
              Preencha o que fizer sentido. Só aparece no seu anúncio o que você escrever aqui.
            </p>
            <input
              placeholder="Telefone com DDD"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              placeholder="WhatsApp com DDD"
              value={form.whatsapp ?? ""}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
            <input
              type="email"
              placeholder="E-mail"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              placeholder="Instagram (@seuperfil)"
              value={form.instagram ?? ""}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
            />
            <input
              placeholder="LinkedIn (link do perfil)"
              value={form.linkedin ?? ""}
              onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
            />
          </fieldset>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem" }}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              style={{ width: "auto" }}
            />
            Li e concordo com os <Link to="/termos" target="_blank" rel="noreferrer">Termos de Uso</Link>
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Salvando…" : isEditing ? "Salvar alterações" : "Salvar anúncio"}
            </button>
            {isEditing && (
              <button type="button" className="btn btn-outline" onClick={resetForm} disabled={saving}>
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </section>

      {planSheetFor && (
        <BottomSheet
          title={`Assinar ${PRICES[planSheetFor.type].label.toLowerCase()}`}
          subtitle="Três formas de pagar. As duas do cartão renovam sozinhas; no Pix/boleto a gente avisa por e-mail quando estiver perto de vencer."
          onClose={() => setPlanSheetFor(null)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div className="card" style={{ display: "grid", gap: 8 }}>
              <strong>Mensal no cartão — R$ {PRICES[planSheetFor.type].amount.toFixed(2).replace(".", ",")}/mês</strong>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                Renova automaticamente: o Mercado Pago cobra o cartão todo mês, até você cancelar.
              </span>
              <button
                className="btn btn-teal btn-block"
                disabled={checkoutLoading === `${planSheetFor.professional.id}:${planSheetFor.type}:monthly`}
                onClick={() => handleSubscribeMonthly(planSheetFor.professional.id, planSheetFor.type)}
              >
                {checkoutLoading === `${planSheetFor.professional.id}:${planSheetFor.type}:monthly`
                  ? "Abrindo checkout…"
                  : "Assinar mensal no cartão"}
              </button>
            </div>
            <div className="card" style={{ display: "grid", gap: 8 }}>
              <strong>
                Anual no cartão — R$ {annualPrice(planSheetFor.type).toFixed(2).replace(".", ",")}/ano, 20% off
              </strong>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                Renova automaticamente todo ano — equivalente a R${" "}
                {(annualPrice(planSheetFor.type) / 12).toFixed(2).replace(".", ",")}/mês. Só cartão de crédito.
              </span>
              <button
                className="btn btn-primary btn-block"
                disabled={checkoutLoading === `${planSheetFor.professional.id}:${planSheetFor.type}:annual-card`}
                onClick={() => handleSubscribeAnnualCard(planSheetFor.professional.id, planSheetFor.type)}
              >
                {checkoutLoading === `${planSheetFor.professional.id}:${planSheetFor.type}:annual-card`
                  ? "Abrindo checkout…"
                  : "Assinar anual no cartão"}
              </button>
            </div>
            <div className="card" style={{ display: "grid", gap: 8 }}>
              <strong>
                Anual no Pix/boleto — R$ {annualPrice(planSheetFor.type).toFixed(2).replace(".", ",")}/ano, 20% off
              </strong>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                Pagamento único: Pix e boleto não permitem cobrança automática. Quando estiver perto de vencer,
                mandamos um e-mail com o link já pronto para você renovar.
              </span>
              <button
                className="btn btn-outline btn-block"
                disabled={checkoutLoading === `${planSheetFor.professional.id}:${planSheetFor.type}:annual-pix`}
                onClick={() => handleSubscribeAnnualOneTime(planSheetFor.professional.id, planSheetFor.type)}
              >
                {checkoutLoading === `${planSheetFor.professional.id}:${planSheetFor.type}:annual-pix`
                  ? "Abrindo checkout…"
                  : "Pagar anual no Pix/boleto"}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {sponsorSheetFor && (
        <BottomSheet
          title={`Patrocinar categoria "${sponsorSheetFor.category}"`}
          subtitle="Seu anúncio aparece em destaque no topo da busca quando alguém filtrar por essa categoria em sua cidade, pelo período escolhido."
          onClose={() => setSponsorSheetFor(null)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <select value={sponsorDays} onChange={(e) => setSponsorDays(Number(e.target.value))}>
              {SPONSORSHIP_PLANS.map((plan) => (
                <option key={plan.days} value={plan.days}>
                  {plan.days} dias — R$ {plan.amount.toFixed(2).replace(".", ",")}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary btn-block"
              disabled={checkoutLoading === `${sponsorSheetFor.id}:sponsor`}
              onClick={() => handleSponsor(sponsorSheetFor)}
            >
              {checkoutLoading === `${sponsorSheetFor.id}:sponsor` ? "Abrindo checkout…" : "Ir para pagamento"}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
