import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getTodasAsCategorias, type CategoriaPopular } from "../lib/professionals";
import { GRUPOS_DE_SERVICOS } from "../types/domain";
import { IconeDeServico } from "../components/IconeDeServico";
import { useTituloDaPagina } from "../lib/tituloDaPagina";

/**
 * Todas as categorias com gente cadastrada.
 *
 * A grade da busca mostra oito, e oito é pouco para quem procura algo que
 * não é dos ofícios mais numerosos da cidade — costureira, sapateiro,
 * professor de música. Essa pessoa tinha duas saídas: adivinhar a palavra
 * certa no campo de busca ou abrir o filtro de serviços, uma lista solta em
 * ordem alfabética dentro de um `select` de celular. Aqui ela vê tudo o que
 * existe, agrupado, e toca.
 *
 * Os grupos são os mesmos do formulário de cadastro ("Casa e obra",
 * "Beleza e bem-estar"). Não é economia de código: é a mesma cidade vista
 * dos dois lados, e quem se cadastrou em "Técnica e conserto" está onde
 * quem procura vai olhar.
 *
 * Categoria escrita à mão por quem se cadastrou não pertence a grupo
 * nenhum e cai em "Outros serviços" — some do fim da lista em vez de
 * sumir da tela.
 */
export function CategoriasPage() {
  useTituloDaPagina("Todas as categorias");
  const navigate = useNavigate();
  const [todas, setTodas] = useState<CategoriaPopular[] | null>(null);

  useEffect(() => {
    getTodasAsCategorias().then(setTodas);
  }, []);

  /* A busca guarda a categoria em memória, não no endereço. Para chegar lá
     com o filtro já escolhido, o nome viaja pela URL — que é também o que
     permite mandar "olha os eletricistas daqui" por WhatsApp. A tela de
     busca limpa o parâmetro assim que o lê. */
  function buscar(categoria: string) {
    navigate(`/?servico=${encodeURIComponent(categoria)}`);
  }

  const lista = todas ?? [];
  const porNome = new Map(lista.map((c) => [c.categoria, c.quantidade]));
  /* Cada grupo fica só com o que tem cadastro. Um grupo inteiro vazio não
     aparece: título com nada embaixo é a tela dizendo que está quebrada. */
  const grupos: { nome: string; itens: string[] }[] = GRUPOS_DE_SERVICOS.map((g) => ({
    nome: g.grupo as string,
    itens: (g.itens as readonly string[]).filter((i) => porNome.has(i)),
  })).filter((g) => g.itens.length > 0);

  const conhecidas = new Set(GRUPOS_DE_SERVICOS.flatMap((g) => g.itens as readonly string[]));
  const outros = lista.map((c) => c.categoria).filter((c) => !conhecidas.has(c));
  if (outros.length > 0) grupos.push({ nome: "Outros serviços", itens: outros });

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <Link to="/" className="voltar-link">
        ← Buscar
      </Link>
      <h1 style={{ marginTop: 10 }}>Todas as categorias</h1>
      <p className="muted painel-subtitulo">
        Só o que tem gente cadastrada hoje em Itabirito. Toque para ver quem atende.
      </p>

      {todas === null && <p className="muted">Carregando…</p>}

      {todas !== null && grupos.length === 0 && (
        <div className="card">
          <strong>Ainda não tem ninguém cadastrado.</strong>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Assim que o primeiro cadastro entrar no ar, o serviço dele aparece aqui.
          </p>
        </div>
      )}

      {grupos.map((g) => (
        <section key={g.nome} className="grupo-categorias">
          <h2 className="grupo-titulo">{g.nome}</h2>
          <ul className="categorias-lista">
            {g.itens.map((nome) => (
              <li key={nome}>
                <button type="button" className="categoria-linha" onClick={() => buscar(nome)}>
                  <span className="categoria-linha-simbolo">
                    <IconeDeServico categoria={nome} tamanho={22} />
                  </span>
                  <span className="categoria-linha-nome">{nome}</span>
                  <span className="categoria-linha-quantos">
                    {porNome.get(nome) === 1 ? "1 opção" : `${porNome.get(nome)} opções`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
