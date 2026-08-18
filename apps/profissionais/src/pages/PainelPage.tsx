import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { signInWithGoogle } from "../lib/auth";
import { hasDatabase } from "../lib/supabase";
import {
  getMyProfessionals,
  countRecentProfileViewsDeVarios,
  getContactRequestsDeVarios,
  updateContactRequestStatus,
  isCurrentlyBoosted,
  isCurrentlyVerified,
  isCurrentlyPlusActive,
  deleteProfessional,
  type ProfessionalWithRating,
} from "../lib/professionals";
import {
  startSubscriptionCheckout,
  startAnnualSubscriptionCheckout,
  startAnnualCheckout,
  annualPrice,
  precoMensal,
  cancelarAssinatura,
  entrarNaFilaDeDestaque,
  getAssinaturasAtivasDeVarios,
  assinaturaConfirmada,
  vagasDeDestaque,
  PRICES,
  type AssinaturaAtiva,
} from "../lib/payments";
import { type ContactRequest, type ContactRequestStatus, type Professional, type SubscriptionType } from "../types/domain";
import { ehCelular, formatPhone } from "../lib/phone";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmarWhatsApp } from "../components/ConfirmarWhatsApp";
import { BotaoApple } from "../components/BotaoApple";
import { BotaoGoogle } from "../components/BotaoGoogle";
import { mensagemDeErro } from "../lib/erros";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { MarcaConfirmado } from "../components/MarcaConfirmado";
import { CartaoProfissional } from "../components/CartaoProfissional";


/**
 * Confirmação do número por código de SMS.
 *
 * Ligada e exigida antes de assinar: o Twilio Verify está configurado e o
 * envio foi testado ponta a ponta.
 *
 * Se um dia o envio parar (crédito acabado, conta suspensa, provedor fora
 * do ar), trocar para `false` derruba a exigência e mantém as assinaturas
 * funcionando — os botões consultam esta constante, e o convite some do
 * card. É melhor perder a confirmação por uns dias do que travar toda a
 * receita esperando um código que não chega.
 */
const CONFIRMACAO_POR_SMS = true;

/**
 * Identifica um par categoria+cidade numa chave de mapa.
 *
 * Categoria pode ser texto escrito à mão por quem se cadastrou, então
 * qualquer separador escolhido a dedo ("|", "-", espaço) pode aparecer
 * dentro do próprio nome e juntar dois pares diferentes num só. O JSON
 * escapa o que precisa escapar e não tem esse problema.
 */
function chaveDoPar(category: string, city: string): string {
  return JSON.stringify([category, city]);
}


export function PainelPage() {
  useTituloDaPagina("Painel do profissional");
  const { user, loading } = useAuth();
  const [mine, setMine] = useState<ProfessionalWithRating[]>([]);
  /** Visualizações dos últimos 30 dias por cadastro — grátis para todo profissional cadastrado. */
  const [views30, setViews30] = useState<Record<string, number>>({});
  /**
   * Visualizações da última semana. Usadas só no cadastro sem assinatura, para
   * dizer quantas pessoas chegaram nele sem ter como chamar — é o argumento
   * mais forte que existe para assinar, porque é o número real da pessoa e
   * não uma promessa nossa.
   */
  const [views7, setViews7] = useState<Record<string, number>>({});
  /** Pedidos de contato por cadastro (quem deixou o número pedindo retorno). */
  const [pedidos, setPedidos] = useState<Record<string, ContactRequest[]>>({});
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [loginError, setLoginError] = useState("");

  async function handleGoogleLogin() {
    setLoginError("");
    try {
      await signInWithGoogle("/painel");
    } catch (err) {
      setLoginError(mensagemDeErro(err, "Não foi possível abrir o login do Google."));
    }
  }
  /** Cadastro a que a assinatura se aplica. Vazio = o primeiro da lista. */
  const [assinaturaPara, setAssinaturaPara] = useState<string>("");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  /**
   * Aviso do topo. Recebe tanto os erros de pagamento quanto o recado que a
   * tela de cadastro manda ao voltar ("Cadastro salvo."): quem terminou de
   * preencher precisa ver que deu certo aqui, e não na tela que já fechou.
   */
  const { pathname, state } = useLocation() as { pathname: string; state: { aviso?: string } | null };
  const [message, setMessage] = useState(state?.aviso ?? "");

  /* O recado é de uma vez só. O estado da navegação vive no histórico do
     navegador e sobrevive a um recarregamento — sem apagá-lo, "Cadastro
     salvo." reapareceria toda vez que a pessoa puxasse a tela para
     atualizar, dias depois de ter salvo. */
  useEffect(() => {
    if (state?.aviso) window.history.replaceState(null, "", pathname);
  }, [state, pathname]);
  /** Distingue "deu errado" de "deu certo" — os dois usam a mesma linha de texto. */
  const [erroAoSalvar, setErroAoSalvar] = useState(false);
  /** Mensagem de erro das ações do painel (fila de destaque, exclusão). */
  const [formMessage, setFormMessage] = useState("");
  const [planSheetFor, setPlanSheetFor] = useState<{ professional: Professional; type: SubscriptionType } | null>(null);
  /** Cadastro cujo WhatsApp está sendo confirmado por código. */
  const [confirmandoWhats, setConfirmandoWhats] = useState<Professional | null>(null);
  /** Assinaturas ativas por cadastro, para oferecer o cancelamento. */
  const [assinaturas, setAssinaturas] = useState<Record<string, AssinaturaAtiva[]>>({});
  /** Vagas de destaque restantes na categoria principal de cada cadastro. */
  const [vagas, setVagas] = useState<Record<string, number>>({});
  const [naFila, setNaFila] = useState<Record<string, boolean>>({});
  const [cancelando, setCancelando] = useState<AssinaturaAtiva | null>(null);
  const [cancelandoAgora, setCancelandoAgora] = useState(false);
  const [resultadoCancelamento, setResultadoCancelamento] = useState("");
  /** Cadastro que a pessoa pediu para excluir — a confirmação abre em folha. */
  const [excluindoAnuncio, setExcluindoAnuncio] = useState<Professional | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  /**
   * Ainda não sabemos se a pessoa tem cadastro.
   *
   * `mine` começa vazio, e vazio é justamente a condição que manda a pessoa
   * para o formulário. Sem esta trava, quem já tem cadastro seria jogado na
   * tela de "novo cadastro" no instante entre abrir o painel e a resposta do
   * servidor chegar.
   */
  const [carregouCadastros, setCarregouCadastros] = useState(false);
  /** Falha ao carregar os cadastros. Vazio = deu certo (ou ainda está indo). */
  const [erroAoCarregar, setErroAoCarregar] = useState("");
  /** Muda a cada "tentar de novo", para o efeito rodar outra vez. */
  const [tentativaDeCarregar, setTentativaDeCarregar] = useState(0);

  useEffect(() => {
    if (!user) return;
    let ativo = true;
    setErroAoCarregar("");
    getMyProfessionals(user.id)
      .then((lista) => {
        if (!ativo) return;
        setMine(lista);
        setCarregouCadastros(true);
      })
      /* Falhar não pode ser confundido com "não tem cadastro".
         `carregouCadastros` continua falso de propósito: é ele que
         libera a ida para o formulário de cadastro novo, e quem já tem
         cadastro não pode ser mandado para lá porque a rede caiu. */
      .catch((err) => {
        if (!ativo) return;
        setErroAoCarregar(mensagemDeErro(err, "Não foi possível carregar seus cadastros."));
      });
    return () => {
      ativo = false;
    };
  }, [user, tentativaDeCarregar]);

  useEffect(() => {
    if (mine.length === 0) return;
    let active = true;

    getAssinaturasAtivasDeVarios(mine.map((p) => p.id)).then((porCadastro) => {
      if (active) setAssinaturas(porCadastro);
    });

    /* As vagas de destaque são por categoria e cidade, não por cadastro.
       Quem tem três cadastros na mesma categoria e cidade — o caso comum de
       quem cadastrou variações do mesmo ofício — fazia três chamadas
       idênticas para receber três vezes o mesmo número. Uma por par
       distinto basta, e o resultado é distribuído entre os cadastros
       daquele par. */
    const pares = new Map<string, { category: string; city: string }>();
    for (const p of mine) {
      if (p.category) pares.set(chaveDoPar(p.category, p.city), { category: p.category, city: p.city });
    }
    Promise.all(
      [...pares].map(async ([chave, { category, city }]) => [chave, await vagasDeDestaque(category, city)] as const)
    ).then((resultados) => {
      if (!active) return;
      const porPar = new Map(resultados);
      const porCadastro: Record<string, number> = {};
      for (const p of mine) {
        if (!p.category) continue;
        const n = porPar.get(chaveDoPar(p.category, p.city));
        if (n !== undefined) porCadastro[p.id] = n;
      }
      setVagas(porCadastro);
    });

    return () => {
      active = false;
    };
  }, [mine]);




  useEffect(() => {
    if (mine.length === 0) return;
    let active = true;
    const ids = mine.map((p) => p.id);
    countRecentProfileViewsDeVarios(ids, 30).then((totais) => {
      if (active) setViews30(totais);
    });
    countRecentProfileViewsDeVarios(ids, 7).then((totais) => {
      if (active) setViews7(totais);
    });
    return () => {
      active = false;
    };
  }, [mine]);

  async function carregarPedidos() {
    setPedidos(
      await getContactRequestsDeVarios(mine.map((p) => p.id), { includeArchived: mostrarArquivados })
    );
  }

  useEffect(() => {
    if (mine.length === 0) return;
    let active = true;
    getContactRequestsDeVarios(mine.map((p) => p.id), { includeArchived: mostrarArquivados }).then(
      (porCadastro) => {
        if (active) setPedidos(porCadastro);
      }
    );
    return () => {
      active = false;
    };
  }, [mine, mostrarArquivados]);

  async function marcarPedido(requestId: string, status: ContactRequestStatus) {
    await updateContactRequestStatus(requestId, status);
    await carregarPedidos();
  }

  async function handleSubscribeMonthly(professionalId: string, type: SubscriptionType) {
    setCheckoutLoading(`${professionalId}:${type}:monthly`);
    setMessage("");
    try {
      const { initPoint } = await startSubscriptionCheckout(professionalId, type);
      window.location.href = initPoint;
    } catch (err) {
      setMessage(mensagemDeErro(err, "Não foi possível iniciar o checkout do Mercado Pago."));
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
      setMessage(mensagemDeErro(err, "Não foi possível iniciar o checkout do Mercado Pago."));
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
  /* Um mês só, pago à vista. Existe para quem não tem conta no Mercado Pago:
     a recorrência exige conta (é nela que o cartão fica guardado), e muita
     gente aqui só usa Pix. */
  async function handleSubscribeMonthlyOneTime(professionalId: string, type: SubscriptionType) {
    setCheckoutLoading(`${professionalId}:${type}:monthly-pix`);
    setMessage("");
    try {
      const { initPoint } = await startAnnualCheckout(professionalId, type, "monthly");
      window.location.href = initPoint;
    } catch (err) {
      setMessage(mensagemDeErro(err, "Não foi possível iniciar o checkout do Mercado Pago."));
    } finally {
      setCheckoutLoading(null);
      setPlanSheetFor(null);
    }
  }

  async function handleSubscribeAnnualOneTime(professionalId: string, type: SubscriptionType) {
    setCheckoutLoading(`${professionalId}:${type}:annual-pix`);
    setMessage("");
    try {
      const { initPoint } = await startAnnualCheckout(professionalId, type);
      window.location.href = initPoint;
    } catch (err) {
      setMessage(mensagemDeErro(err, "Não foi possível iniciar o checkout do Mercado Pago."));
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
          <h1 style={{ marginTop: 0, fontSize: "1.5rem" }}>Vamos criar seu cadastro</h1>
          <p className="muted">
            Entre com sua conta Google — é a mesma que você já usa no celular. Não precisa criar senha nova nem
            preencher cadastro agora.
          </p>
          <div style={{ marginTop: 20 }}>
            <BotaoGoogle onClick={handleGoogleLogin} disabled={!hasDatabase()} />
          </div>
          <BotaoApple voltarPara="/painel" onErro={setLoginError} />
          {loginError && <p style={{ color: "var(--color-danger)", marginTop: 12 }}>{loginError}</p>}
          <p className="muted" style={{ marginTop: 18, fontSize: "0.85rem" }}>
            Anunciar é grátis. A conta premium e o destaque na busca são opcionais, e você decide depois.
          </p>
        </div>
      </div>
    );
  }

  /* Ninguém cadastrado ainda: em vez de um painel com uma lista vazia e um
     convite para começar, a pessoa já chega no formulário. Ela veio para
     preencher, e um toque a mais entre a intenção e o primeiro campo é
     exatamente o degrau em que metade das contas criadas parou. */
  /* Antes do redirecionamento, sempre: a tela de erro existe justamente
     para não deixar uma falha de rede virar "você não tem cadastro". */
  if (erroAoCarregar) {
    return (
      <div className="container" style={{ maxWidth: 460, paddingTop: 48 }}>
        <div className="card">
          <h1 style={{ marginTop: 0 }}>Não deu para abrir seus cadastros</h1>
          <p className="muted">{erroAoCarregar}</p>
          <p className="muted">
            Seus cadastros continuam no lugar — foi a conexão que falhou, não o seu anúncio.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => setTentativaDeCarregar((n) => n + 1)}
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (carregouCadastros && mine.length === 0) return <Navigate to="/painel/novo" replace />;

  /* O plano é do cadastro, não da conta — então a seção de assinaturas
     precisa saber de qual. Sem escolha feita, vale o primeiro. */
  const alvoAssinatura = mine.find((m) => m.id === assinaturaPara) ?? mine[0] ?? null;

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1>Painel do profissional</h1>
      {message && <p className="card">{message}</p>}

      <section style={{ marginTop: 24 }}>
        <div className="secao-topo">
          <h2 style={{ margin: 0 }}>Minhas páginas</h2>
          {mine.length < 5 && (
            /* Um cadastro por ofício, e não tudo amontoado num só: quem é
               fotógrafo e dá aula de violão tem duas vitrines diferentes,
               com fotos, textos e reputações separadas. */
            <Link className="btn btn-primary btn-novo" to="/painel/novo">
              <span aria-hidden="true">+</span> Nova página
            </Link>
          )}
        </div>
        <div className="grid grid-anuncios">
          {mine.map((p) => {
            const verified = isCurrentlyVerified(p);
            const plusActive = isCurrentlyPlusActive(p);
            const boosted = isCurrentlyBoosted(p);
            return (
              <div key={p.id} className={`card anuncio-card${p.entity_type === "pj" ? " anuncio-card-pj" : ""}`}>
                {/* O cartão de verdade, o mesmo componente da busca.
                    Aqui havia uma versão à parte, feita à mão: nome em
                    negrito, duas etiquetas e "categoria · cidade". Ela não
                    mostrava a foto, nem a especialidade, nem a nota — então
                    o dono não tinha, em lugar nenhum do app, como ver o que
                    o cliente vê. Quem quisesse conferir a própria foto tinha
                    que ir à busca e se procurar.
                    Toda diferença entre esta tela e a busca era, na prática,
                    uma decisão tomada às cegas: trocar a foto, escrever a
                    especialidade, pagar pelo destaque. */}
                <p className="previa-titulo">Como aparece na busca</p>
                <CartaoProfissional p={p} previa />
                <p className="views-line">
                  <strong>{views30[p.id] ?? 0}</strong>{" "}
                  {(views30[p.id] ?? 0) === 1 ? "pessoa viu" : "pessoas viram"} seu cadastro nos últimos 30 dias
                </p>
                {/* A foto passou a ser obrigatória depois que estes cadastros
                    já existiam. Sem este aviso, quem tem um cadastro antigo
                    sem foto só descobriria a regra ao tentar salvar outra
                    coisa qualquer — mudaria o telefone, apertaria salvar e
                    levaria um erro sobre foto, que não é o que estava
                    fazendo. Dito aqui, vira uma pendência à vista. */}
                {!p.photo_url && (
                  <div className="whats-pendente">
                    <p>
                      <strong>Falta {p.entity_type === "pj" ? "a logo" : "a foto"} do cadastro.</strong>{" "}
                      {p.entity_type === "pj"
                        ? "Cadastro sem logo aparece como um retângulo vazio na busca, ao lado de cartões com imagem."
                        : "Na busca, é o rosto que responde primeiro se a pessoa te chama ou não."}{" "}
                      Passou a ser obrigatória, então o cadastro só volta a salvar depois de enviá-la.
                    </p>
                    <Link className="btn btn-outline" to={`/painel/editar/${p.id}`}>
                      Enviar agora
                    </Link>
                  </div>
                )}
                {/* A confirmação do número fica no card, e não escondida nas
                    configurações: é o que separa um cadastro de um número
                    qualquer digitado, e quem se cadastra precisa ver que falta. */}
                {!CONFIRMACAO_POR_SMS ? null : p.whatsapp_verified ? (
                  /* O estado bom era a única coisa da tela sem desenho
                     nenhum: uma linha de texto com um "✓" solto, ao lado de
                     um aviso de pendência que ganhava cartão, borda e cor.
                     Ficava ao contrário — quem resolveu via menos do que
                     quem não resolveu.

                     O visto sai do texto e vira uma marca própria, redonda:
                     o caractere "✓" muda de desenho e de largura entre
                     Android, iPhone e computador, e num deles vinha
                     desalinhado com a linha. */
                  <p className="whats-ok">
                    <MarcaConfirmado />
                    <span>
                      <strong>{formatPhone(p.whatsapp || p.phone)}</strong> confirmado
                    </span>
                  </p>
                ) : !ehCelular(p.whatsapp || p.phone) ? (
                  /* Fixo não recebe SMS nem WhatsApp. Oferecer "Confirmar
                     agora" aqui seria mandar a pessoa esperar por um código
                     que ninguém tem como entregar — e o pior é que nada
                     acusaria o erro: o provedor aceita o envio, cobra, e a
                     mensagem some. O caminho é trocar o número, então é isso
                     que o cartão oferece. */
                  <div className="whats-pendente">
                    <p>
                      <strong>Falta um celular no cadastro.</strong> O número que está aí,{" "}
                      {formatPhone(p.whatsapp || p.phone)}, é de telefone fixo — e o código de confirmação
                      chega por SMS ou WhatsApp, que fixo não recebe. Coloque um celular no campo WhatsApp
                      para poder confirmar.
                    </p>
                    <Link className="btn btn-outline" to={`/painel/editar/${p.id}`}>
                      Colocar um celular
                    </Link>
                  </div>
                ) : (
                  <div className="whats-pendente">
                    <p>
                      <strong>Confirme o {formatPhone(p.whatsapp || p.phone)}.</strong> É este número que vai
                      receber o código e é ele que aparece para quem procura. Número confirmado passa mais
                      confiança — e impede que outra pessoa se cadastre usando o seu.
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
                  /* Sem a assinatura, ninguém consegue pedir retorno: o botão
                     "peça para te chamar" não existe no cadastro público. A
                     caixa vazia dizia "quando alguém deixar o número, ele
                     aparece aqui" — uma espera que nunca terminaria, porque
                     não dependia de aparecer cliente e sim de assinar.

                     Continua aparecendo se já houver pedidos: quem assinou,
                     recebeu e deixou vencer precisa responder quem chamou
                     enquanto valia. */
                  if (!verified && lista.length === 0) return null;
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

                {/* Editar e excluir fecham o cartão. "Excluir cadastro" em
                    vermelho no meio do caminho é a última coisa que deve
                    cruzar o olho de quem só passou para conferir o cadastro:
                    aqui embaixo elas são o que são — as ações sobre o cartão
                    inteiro, depois de ele ter sido lido.

                    A lista de serviços saiu daqui e foi para dentro da tela
                    de edição, junto dos serviços marcados. Editar o cadastro
                    e editar a lista do que ele oferece eram a mesma tarefa
                    partida em dois lugares. */}
                <div className="acoes-anuncio">
                  <Link className="btn btn-outline" to={`/painel/editar/${p.id}`}>
                    Editar
                  </Link>
                  <button className="btn btn-outline btn-perigo" onClick={() => setExcluindoAnuncio(p)}>
                    Excluir cadastro
                  </button>
                  {plusActive && (
                    <Link className="btn btn-outline" to={`/analytics/${p.id}`}>
                      Ver estatísticas
                    </Link>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </section>

      {/* Assinaturas em seção própria, fora dos cartões de cadastro.
          Estavam DENTRO de cada cartão: quem tem dois cadastros via a lista
          de planos duas vezes, com os mesmos preços, e precisava entender
          sozinho que a assinatura de cima valia para um e a de baixo para o
          outro. Aqui a lista aparece uma vez e a pergunta "para qual
          cadastro?" fica explícita, que é como ela existe de fato: o plano
          é do cadastro, não da conta. */}
      {alvoAssinatura && (() => {
        const p = alvoAssinatura;
        const verified = isCurrentlyVerified(p);
        const plusActive = isCurrentlyPlusActive(p);
        const boosted = isCurrentlyBoosted(p);
        return (
          <section style={{ marginTop: 28 }}>
            <div className="secao-topo">
              <h2 style={{ margin: 0 }}>
                Melhorar meu desempenho{" "}
                <span className="muted secao-preco">
                  — a partir de R$ {precoMensal("verification", p.entity_type).toFixed(2).replace(".", ",")}/mês
                </span>
              </h2>
            </div>

            {/* A escolha só aparece para quem tem mais de um cadastro. Com um
                só, perguntar "para qual?" é fazer a pessoa responder o que já
                está respondido. */}
            {mine.length > 1 && (
              <label className="assinatura-alvo">
                <span className="muted">Para qual cadastro?</span>
                <select value={p.id} onChange={(e) => setAssinaturaPara(e.target.value)}>
                  {mine.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.category}
                    </option>
                  ))}
                </select>
              </label>
            )}

                {/* Era um `<details>` com um `<summary>` que repetia, palavra
                    por palavra, o título da seção logo acima. Recolher fazia
                    sentido quando isto morava dentro do cartão do cadastro e
                    empurrava tudo para baixo; em seção própria, no fim da
                    página, não empurra nada — e um bloco fechado só esconde a
                    resposta de quem veio buscá-la. */}
                <div className="produtos produtos-oferta">

                  {/* O desempenho real abre a seção, e é ele que dá sentido
                      ao que vem depois: sem número, a lista de planos é só
                      uma lista de preços. Com número, cada item responde a
                      uma pergunta que a pessoa acabou de se fazer.

                      Antes esta frase vinha dentro de uma caixa com preço e
                      botão próprios — e logo abaixo vinha a MESMA assinatura
                      outra vez, na lista, com outro botão. Duas chamadas para
                      a mesma coisa na mesma tela: quem lia tinha que
                      descobrir sozinho que era o mesmo produto. */}
                  <p className="desempenho-resumo">
                    {(views7[p.id] ?? 0) > 0 ? (
                      <>
                        <strong>
                          {views7[p.id] === 1
                            ? "1 pessoa abriu seu cadastro nos últimos 7 dias."
                            : `${views7[p.id]} pessoas abriram seu cadastro nos últimos 7 dias.`}
                        </strong>{" "}
                        {!verified &&
                          'Elas viram seu telefone escrito, mas sem o botão de WhatsApp e sem o "peça para te chamar" — que é por onde chega a maior parte dos contatos.'}
                      </>
                    ) : (
                      <>
                        <strong>Ninguém abriu seu cadastro nos últimos 7 dias.</strong>{" "}
                        Aparecer antes na busca é o que muda esse número.
                      </>
                    )}
                  </p>

                  <p className="muted produtos-intro">
                    Seu cadastro é grátis para sempre. O que está aqui muda a sua vitrine, não o seu trabalho.
                  </p>

                  {/* O premium recebe o destaque que a caixa duplicada dava,
                      agora como ênfase no próprio item da lista: é a
                      assinatura que libera o contato, e sem contato o resto
                      rende pouco. */}
                  <div className={`produto${verified ? "" : " produto-principal"}`}>
                    <div className="produto-texto">
                      <strong>Conta premium</strong>
                      <p>
                        Três coisas: o selo dourado ao lado do seu nome, o <strong>botão de WhatsApp</strong> no
                        seu cadastro e o <strong>"peça para te chamar"</strong>, onde o cliente deixa o número e
                        você retorna. Sem a assinatura, seu telefone continua aparecendo — só que escrito, para
                        a pessoa anotar ou ligar.
                      </p>
                    </div>
                    <div className="produto-acao">
                      {verified ? (
                        <span className="produto-ativo">✓ Ativo</span>
                      ) : (
                        <>
                          <span className="produto-preco">
                            R$ {precoMensal("verification", p.entity_type).toFixed(2).replace(".", ",")}
                            <small>/mês</small>
                          </span>
                          <button
                            className="btn btn-teal"
                            onClick={() => {
                              // O premium entrega botão de WhatsApp e pedido de
                              // contato. Vender isso para um número que ninguém
                              // confirmou é vender um atalho que leva a lugar
                              // nenhum — e a reclamação volta para a plataforma.
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
                        Seu cadastro sobe para o topo da lista de quem procura o seu serviço em {p.city}. Quem
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

                  {p.entity_type === "pj" && (
                    <div className="produto">
                      <div className="produto-texto">
                        <strong>Empresa Plus</strong>
                        <p>
                          Relatórios do seu cadastro: quantas pessoas viram por dia, de quais serviços vieram e
                          quantas pediram contato. Serve para saber se vale a pena manter o cadastro.
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
                              {/* Sem esta ressalva, uma cobrança ainda não
                                  paga aparecia com a mesma cara de uma paga. */}
                              {!assinaturaConfirmada(a) ? " · aguardando o pagamento" : ""}
                            </em>
                          </span>
                          <button type="button" className="btn btn-outline" onClick={() => setCancelando(a)}>
                            Cancelar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
          </section>
        );
      })()}

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
                  Seu cadastro continua no ar de qualquer forma, no plano grátis.
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
                        mensagemDeErro(err, "Não foi possível cancelar agora.")
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
          title="Excluir este cadastro?"
          subtitle="Some da busca na hora, e não dá para desfazer."
          onClose={() => setExcluindoAnuncio(null)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0 }}>
              <strong>{excluindoAnuncio.name}</strong>
            </p>
            {/* Dito antes, não depois: as avaliações são o que a pessoa levou
                meses para juntar, e recriar o cadastro não as traz de volta. */}
            <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
              Junto com o cadastro saem as avaliações que você recebeu, os favoritos de quem te guardou e os
              pedidos de contato. Isso não volta, nem criando o cadastro de novo.
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
                } catch (err) {
                  setErroAoSalvar(true);
                  setFormMessage(mensagemDeErro(err, "Não foi possível excluir o cadastro."));
                } finally {
                  setExcluindo(false);
                }
              }}
            >
              {excluindo ? "Excluindo…" : "Sim, excluir"}
            </button>
            <button type="button" className="btn btn-outline btn-block" onClick={() => setExcluindoAnuncio(null)}>
              Manter cadastro
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
          subtitle="Quatro formas de pagar. As duas do cartão renovam sozinhas e pedem conta no Mercado Pago; as do Pix/boleto são pagamento único, sem conta — e a gente avisa por e-mail quando estiver perto de vencer."
          onClose={() => setPlanSheetFor(null)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div className="card" style={{ display: "grid", gap: 8 }}>
              <strong>
                Mensal no cartão — R$ {precoMensal(planSheetFor.type, planSheetFor.professional.entity_type).toFixed(2).replace(".", ",")}/mês
              </strong>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                Renova automaticamente: o Mercado Pago cobra o cartão todo mês, até você cancelar.{" "}
                <strong>Precisa de conta no Mercado Pago</strong> — é nela que o cartão fica guardado.
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
                Anual no cartão — R$ {annualPrice(planSheetFor.type, planSheetFor.professional.entity_type).toFixed(2).replace(".", ",")}/ano, 20% off
              </strong>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                Renova automaticamente todo ano — equivalente a R${" "}
                {(annualPrice(planSheetFor.type, planSheetFor.professional.entity_type) / 12).toFixed(2).replace(".", ",")}/mês. Só cartão de crédito, e{" "}
                <strong>precisa de conta no Mercado Pago</strong>.
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
            {/* Mensal sem conta: o degrau que mais derruba gente aqui não é o
                preço, é ter que criar conta no Mercado Pago para pagar
                R$ 10,90. Este cartão vem antes do anual à vista porque é o
                valor pequeno que a pessoa topa experimentar. */}
            <div className="card" style={{ display: "grid", gap: 8 }}>
              <strong>
                Mensal no Pix/boleto — R$ {precoMensal(planSheetFor.type, planSheetFor.professional.entity_type).toFixed(2).replace(".", ",")}/mês
              </strong>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                Pagamento único de 1 mês, <strong>sem precisar de conta no Mercado Pago</strong>. Não renova
                sozinho: perto de vencer, mandamos um e-mail com o link pronto.
              </span>
              <button
                className="btn btn-outline btn-block"
                disabled={checkoutLoading === `${planSheetFor.professional.id}:${planSheetFor.type}:monthly-pix`}
                onClick={() => handleSubscribeMonthlyOneTime(planSheetFor.professional.id, planSheetFor.type)}
              >
                {checkoutLoading === `${planSheetFor.professional.id}:${planSheetFor.type}:monthly-pix`
                  ? "Abrindo checkout…"
                  : "Pagar 1 mês no Pix/boleto"}
              </button>
            </div>
            <div className="card" style={{ display: "grid", gap: 8 }}>
              <strong>
                Anual no Pix/boleto — R$ {annualPrice(planSheetFor.type, planSheetFor.professional.entity_type).toFixed(2).replace(".", ",")}/ano, 20% off
              </strong>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                Pagamento único, <strong>sem conta no Mercado Pago</strong>. Pix e boleto não permitem cobrança
                automática, então quando estiver perto de vencer mandamos um e-mail com o link pronto.
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

    </div>
  );
}
