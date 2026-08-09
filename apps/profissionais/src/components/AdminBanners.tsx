import { useEffect, useState } from "react";
import { apagarBanner, enviarImagemDeBanner, getTodosOsBanners, salvarBanner } from "../lib/banners";
import { CATEGORIES, CITIES, type Banner } from "../types/domain";
import { mensagemDeErro } from "../lib/erros";

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
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
  const [cidade, setCidade] = useState("");
  const [categoria, setCategoria] = useState("");
  const [inicio, setInicio] = useState(hoje());
  const [fim, setFim] = useState(daquiADias(30));

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
    setCidade("");
    setCategoria("");
    setInicio(hoje());
    setFim(daquiADias(30));
    setErro("");
  }

  function editar(b: Banner) {
    setEditando(b.id);
    setAnunciante(b.anunciante);
    setTitulo(b.titulo);
    setImagemUrl(b.imagem_url);
    setLink(b.link ?? "");
    setCidade(b.cidade ?? "");
    setCategoria(b.categoria ?? "");
    setInicio(b.inicio);
    setFim(b.fim);
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
        cidade: cidade || null,
        categoria: categoria || null,
        inicio,
        fim,
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

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Publicidade paga na tela de busca. Quando há mais de um no ar para a mesma busca, o app sorteia qual
        mostrar a cada abertura — assim todos os que pagaram aparecem, sem fila e sem o primeiro levar sempre a
        melhor.
      </p>

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
                  </span>
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
