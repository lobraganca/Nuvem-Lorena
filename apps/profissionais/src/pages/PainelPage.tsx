import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { signInWithGoogle } from "../lib/auth";
import { hasDatabase } from "../lib/supabase";
import {
  getMyProfessionals,
  countRecentProfileViews,
  getContactRequests,
  updateContactRequestStatus,
  isCurrentlyBoosted,
  isCurrentlyVerified,
  isCurrentlyPlusActive,
  upsertProfessional,
  deleteProfessional,
  setProfessionalPaused,
  getMySponsorships,
} from "../lib/professionals";
import {
  startSubscriptionCheckout,
  startAnnualSubscriptionCheckout,
  startAnnualCheckout,
  startCreditsCheckout,
  startSponsorshipCheckout,
  annualPrice,
  cancelarAssinatura,
  entrarNaFilaDeDestaque,
  getAssinaturasAtivas,
  vagasDeDestaque,
  PRICES,
  type AssinaturaAtiva,
} from "../lib/payments";
import { CATEGORIES, CITIES, DEFAULT_CITY, MAX_CATEGORIES, MAX_CATEGORIA_LEN, normalizarCategoria, SPONSORSHIP_PLANS, type CategorySponsorship, type ContactRequest, type ContactRequestStatus, type Professional, type SubscriptionType } from "../types/domain";
import { formatDocument, isValidDocument } from "../lib/documents";
import { uploadProfessionalPhoto } from "../lib/storage";
import { formatPhone, isValidPhone } from "../lib/phone";
import { buscarCep, formatCep } from "../lib/cep";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmarWhatsApp } from "../components/ConfirmarWhatsApp";
import { BotaoApple } from "../components/BotaoApple";
import { SeletorDeServicos } from "../components/SeletorDeServicos";
import { CatalogoDeServicos } from "../components/CatalogoDeServicos";
import { mensagemDeErro } from "../lib/erros";
import { SeletorDeAtributos } from "../components/SeletorDeAtributos";

type FormState = Omit<
  Professional,
  | "id"
  | "created_at"
  | "verified"
  | "verified_until"
  | "verified_since"
  | "whatsapp_verified"
  | "whatsapp_verified_at"
  | "boosted"
  | "boosted_until"
  | "paused"
  | "suspended"
  | "suspended_reason"
  | "contact_mode"
  | "plus_active"
  | "plus_until"
> & { id?: string };

const EMPTY: FormState = {
  owner_id: "",
  name: "",
  // Nada vem marcado. Antes o primeiro serviço da lista já vinha escolhido,
  // e quem não reparasse publicava um anúncio de encanador sem nunca ter
  // dito que é encanador — um valor padrão aqui não é conveniência, é uma
  // resposta colocada na boca da pessoa.
  category: "",
  categories: [],
  atributos: [],
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
  cep: "",
  street: "",
  street_number: "",
  neighborhood: "",
  mostrar_endereco: false,
};

const NAME_MAX_LENGTH = 80;


export function PainelPage() {
  const { user, loading } = useAuth();
  const [mine, setMine] = useState<Professional[]>([]);
  /** Visualizações dos últimos 30 dias por anúncio — grátis para todo anunciante. */
  const [views30, setViews30] = useState<Record<string, number>>({});
  /**
   * Visualizações da última semana. Usadas só no anúncio sem assinatura, para
   * dizer quantas pessoas chegaram nele sem ter como chamar — é o argumento
   * mais forte que existe para assinar, porque é o número real da pessoa e
   * não uma promessa nossa.
   */
  const [views7, setViews7] = useState<Record<string, number>>({});
  /** Pedidos de contato por anúncio (quem deixou o número pedindo retorno). */
  const [pedidos, setPedidos] = useState<Record<string, ContactRequest[]>>({});
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [loginError, setLoginError] = useState("");

  async function handleGoogleLogin() {
    setLoginError("");
    try {
      await signInWithGoogle("/painel");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Não foi possível abrir o login do Google.");
    }
  }
  const [form, setForm] = useState<FormState>(EMPTY);
  /** Texto do campo "Outro": filtra os serviços sugeridos e cadastra o que não existe. */
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  /** Distingue "deu errado" de "deu certo" — os dois usam a mesma linha de texto. */
  const [erroAoSalvar, setErroAoSalvar] = useState(false);
  /** Mensagem do formulário do anúncio — separada da do topo, que é dos pagamentos. */
  const [formMessage, setFormMessage] = useState("");
  const [sponsorSheetFor, setSponsorSheetFor] = useState<Professional | null>(null);
  const [sponsorDays, setSponsorDays] = useState<number>(SPONSORSHIP_PLANS[0].days);
  const [mySponsorships, setMySponsorships] = useState<Record<string, CategorySponsorship[]>>({});
  const [planSheetFor, setPlanSheetFor] = useState<{ professional: Professional; type: SubscriptionType } | null>(null);
  /** Anúncio cujo WhatsApp está sendo confirmado por código. */
  const [confirmandoWhats, setConfirmandoWhats] = useState<Professional | null>(null);
  /**
   * O formulário fica fechado quando já existe anúncio.
   *
   * Antes ele vivia aberto no fim da página, o que confundia: quem tinha um
   * anúncio via um formulário vazio embaixo dele e não sabia se aquilo era
   * "editar o meu" ou "criar outro". Agora criar é um gesto explícito, pelo
   * botão de mais.
   */
  const [formAberto, setFormAberto] = useState(false);
  /** Assinaturas ativas por anúncio, para oferecer o cancelamento. */
  const [assinaturas, setAssinaturas] = useState<Record<string, AssinaturaAtiva[]>>({});
  /** Vagas de destaque restantes na categoria principal de cada anúncio. */
  const [vagas, setVagas] = useState<Record<string, number>>({});
  const [naFila, setNaFila] = useState<Record<string, boolean>>({});
  const [cancelando, setCancelando] = useState<AssinaturaAtiva | null>(null);
  const [cancelandoAgora, setCancelandoAgora] = useState(false);
  const [resultadoCancelamento, setResultadoCancelamento] = useState("");
  /** Anúncio que a pessoa pediu para excluir — a confirmação abre em folha. */
  const [excluindoAnuncio, setExcluindoAnuncio] = useState<Professional | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const isEditing = !!form.id;

  useEffect(() => {
    if (user) getMyProfessionals(user.id).then(setMine);
  }, [user]);

  useEffect(() => {
    mine.forEach((p) => {
      getMySponsorships(p.id).then((list) => setMySponsorships((prev) => ({ ...prev, [p.id]: list })));
      getAssinaturasAtivas(p.id).then((list) => setAssinaturas((prev) => ({ ...prev, [p.id]: list })));
      if (p.category) {
        vagasDeDestaque(p.category, p.city).then((n) => setVagas((prev) => ({ ...prev, [p.id]: n })));
      }
    });
  }, [mine]);



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
    setFormMessage("");
    setErroAoSalvar(false);
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
      atributos: p.atributos ?? [],
      city: p.city,
      bio: p.bio,
      // Anúncios salvos antes da máscara existir têm o telefone em qualquer
      // formato; ao abrir para editar, já aparecem no formato novo.
      phone: formatPhone(p.phone),
      whatsapp: p.whatsapp ? formatPhone(p.whatsapp) : "",
      email: p.email ?? "",
      instagram: p.instagram ?? "",
      linkedin: p.linkedin ?? "",
      entity_type: p.entity_type,
      document: p.document ? formatDocument(p.document, p.entity_type) : "",
      company_name: p.company_name ?? "",
      photo_url: p.photo_url,
      responsible_name: p.responsible_name ?? "",
      cep: p.cep ?? "",
      street: p.street ?? "",
      street_number: p.street_number ?? "",
      neighborhood: p.neighborhood ?? "",
      mostrar_endereco: p.mostrar_endereco ?? false,
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setAcceptedTerms(true);
    setMessage("");
    setFormAberto(true);
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
    Promise.all(mine.map((p) => countRecentProfileViews(p.id, 7).then((n) => [p.id, n] as const))).then((pares) => {
      if (active) setViews7(Object.fromEntries(pares));
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
    setFormMessage("");
    setErroAoSalvar(false);

    /** Interrompe o salvamento com um motivo escrito ao lado do botão. */
    function falha(texto: string) {
      setErroAoSalvar(true);
      setFormMessage(texto);
    }

    if (!form.name.trim()) {
      falha("Escreva o nome que vai aparecer no anúncio.");
      return;
    }
    if (form.categories.length === 0) {
      falha("Marque pelo menos um serviço que você faz.");
      return;
    }
    if (!isValidPhone(form.phone)) {
      falha("Informe um telefone com DDD, no formato (31) 99999-9999.");
      return;
    }
    if (form.whatsapp && !isValidPhone(form.whatsapp)) {
      falha("O WhatsApp está incompleto. Use o formato (31) 99999-9999.");
      return;
    }
    if (form.document && !isValidDocument(form.document, form.entity_type)) {
      falha(form.entity_type === "pj" ? "CNPJ inválido. Confira os números digitados." : "CPF inválido. Confira os números digitados.");
      return;
    }
    if (form.entity_type === "pf" && !photoFile && !form.photo_url) {
      falha("Envie uma foto de rosto para publicar o anúncio de pessoa física.");
      return;
    }
    if (form.entity_type === "pj" && !form.responsible_name?.trim()) {
      falha("Informe o nome do responsável pela empresa.");
      return;
    }
    if (!acceptedTerms) {
      falha("Para publicar, é preciso concordar com os Termos de Uso.");
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
      setFormAberto(false);
      setMine(await getMyProfessionals(user.id));
      setFormMessage(wasEditing ? "Anúncio atualizado." : "Anúncio salvo.");
    } catch (err) {
      setErroAoSalvar(true);
      setFormMessage(mensagemDeErro(err, "Não foi possível salvar o anúncio."));
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
  // Sem conta, esta tela era um beco sem saída: avisava que precisava
  // entrar e não oferecia como. Quem chega aqui veio de "Quero ser
  // encontrado" — está a um toque de anunciar, e é isso que a tela tem que
  // entregar.
  if (!user) {
    return (
      <div className="container" style={{ maxWidth: 460, paddingTop: 48, textAlign: "center" }}>
        <div className="card">
          <h1 style={{ marginTop: 0, fontSize: "1.5rem" }}>Vamos criar seu anúncio</h1>
          <p className="muted">
            Entre com sua conta Google — é a mesma que você já usa no celular. Não precisa criar senha nova nem
            preencher cadastro agora.
          </p>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 20 }}
            onClick={handleGoogleLogin}
            disabled={!hasDatabase()}
          >
            Entrar com Google
          </button>
          <BotaoApple voltarPara="/painel" onErro={setLoginError} />
          {loginError && <p style={{ color: "var(--color-danger)", marginTop: 12 }}>{loginError}</p>}
          <p className="muted" style={{ marginTop: 18, fontSize: "0.85rem" }}>
            Anunciar é grátis. O selo de verificação e o destaque na busca são opcionais, e você decide depois.
          </p>
        </div>
      </div>
    );
  }

  const isPj = form.entity_type === "pj";

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1>Painel do profissional</h1>
      {message && <p className="card">{message}</p>}

      <section style={{ marginTop: 24 }}>
        <div className="secao-topo">
          <h2 style={{ margin: 0 }}>Meus anúncios</h2>
          {mine.length > 0 && mine.length < 5 && !formAberto && (
            /* Um anúncio por ofício, e não tudo amontoado num só: quem é
               fotógrafo e dá aula de violão tem duas vitrines diferentes,
               com fotos, textos e reputações separadas. */
            <button
              type="button"
              className="btn btn-primary btn-novo"
              onClick={() => {
                resetForm();
                setFormAberto(true);
                setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 50);
              }}
            >
              <span aria-hidden="true">+</span> Novo anúncio
            </button>
          )}
        </div>
        {mine.length === 0 && <p className="muted">Você ainda não tem anúncio. Preencha aí embaixo que em dois minutos você aparece na busca.</p>}
        <div className="grid">
          {mine.map((p) => {
            const verified = isCurrentlyVerified(p);
            const boosted = isCurrentlyBoosted(p);
            const plusActive = isCurrentlyPlusActive(p);
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
                    {p.paused && <span className="badge badge-pausado">Pausado</span>}
                    {verified && <span className="badge badge-verified">Selo ativo</span>}
                    {boosted && <span className="badge badge-boosted">Destaque</span>}
                  </div>
                </div>
                <p className="muted">{p.category} · {p.city}</p>
                <p className="views-line">
                  <strong>{views30[p.id] ?? 0}</strong>{" "}
                  {(views30[p.id] ?? 0) === 1 ? "pessoa viu" : "pessoas viram"} seu anúncio nos últimos 30 dias
                </p>
                {/* A confirmação do número fica no card, e não escondida nas
                    configurações: é o que separa um anúncio de um número
                    qualquer digitado, e quem anuncia precisa ver que falta. */}
                {p.whatsapp_verified ? (
                  <p className="whats-ok">✓ {formatPhone(p.whatsapp || p.phone)} confirmado</p>
                ) : (
                  <div className="whats-pendente">
                    <p>
                      <strong>Confirme o {formatPhone(p.whatsapp || p.phone)}.</strong> É este número que vai
                      receber o código e é ele que aparece para quem procura. Número confirmado passa mais
                      confiança — e impede que outra pessoa anuncie usando o seu.
                    </p>
                    <button type="button" className="btn btn-outline" onClick={() => setConfirmandoWhats(p)}>
                      Confirmar agora
                    </button>
                  </div>
                )}
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

                {/* Ações do anúncio: tudo grátis, tudo reversível. Ficam
                    juntas e em primeiro lugar porque são o que a pessoa vem
                    fazer aqui — o que é pago não pode disputar espaço com o
                    que ela já pagou (o tempo de cadastrar). */}
                <div className="acoes-anuncio">
                  <button className="btn btn-outline" onClick={() => startEdit(p)}>
                    Editar
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={async () => {
                      setErroAoSalvar(false);
                      setFormMessage("");
                      try {
                        await setProfessionalPaused(p.id, !p.paused);
                        setMine((prev) => prev.map((x) => (x.id === p.id ? { ...x, paused: !p.paused } : x)));
                      } catch (err) {
                        setErroAoSalvar(true);
                        setFormMessage(mensagemDeErro(err, "Não foi possível pausar o anúncio."));
                      }
                    }}
                  >
                    {p.paused ? "Voltar para a busca" : "Pausar anúncio"}
                  </button>
                  <button className="btn btn-outline btn-perigo" onClick={() => setExcluindoAnuncio(p)}>
                    Excluir anúncio
                  </button>
                  {plusActive && (
                    <Link className="btn btn-outline" to={`/analytics/${p.id}`}>
                      Ver estatísticas
                    </Link>
                  )}
                </div>

                {/* Catálogo fechado por padrão: quem faz um serviço só não
                    precisa nem saber que ele existe, e aberto ele empurraria
                    para baixo tudo o mais do painel. */}
                <details className="bloco-recolhivel">
                  <summary>
                    <strong>Meus serviços e preços</strong>
                    <span className="muted"> — diárias, exames, pacotes, ajustes</span>
                  </summary>
                  <CatalogoDeServicos professionalId={p.id} />
                </details>

                {/* O que é pago fica reunido, fechado por padrão e com o nome
                    dito em português: antes eram cinco botões soltos no meio
                    do anúncio, com preço e sem explicação, e quem lia "Empresa
                    Plus" ou "patrocinar categoria" não tinha como saber o que
                    ia levar. Fechado, some do caminho de quem só quer editar. */}
                {/* Aberto por padrão enquanto não há nada assinado, e
                    recolhido depois: para quem já paga, isso é histórico; para
                    quem ainda não, é a única chance de descobrir que existe.
                    Recolher para todo mundo escondia a receita do app. */}
                <details className="produtos produtos-oferta" open={!verified && !boosted && !plusActive && !activeSponsorship}>
                  <summary>
                    Aparecer mais{" "}
                    <span className="muted">
                      — a partir de R$ {PRICES.verification.amount.toFixed(2).replace(".", ",")}/mês
                    </span>
                  </summary>

                  {!verified && (
                    /* A chamada principal vai para o selo: é a assinatura que
                       libera o contato, e sem contato o resto rende pouco. */
                    <div className="oferta-destaque">
                      <p>
                        {(views7[p.id] ?? 0) > 0 ? (
                          <>
                            <strong>
                              {views7[p.id] === 1
                                ? "1 pessoa abriu seu anúncio nos últimos 7 dias"
                                : `${views7[p.id]} pessoas abriram seu anúncio nos últimos 7 dias`}{" "}
                              e não tinham como te chamar com um toque.
                            </strong>{" "}
                            Elas viram seu telefone escrito, mas sem o botão de WhatsApp e sem o "peça para te
                            chamar" — que é por onde chega a maior parte dos contatos.
                          </>
                        ) : (
                          <>
                            <strong>Seu anúncio está no plano grátis.</strong> Quem procura consegue ver seu
                            telefone, mas não tem o botão de WhatsApp nem o "peça para te chamar" — e é por ali
                            que chega a maior parte dos contatos.
                          </>
                        )}
                      </p>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          if (!p.whatsapp_verified) {
                            setConfirmandoWhats(p);
                            return;
                          }
                          setPlanSheetFor({ professional: p, type: "verification" });
                        }}
                      >
                        Assinar por R$ {PRICES.verification.amount.toFixed(2).replace(".", ",")}/mês
                      </button>
                    </div>
                  )}

                  <p className="muted produtos-intro">
                    Seu anúncio funciona de graça, para sempre. O que está aqui embaixo serve para você
                    aparecer antes dos outros ou passar mais confiança — nada disso muda o seu trabalho, só a
                    sua vitrine.
                  </p>

                  <div className="produto">
                    <div className="produto-texto">
                      <strong>Selo e contato direto</strong>
                      <p>
                        Três coisas: o ✓ azul ao lado do seu nome, o <strong>botão de WhatsApp</strong> no seu
                        anúncio e o <strong>"peça para te chamar"</strong>, onde o cliente deixa o número e você
                        retorna. Sem a assinatura, seu telefone continua aparecendo — só que escrito, para a
                        pessoa anotar ou ligar.
                      </p>
                    </div>
                    <div className="produto-acao">
                      {verified ? (
                        <span className="produto-ativo">✓ Ativo</span>
                      ) : (
                        <>
                          <span className="produto-preco">
                            R$ {PRICES.verification.amount.toFixed(2).replace(".", ",")}
                            <small>/mês</small>
                          </span>
                          <button
                            className="btn btn-teal"
                            onClick={() => {
                              // Vender o selo a um número que ninguém confirmou
                              // esvaziaria justamente o que ele promete.
                              if (!p.whatsapp_verified) {
                                setConfirmandoWhats(p);
                                return;
                              }
                              setPlanSheetFor({ professional: p, type: "verification" });
                            }}
                          >
                            Assinar
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="produto">
                    <div className="produto-texto">
                      <strong>Destaque na busca</strong>
                      <p>
                        Seu anúncio sobe para o topo da lista de quem procura o seu serviço em {p.city}. Quem
                        está com pressa raramente rola até o fim — quase todo mundo chama alguém dos primeiros.
                      </p>
                      {!boosted && (
                        <p style={{ marginTop: 6, fontSize: "0.8rem" }}>
                          {(vagas[p.id] ?? 5) <= 0
                            ? `Sem vagas em "${p.category}" agora — são 5 por categoria, para o destaque continuar destacando.`
                            : `${vagas[p.id] ?? 5} de 5 vagas livres em "${p.category}". O limite existe para o topo não virar uma multidão.`}
                        </p>
                      )}
                    </div>
                    <div className="produto-acao">
                      {boosted ? (
                        <span className="produto-ativo">✓ Ativo</span>
                      ) : (vagas[p.id] ?? 5) <= 0 ? (
                        /* Esgotado vira fila, não venda perdida: a fila é o
                           melhor termômetro de preço que existe — categoria
                           com espera é categoria onde o destaque está
                           barato. */
                        naFila[p.id] ? (
                          <span className="produto-ativo">Na fila ✓</span>
                        ) : (
                          <button
                            className="btn btn-outline"
                            onClick={async () => {
                              try {
                                await entrarNaFilaDeDestaque(p.id, p.category, p.city);
                                setNaFila((prev) => ({ ...prev, [p.id]: true }));
                              } catch {
                                setErroAoSalvar(true);
                                setFormMessage("Não foi possível entrar na fila agora.");
                              }
                            }}
                          >
                            Avise quando vagar
                          </button>
                        )
                      ) : (
                        <>
                          <span className="produto-preco">
                            R$ {PRICES.boost.amount.toFixed(2).replace(".", ",")}
                            <small>/mês</small>
                          </span>
                          <button className="btn btn-primary" onClick={() => setPlanSheetFor({ professional: p, type: "boost" })}>
                            Assinar
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="produto">
                    <div className="produto-texto">
                      <strong>Banner da categoria</strong>
                      <p>
                        Um espaço grande, com foto, no alto de quem busca por "{p.category}" — acima de todos os
                        anúncios, inclusive dos destacados. É por período, não por assinatura.
                      </p>
                    </div>
                    <div className="produto-acao">
                      {activeSponsorship ? (
                        <span className="produto-ativo">
                          ✓ Até {new Date(activeSponsorship.ends_at).toLocaleDateString("pt-BR")}
                        </span>
                      ) : (
                        <>
                          <span className="produto-preco">
                            a partir de R$ {SPONSORSHIP_PLANS[0].amount.toFixed(2).replace(".", ",")}
                          </span>
                          <button className="btn btn-outline" onClick={() => setSponsorSheetFor(p)}>
                            Ver períodos
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {p.entity_type === "pj" && (
                    <div className="produto">
                      <div className="produto-texto">
                        <strong>Empresa Plus</strong>
                        <p>
                          Relatórios do seu anúncio: quantas pessoas viram por dia, de quais serviços vieram e
                          quantas pediram contato. Serve para saber se vale a pena continuar anunciando.
                        </p>
                      </div>
                      <div className="produto-acao">
                        {plusActive ? (
                          <span className="produto-ativo">✓ Ativo</span>
                        ) : (
                          <>
                            <span className="produto-preco">
                              R$ {PRICES.plus.amount.toFixed(2).replace(".", ",")}
                              <small>/mês</small>
                            </span>
                            <button className="btn btn-outline" onClick={() => setPlanSheetFor({ professional: p, type: "plus" })}>
                              Assinar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {(assinaturas[p.id] ?? []).length > 0 && (
                    /* Cancelar precisa estar no mesmo lugar onde se assina, e
                       com o mesmo destaque de qualquer outro botão: esconder
                       o cancelamento é a prática que o Código de Defesa do
                       Consumidor chama de dificultar o exercício do direito. */
                    <div className="assinaturas-ativas">
                      <strong>Suas assinaturas</strong>
                      {(assinaturas[p.id] ?? []).map((a) => (
                        <div key={a.id} className="assinatura-linha">
                          <span>
                            {PRICES[a.type].label}
                            <em>
                              {a.billing_cycle === "annual" ? "anual" : "mensal"}
                              {a.current_period_end
                                ? ` · paga até ${new Date(a.current_period_end).toLocaleDateString("pt-BR")}`
                                : ""}
                            </em>
                          </span>
                          <button type="button" className="btn btn-outline" onClick={() => setCancelando(a)}>
                            Cancelar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              </div>
            );
          })}
        </div>
      </section>

      {(mine.length === 0 || formAberto) && (
      <section style={{ marginTop: 32 }}>
        <div className="secao-topo">
          <h2 style={{ margin: 0 }}>{isEditing ? "Editar anúncio" : "Cadastrar anúncio"}</h2>
          {mine.length > 0 && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                resetForm();
                setFormAberto(false);
              }}
            >
              Fechar
            </button>
          )}
        </div>
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
              Até {MAX_CATEGORIES} serviços. Quem faz encanamento e elétrica aparece nas duas buscas, sem
              precisar de dois anúncios — o primeiro da lista é o que aparece em destaque.
            </p>
            <SeletorDeServicos
              escolhidos={form.categories}
              onChange={(lista) =>
                // A principal é sempre a primeira da lista; se ela sair, a
                // seguinte assume — o anúncio nunca fica sem destaque.
                setForm({ ...form, categories: lista, category: lista[0] ?? "" })
              }
            />
          </fieldset>

          <fieldset className="contact-fields">
            <legend>Mais informações</legend>
            <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.85rem" }}>
              Opcional. Diz <strong>quando</strong> e <strong>como</strong> você atende — fim de semana,
              emergência, cartão, se vai até o cliente.
            </p>
            <SeletorDeAtributos
              escolhidos={form.atributos}
              onChange={(atributos) => setForm({ ...form, atributos })}
            />
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
            <legend>Onde você atende</legend>
            <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.85rem" }}>
              Nada aqui é obrigatório. O <strong>CEP</strong> serve para preencher sozinho a cidade e o
              bairro do seu anúncio — e o bairro é o que ajuda quem procura alguém perto. A{" "}
              <strong>rua e o número só aparecem no anúncio se você marcar a opção no fim deste bloco</strong>:
              quem atende na casa do cliente, ou trabalha na própria casa, deixa desmarcado e ninguém vê onde
              você mora.
            </p>
            <input
              placeholder="CEP"
              value={form.cep ?? ""}
              inputMode="numeric"
              maxLength={9}
              onChange={async (e) => {
                const cep = formatCep(e.target.value);
                setForm((f) => ({ ...f, cep }));
                // Oito dígitos é o sinal de que terminou de digitar — não há
                // botão de buscar, e não deve haver: um passo a mais aqui é
                // um passo que a pessoa esquece.
                if (cep.replace(/\D/g, "").length === 8) {
                  const encontrado = await buscarCep(cep);
                  if (encontrado) {
                    setForm((f) => ({
                      ...f,
                      street: encontrado.street || f.street,
                      neighborhood: encontrado.neighborhood || f.neighborhood,
                      // A cidade do anúncio segue o CEP quando ele responde,
                      // porque é ela que decide em qual busca a pessoa cai.
                      city: encontrado.city || f.city,
                    }));
                  }
                }
              }}
            />
            <input
              placeholder="Rua"
              value={form.street ?? ""}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
            />
            <input
              placeholder="Número"
              value={form.street_number ?? ""}
              onChange={(e) => setForm({ ...form, street_number: e.target.value })}
            />
            <input
              placeholder="Bairro"
              value={form.neighborhood ?? ""}
              onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
            />

            {/* Desligado por padrão, e a chave fica aqui embaixo do endereço
                porque é aqui que a pergunta faz sentido. Boa parte de quem
                anuncia atende em casa — manicure, confeiteira, costureira —
                e o endereço foi digitado para o CEP completar cidade e
                bairro, não para virar "moro na rua tal, número 42" num
                anúncio aberto. O bairro continua aparecendo de qualquer
                jeito: situa a região sem dizer onde é a porta. */}
            <label className="opcao-endereco">
              <input
                type="checkbox"
                checked={form.mostrar_endereco}
                onChange={(e) => setForm({ ...form, mostrar_endereco: e.target.checked })}
              />
              <span>
                <strong>Mostrar rua e número no meu anúncio.</strong>
                <span className="opcao-obs">
                  Marque só se você tem ponto fixo e quer que as pessoas cheguem até lá. Quem atende em casa
                  deve deixar desmarcado — o bairro aparece de todo jeito, e é o que ajuda quem procura perto.
                </span>
              </span>
            </label>
          </fieldset>

          <fieldset className="contact-fields">
            <legend>Como querem falar com você</legend>
            <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.85rem" }}>
              Preencha o que fizer sentido — só aparece no anúncio o que você escrever aqui. O{" "}
              <strong>WhatsApp</strong> (ou o telefone, se você não preencher o WhatsApp) é o número que recebe
              o código de confirmação e o mesmo que as pessoas usam para te chamar. Trocá-lo depois derruba a
              confirmação, e você confirma de novo.
            </p>
            <input
              placeholder="Telefone: (31) 99999-9999"
              value={form.phone}
              inputMode="tel"
              maxLength={15}
              onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
            />
            <input
              placeholder="WhatsApp: (31) 99999-9999"
              value={form.whatsapp ?? ""}
              inputMode="tel"
              maxLength={15}
              onChange={(e) => setForm({ ...form, whatsapp: formatPhone(e.target.value) })}
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

          {/* O aviso de erro só existia no topo da página, a uma tela inteira
              de distância do botão. Quem clicava em Salvar via a tela não
              mudar e concluía que o app não salva — o motivo estava escrito,
              fora do campo de visão. Agora ele aparece aqui, colado no botão
              que a pessoa acabou de apertar. */}
          {formMessage && (
            <p className={erroAoSalvar ? "form-erro" : "form-aviso"} role="status">
              {formMessage}
            </p>
          )}

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
      )}

      {cancelando && (
        <BottomSheet
          title="Cancelar assinatura"
          subtitle={PRICES[cancelando.type].label}
          onClose={() => {
            setCancelando(null);
            setResultadoCancelamento("");
          }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            {resultadoCancelamento ? (
              <>
                <p className="form-aviso" style={{ margin: 0 }}>{resultadoCancelamento}</p>
                <button
                  className="btn btn-primary btn-block"
                  onClick={() => {
                    setCancelando(null);
                    setResultadoCancelamento("");
                  }}
                >
                  Entendi
                </button>
              </>
            ) : (
              <>
                {/* A regra é dita antes de a pessoa decidir, e em dinheiro, não
                    em artigo de lei: o que ela quer saber é se vai receber de
                    volta e até quando o serviço continua. */}
                {(Date.now() - new Date(cancelando.created_at).getTime()) / 86400000 <= 7 ? (
                  <p style={{ margin: 0 }}>
                    Você assinou há menos de 7 dias, então tem direito ao <strong>dinheiro de volta,
                    integral</strong> — é o direito de arrependimento do Código de Defesa do Consumidor. O
                    valor volta pelo mesmo meio de pagamento, e o benefício termina agora.
                  </p>
                ) : (
                  <p style={{ margin: 0 }}>
                    A cobrança seguinte <strong>não acontece</strong>. O que você já pagou continua valendo
                    {cancelando.current_period_end
                      ? ` até ${new Date(cancelando.current_period_end).toLocaleDateString("pt-BR")}`
                      : " até o fim do período"}
                    : você não perde os dias que já comprou.
                  </p>
                )}
                <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
                  Seu anúncio continua no ar de qualquer forma, no plano grátis.
                </p>
                <button
                  className="btn btn-perigo btn-block"
                  disabled={cancelandoAgora}
                  onClick={async () => {
                    setCancelandoAgora(true);
                    try {
                      const r = await cancelarAssinatura(cancelando.id);
                      setResultadoCancelamento(
                        r.reembolsado
                          ? "Assinatura cancelada e reembolso solicitado. O valor volta pelo mesmo meio de pagamento, no prazo do seu banco ou cartão."
                          : "Assinatura cancelada. Não haverá novas cobranças."
                      );
                      if (user) {
                        setMine(await getMyProfessionals(user.id));
                        setAssinaturas((prev) => ({
                          ...prev,
                          [cancelando.id]: [],
                        }));
                      }
                    } catch (err) {
                      setResultadoCancelamento(
                        err instanceof Error ? err.message : "Não foi possível cancelar agora."
                      );
                    } finally {
                      setCancelandoAgora(false);
                    }
                  }}
                >
                  {cancelandoAgora ? "Cancelando…" : "Confirmar cancelamento"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-block"
                  onClick={() => setCancelando(null)}
                >
                  Manter assinatura
                </button>
              </>
            )}
          </div>
        </BottomSheet>
      )}

      {excluindoAnuncio && (
        <BottomSheet
          title="Excluir este anúncio?"
          subtitle="Some da busca na hora, e não dá para desfazer."
          onClose={() => setExcluindoAnuncio(null)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0 }}>
              <strong>{excluindoAnuncio.name}</strong>
            </p>
            {/* Dito antes, não depois: as avaliações são o que a pessoa levou
                meses para juntar, e recriar o anúncio não as traz de volta. */}
            <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
              Junto com o anúncio saem as avaliações que você recebeu, os favoritos de quem te guardou e os
              pedidos de contato. Isso não volta, nem criando o anúncio de novo.
            </p>
            {formMessage && erroAoSalvar && <p className="form-erro">{formMessage}</p>}
            <button
              className="btn btn-perigo btn-block"
              disabled={excluindo}
              onClick={async () => {
                setExcluindo(true);
                setErroAoSalvar(false);
                setFormMessage("");
                try {
                  await deleteProfessional(excluindoAnuncio.id);
                  setExcluindoAnuncio(null);
                  if (user) setMine(await getMyProfessionals(user.id));
                  // Se o anúncio apagado estava aberto para edição, o
                  // formulário ficaria editando algo que não existe mais.
                  if (form.id === excluindoAnuncio.id) resetForm();
                } catch (err) {
                  setErroAoSalvar(true);
                  setFormMessage(mensagemDeErro(err, "Não foi possível excluir o anúncio."));
                } finally {
                  setExcluindo(false);
                }
              }}
            >
              {excluindo ? "Excluindo…" : "Sim, excluir"}
            </button>
            <button type="button" className="btn btn-outline btn-block" onClick={() => setExcluindoAnuncio(null)}>
              Manter anúncio
            </button>
          </div>
        </BottomSheet>
      )}

      {confirmandoWhats && (
        <ConfirmarWhatsApp
          professionalId={confirmandoWhats.id}
          numero={confirmandoWhats.whatsapp || confirmandoWhats.phone}
          onClose={() => setConfirmandoWhats(null)}
          onConfirmado={async () => {
            setConfirmandoWhats(null);
            if (user) setMine(await getMyProfessionals(user.id));
          }}
        />
      )}

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
