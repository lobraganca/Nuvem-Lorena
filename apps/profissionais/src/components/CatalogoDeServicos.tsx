import { useEffect, useState } from "react";
import {
  apagarServicoDoCatalogo,
  centavosDoTexto,
  getCatalogo,
  precoEmReais,
  salvarServicoDoCatalogo,
} from "../lib/professionals";
import { MAX_SERVICOS_CATALOGO, UNIDADES_SUGERIDAS, type ServicoOferecido } from "../types/domain";
import { mensagemDeErro } from "../lib/erros";

/**
 * Catálogo de serviços com preço, no painel de quem anuncia.
 *
 * Fica fora do formulário do anúncio de propósito, e só depois que ele
 * existe: o catálogo pertence a um anúncio salvo (cada item guarda o id
 * dele), e um editor dentro do formulário teria que segurar tudo em memória
 * esperando o "Salvar" — inclusive as remoções, que precisariam de uma
 * segunda lista só para lembrar o que apagar. Aqui cada item é salvo quando
 * a pessoa termina, e some quando ela apaga.
 *
 * É opcional. Um encanador não precisa listar nada; um hotel com três tipos
 * de diária ou um laboratório com trinta exames não tem como viver sem.
 */
export function CatalogoDeServicos({ professionalId }: { professionalId: string }) {
  const [itens, setItens] = useState<ServicoOferecido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [unidade, setUnidade] = useState("");

  async function carregar() {
    setCarregando(true);
    setItens(await getCatalogo(professionalId));
    setCarregando(false);
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  function limpar() {
    setEditando(null);
    setNome("");
    setDescricao("");
    setPreco("");
    setUnidade("");
    setErro("");
  }

  function editar(item: ServicoOferecido) {
    setEditando(item.id);
    setNome(item.nome);
    setDescricao(item.descricao);
    setPreco(item.preco_centavos === null ? "" : (item.preco_centavos / 100).toFixed(2).replace(".", ","));
    setUnidade(item.unidade);
    setErro("");
  }

  async function salvar() {
    if (nome.trim().length < 2) {
      setErro("Escreva o nome do serviço.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await salvarServicoDoCatalogo({
        ...(editando ? { id: editando } : {}),
        professional_id: professionalId,
        nome: nome.trim(),
        descricao: descricao.trim(),
        // Preço em branco não é zero: é "sob orçamento". Guardar zero faria o
        // anúncio dizer "R$ 0,00", que é uma promessa que ninguém quer fazer.
        preco_centavos: preco.trim() ? centavosDoTexto(preco) : null,
        unidade: unidade.trim(),
        ordem: editando ? (itens.find((i) => i.id === editando)?.ordem ?? 0) : itens.length,
      });
      limpar();
      await carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar este serviço."));
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(id: string) {
    try {
      await apagarServicoDoCatalogo(id);
      if (editando === id) limpar();
      await carregar();
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível apagar este serviço."));
    }
  }

  const cheio = itens.length >= MAX_SERVICOS_CATALOGO;

  return (
    <div className="catalogo">
      <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.85rem" }}>
        Opcional. Serve para quem tem uma <strong>lista</strong> de serviços com preços diferentes — diárias,
        exames, ajustes, pacotes. Quem faz um serviço só pode deixar vazio. Preço em branco aparece como{" "}
        <strong>“Sob orçamento”</strong>.
      </p>

      {carregando ? (
        <p className="muted">Carregando…</p>
      ) : (
        itens.length > 0 && (
          <ul className="catalogo-lista">
            {itens.map((item) => (
              <li key={item.id}>
                <span className="catalogo-info">
                  <strong>{item.nome}</strong>
                  {item.descricao && <span className="muted">{item.descricao}</span>}
                </span>
                <span className="catalogo-preco">
                  {precoEmReais(item.preco_centavos)}
                  {item.unidade && <span className="muted"> {item.unidade}</span>}
                </span>
                <span className="catalogo-acoes">
                  <button type="button" onClick={() => editar(item)}>
                    Editar
                  </button>
                  <button type="button" className="perigo" onClick={() => apagar(item.id)}>
                    Apagar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )
      )}

      {cheio ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Você chegou a {MAX_SERVICOS_CATALOGO} serviços — o limite. Apague um para acrescentar outro.
        </p>
      ) : (
        <div className="catalogo-form">
          <input
            placeholder="Nome do serviço (ex: Diária de casal)"
            value={nome}
            maxLength={80}
            onChange={(e) => setNome(e.target.value)}
          />
          <input
            placeholder="Detalhe (opcional): o que está incluído"
            value={descricao}
            maxLength={160}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <div className="catalogo-form-linha">
            <input
              placeholder="Preço (deixe vazio para orçamento)"
              value={preco}
              inputMode="decimal"
              onChange={(e) => setPreco(e.target.value)}
            />
            <input
              placeholder="Unidade"
              list="unidades-sugeridas"
              value={unidade}
              maxLength={20}
              onChange={(e) => setUnidade(e.target.value)}
            />
            <datalist id="unidades-sugeridas">
              {UNIDADES_SUGERIDAS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          {erro && <p className="form-erro">{erro}</p>}

          <div className="catalogo-form-acoes">
            <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Acrescentar ao catálogo"}
            </button>
            {editando && (
              <button type="button" className="btn btn-outline" onClick={limpar}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
