import { useEffect, useState } from "react";
import {
  apagarBanner,
  atualizarStatusDoPedido,
  enviarImagemDeBanner,
  getTodosOsBanners,
  listarPedidosDeAnuncio,
  salvarBanner,
} from "../lib/banners";
import { CATEGORIES, CITIES, type Banner, type PedidoDeAnuncio, type PedidoDeAnuncioStatus } from "../types/domain";
import { mensagemDeErro } from "../lib/erros";
import { DIAS_BANNER, PRECO_BANNER_CENTAVOS } from "../config";

const ONDE_APARECE: Record<string, string> = {
  busca: "na busca",
  boas_vindas: "na tela de início",
  tanto_faz: "ainda não sabe",
};

/**
 * Monta o link de WhatsApp a partir do que a pessoa digitou.
 *
 * O "55" só entra quando falta: quem digita o próprio número com o código
 * do país junto acabaria com "5555…", e o link abriria uma conversa com
 * ninguém — justamente no pedido de quem quer comprar.
 */
function linkDeWhatsApp(contato: string): string | null {
  const digitos = contato.replace(/\D/g, "");
  if (digitos.length < 10) return null; // não parece telefone; melhor não oferecer o botão
  const completo = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${completo}`;
}

const STATUS_DO_PEDIDO: { valor: PedidoDeAnuncioStatus; rotulo: string }[] = [
  { valor: "novo", rotulo: "Novo" },
  { valor: "em_conversa", rotulo: "Em conversa" },
  { valor: "fechado", rotulo: "Fechado" },
  { valor: "sem_interesse", rotulo: "Sem interesse" },
];

/**
 * Quem pediu para anunciar pela página /publicidade.
 *
 * Fica junto do cadastro de banners porque é o mesmo trabalho: o pedido
 * chega aqui, vira uma ligação, e a ligação vira um banner logo abaixo.
 * Separado em outra aba, viraria caixa de entrada que ninguém abre — e
 * pedido de compra parado é a única coisa aqui que custa dinheiro de
 * verdade.
 */
function PedidosDeAnuncio() {
  const [pedidos, setPedidos] = useState<PedidoDeAnuncio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregar() {
    setCarregando(true);
    setPedidos(await listarPedidosDeAnuncio());
    setCarregando(false);
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function mudarStatus(p: PedidoDeAnuncio, status: PedidoDeAnuncioStatus) {
    try {
      await atualizarStatusDoPedido(p.id, status);
      await carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível mudar o pedido."));
    }
  }

  // Só some da lista quem já foi resolvido: um pedido "em conversa" ainda é
  // trabalho em aberto e precisa continuar à vista.
  const abertos = pedidos.filter((p) => p.status === "novo" || p.status === "em_conversa");

  if (carregando) return <p className="muted">Carregando pedidos…</p>;
  if (pedidos.length === 0) return null;

  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>
        Pedidos de anúncio {abertos.length > 0 && `(${abertos.length} em aberto)`}
      </h3>
      {erro && <p className="form-erro">{erro}</p>}
      {abertos.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>Nenhum pedido em aberto.</p>
      ) : (
        <div className="banners-admin">
          {abertos.map((p) => (
            <div key={p.id} className="banner-linha">
              <div className="banner-dados">
                <strong>{p.nome}</strong>
                <span className="muted">
                  {p.contato}
                  {p.cidade ? ` · ${p.cidade}` : ""} · quer {ONDE_APARECE[p.local] ?? p.local}
                </span>
                <span className="muted">
                  {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </span>
                {p.mensagem && <span className="muted">"{p.mensagem}"</span>}
              </div>
              <div className="banner-acoes">
                {linkDeWhatsApp(p.contato) && (
                  <a
                    className="btn btn-outline"
                    href={linkDeWhatsApp(p.contato)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                )}
                <select
                  value={p.status}
                  onChange={(e) => mudarStatus(p, e.target.value as PedidoDeAnuncioStatus)}
                >
                  {STATUS_DO_PEDIDO.map((s) => (
                    <option key={s.valor} value={s.valor}>
                      {s.rotulo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/** O preço padrão já escrito no formato do campo ("29,90"). */
function valorPadrao(): string {
  return (PRECO_BANNER_CENTAVOS / 100).toFixed(2).replace(".", ",");
}

function daquiADias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function estaNoAr(b: Banner): boolean {
  const agora = hoje();
  return b.ativo && b.inicio <= agora && b.fim >= agora;
}

/**
 * Cadastro e acompanhamento dos banners vendidos.
 *
 * Mostra exibições e cliques porque são o que se leva para a conversa de
 * renovação: um comércio pequeno não renova por gostar do app, renova quando
 * vê que apareceu 4.200 vezes para gente da cidade dele.
 */
export function AdminBanners() {
  const [lista, setLista] = useState<Banner[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  const [anunciante, setAnunciante] = useState("");
  const [titulo, setTitulo] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [link, setLink] = useState("");
  const [local, setLocal] = useState<"busca" | "boas_vindas">("busca");
  const [cidade, setCidade] = useState("");
  const [categoria, setCategoria] = useState("");
  const [inicio, setInicio] = useState(hoje());
  const [fim, setFim] = useState(daquiADias(DIAS_BANNER));
  const [contatoAnunciante, setContatoAnunciante] = useState("");
  const [valor, setValor] = useState(valorPadrao());
  const [pago, setPago] = useState(false);
  const [observacao, setObservacao] = useState("");

  async function carregar() {
    setCarregando(true);
    setLista(await getTodosOsBanners());
    setCarregando(false);
  }

  useEffect(() => {
    void carregar();
  }, []);

  function limpar() {
    setEditando(null);
    setAnunciante("");
    setTitulo("");
    setImagemUrl("");
    setLink("");
    setLocal("busca");
    setCidade("");
    setCategoria("");
    setInicio(hoje());
    setFim(daquiADias(DIAS_BANNER));
    setContatoAnunciante("");
    setValor(valorPadrao());
    setPago(false);
    setObservacao("");
    setErro("");
  }

  function editar(b: Banner) {
    setEditando(b.id);
    setAnunciante(b.anunciante);
    setTitulo(b.titulo);
    setImagemUrl(b.imagem_url);
    setLink(b.link ?? "");
    setLocal(b.local);
    setCidade(b.cidade ?? "");
    setCategoria(b.categoria ?? "");
    setInicio(b.inicio);
    setFim(b.fim);
    setContatoAnunciante(b.contato_anunciante ?? "");
    setValor(b.valor_centavos === null ? "" : (b.valor_centavos / 100).toFixed(2).replace(".", ","));
    setPago(b.pago);
    setObservacao(b.observacao ?? "");
    setErro("");
  }

  async function escolherImagem(arquivo: File | undefined) {
    if (!arquivo) return;
    setEnviandoImagem(true);
    setErro("");
    try {
      setImagemUrl(await enviarImagemDeBanner(arquivo));
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível enviar a imagem."));
    } finally {
      setEnviandoImagem(false);
    }
  }

  async function salvar() {
    if (!anunciante.trim()) return setErro("Escreva o nome de quem está anunciando.");
    if (!imagemUrl) return setErro("Envie a imagem do banner.");
    if (fim < inicio) return setErro("A data de fim não pode ser antes da de início.");
    setSalvando(true);
    setErro("");
    try {
      await salvarBanner({
        ...(editando ? { id: editando } : {}),
        anunciante: anunciante.trim(),
        titulo: titulo.trim(),
        imagem_url: imagemUrl,
        // Campos vazios viram nulo, que no banco significa "sem restrição".
        // String vazia significaria "cidade chamada ''" e nunca casaria.
        link: link.trim() || null,
        local,
        cidade: cidade || null,
        categoria: categoria || null,
        inicio,
        fim,
        contato_anunciante: contatoAnunciante.trim() || null,
        valor_centavos: valor.trim() ? Math.round(Number(valor.replace(/\./g, "").replace(",", ".")) * 100) : null,
        pago,
        observacao: observacao.trim() || null,
      });
      limpar();
      await carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar o banner."));
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(b: Banner) {
    try {
      await salvarBanner({ id: b.id, ativo: !b.ativo });
      await carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível mudar o banner."));
    }
  }

  async function remover(b: Banner) {
    try {
      await apagarBanner(b.id);
      if (editando === b.id) limpar();
      await carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível apagar o banner."));
    }
  }

  // Sete dias é o aviso que dá tempo de ligar, combinar e receber antes de o
  // banner sair do ar — encurtar vira correria, alongar vira ruído fixo.
  const limite = daquiADias(7);
  const vencendo = lista.filter((b) => estaNoAr(b) && b.fim <= limite);
  const devendo = lista.filter((b) => estaNoAr(b) && !b.pago);

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Publicidade paga na tela de busca. Quando há mais de um no ar para a mesma busca, o app sorteia qual
        mostrar a cada abertura — assim todos os que pagaram aparecem, sem fila e sem o primeiro levar sempre a
        melhor. O <strong>pagamento acontece fora do app</strong>; aqui fica a anotação de quem pagou o quê.
      </p>

      {/* Os dois avisos que valem dinheiro. Campanha que vence sem ninguém
          reparar é renovação perdida — e é o jeito mais comum de perder
          receita numa venda de porta em porta. Banner no ar sem pagamento é
          o outro lado do mesmo descuido. */}
      {vencendo.length > 0 && (
        <p className="aviso-banner">
          <strong>Vence nos próximos 7 dias:</strong>{" "}
          {vencendo
            .map((b) => `${b.anunciante} (${b.fim.split("-").reverse().join("/")})`)
            .join(", ")}
          . Hora de ligar para renovar.
        </p>
      )}
      {devendo.length > 0 && (
        <p className="aviso-banner devendo">
          <strong>No ar e ainda não pago:</strong> {devendo.map((b) => b.anunciante).join(", ")}.
        </p>
      )}

      <PedidosDeAnuncio />

      {carregando ? (
        <p className="muted">Carregando…</p>
      ) : (
        lista.length > 0 && (
          <div className="banners-admin">
            {lista.map((b) => (
              <div key={b.id} className={estaNoAr(b) ? "banner-linha no-ar" : "banner-linha"}>
                <img src={b.imagem_url} alt="" />
                <div className="banner-dados">
                  <strong>{b.anunciante}</strong>
                  <span className="muted">
                    {b.local === "boas_vindas" ? "boas-vindas" : "busca"} ·{" "}
                    {b.inicio.split("-").reverse().join("/")} a {b.fim.split("-").reverse().join("/")}
                    {b.categoria ? ` · só em ${b.categoria}` : ""}
                    {b.cidade ? ` · ${b.cidade}` : ""}
                  </span>
                  <span className="banner-numeros">
                    {b.exibicoes.toLocaleString("pt-BR")} exibições · {b.cliques.toLocaleString("pt-BR")}{" "}
                    cliques
                    {b.exibicoes > 0 && ` · ${((b.cliques / b.exibicoes) * 100).toFixed(1).replace(".", ",")}%`}
                  </span>
                  <span className={estaNoAr(b) ? "banner-estado ok" : "banner-estado"}>
                    {estaNoAr(b) ? "no ar" : b.ativo ? "fora do período" : "desligado"}
                    {b.valor_centavos !== null &&
                      ` · ${(b.valor_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                    {b.valor_centavos !== null && (b.pago ? " · pago" : " · a receber")}
                  </span>
                  {b.contato_anunciante && <span className="muted">{b.contato_anunciante}</span>}
                </div>
                <div className="banner-acoes">
                  <button type="button" onClick={() => editar(b)}>
                    Editar
                  </button>
                  <button type="button" onClick={() => alternarAtivo(b)}>
                    {b.ativo ? "Desligar" : "Ligar"}
                  </button>
                  <button type="button" className="perigo" onClick={() => remover(b)}>
                    Apagar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <div className="banner-form">
        <h3 style={{ margin: 0, fontSize: "0.95rem" }}>{editando ? "Editando banner" : "Novo banner"}</h3>

        <input
          placeholder="Quem está anunciando (ex: Ótica Central)"
          value={anunciante}
          maxLength={60}
          onChange={(e) => setAnunciante(e.target.value)}
        />
        <input
          placeholder="Título curto (aparece se a imagem não carregar)"
          value={titulo}
          maxLength={80}
          onChange={(e) => setTitulo(e.target.value)}
        />

        <label style={{ display: "grid", gap: 6 }}>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Imagem do banner — proporção 3 por 1 (ex: 1200 × 400), até 2 MB
          </span>
          <input type="file" accept="image/*" onChange={(e) => escolherImagem(e.target.files?.[0])} />
        </label>
        {enviandoImagem && <p className="muted">Enviando imagem…</p>}
        {imagemUrl && <img src={imagemUrl} alt="Prévia do banner" className="banner-previa" />}

        <input
          placeholder="Link ao tocar (site, WhatsApp, ou /profissional/<id>)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: "0.85rem" }}>Onde aparece</span>
          <select value={local} onChange={(e) => setLocal(e.target.value as "busca" | "boas_vindas")}>
            <option value="busca">Faixa de publicidade na busca</option>
            <option value="boas_vindas">Cartão na tela de boas-vindas ("Tem gente boa aqui do lado")</option>
          </select>
        </label>

        <div className="banner-form-linha">
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>Cidade</span>
            <select value={cidade} onChange={(e) => setCidade(e.target.value)}>
              <option value="">Todas</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>Só na categoria</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Qualquer busca</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="banner-form-linha">
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>Começa em</span>
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>Termina em</span>
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </label>
        </div>

        <div className="banner-form-linha">
          <input
            placeholder="Contato do anunciante (WhatsApp)"
            value={contatoAnunciante}
            maxLength={60}
            onChange={(e) => setContatoAnunciante(e.target.value)}
          />
          <input
            placeholder="Valor combinado (ex: 79,90)"
            value={valor}
            inputMode="decimal"
            onChange={(e) => setValor(e.target.value)}
          />
        </div>

        <label className="opcao-endereco" style={{ background: "var(--color-surface)" }}>
          <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} />
          <span>
            <strong>Já recebi o pagamento.</strong>
            <span className="opcao-obs">
              O app não cobra nada — isto é só a sua anotação. Enquanto estiver desmarcado, o banner aparece na
              lista de "no ar e ainda não pago".
            </span>
          </span>
        </label>

        <input
          placeholder="Observação (forma de pagamento, combinados)"
          value={observacao}
          maxLength={200}
          onChange={(e) => setObservacao(e.target.value)}
        />

        {erro && <p className="form-erro">{erro}</p>}

        <div className="catalogo-form-acoes">
          <button className="btn btn-primary" onClick={salvar} disabled={salvando || enviandoImagem}>
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar banner"}
          </button>
          {editando && (
            <button className="btn btn-outline" onClick={limpar}>
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
