import { useEffect, useMemo, useState } from "react";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { mensagemDeErro } from "../lib/erros";
import { supabase } from "../lib/supabase";
import { lerTudo } from "../lib/lerTudo";
import { DEFAULT_CITY, DEFAULT_UF } from "../types/domain";

type Disponivel = {
  id: string;
  name: string;
  photo_url: string | null;
  areas_de_interesse: string[];
  especialidade: string | null;
  neighborhood: string | null;
};

/**
 * Quem está disponível na cidade.
 *
 * É o que a empresa vê SEM plano nenhum — e é de propósito: ver quem existe
 * é o que faz ela entender que vale a pena publicar uma vaga. Cobrar para
 * olhar afastaria os dois lados de uma cidade que ainda não tem nenhum.
 *
 * A lista NÃO é a busca do procurô. Lá o assunto era "quem conserta o meu
 * chuveiro": categoria, avaliação, selo, destaque pago. Aqui é "quem está
 * procurando trabalho agora", e a única ordenação que importa é essa. Sem
 * nota, sem selo, sem quem pagou para aparecer na frente.
 *
 * Quem escolheu ficar oculto não aparece aqui — só recebe vaga pelas ondas.
 * É uma decisão de quem está empregado e não quer ser encontrado pelo
 * patrão, e o app precisa respeitá-la sem exigir explicação.
 *
 * ── O desenho ─────────────────────────────────────────────────────────
 *
 * Era uma pilha de linhas: bolinha de 48px, nome, funções em cinza. A dona
 * mandou telas de referência quatro vezes e disse que o app não parecia com
 * elas; eu respondi trocando cor três vezes, até ela dizer "mais uma vez só
 * mudou as cores".
 *
 * Aqui está o que era, de fato, a diferença: busca em cápsula com a lupa
 * dentro, fileira de filtros que rola de lado, e o resultado em cartões com
 * FOTO grande, dois por linha. Numa cidade em que as pessoas se conhecem, o
 * rosto é o que faz a empresa reconhecer alguém — e uma lista de nomes em
 * cinza não tem como fazer isso, pintada de que cor for.
 */
export function ProfissionaisPage() {
  useTituloDaPagina("Profissionais disponíveis");

  const [lista, setLista] = useState<Disponivel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("");
  const [oficio, setOficio] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabase();
    if (!sb) {
      setCarregando(false);
      return;
    }

    /* `lerTudo` e não um `select` simples: a migration 0062 pôs teto de 200
       linhas por consulta, e uma lista que para no ducentésimo profissional
       sem avisar é o número que mente calado. */
    lerTudo<Disponivel>(() =>
      sb
        .from("professionals_public")
        .select("id, name, photo_url, areas_de_interesse, especialidade, neighborhood")
        .eq("city", DEFAULT_CITY)
        .eq("uf", DEFAULT_UF)
        .order("created_at", { ascending: false })
    )
      .then(setLista)
      .catch((err) => {
        /* Erro nunca vira lista vazia. "Ninguém disponível em Itabirito" e
           "a consulta falhou" são a mesma tela e coisas opostas — e a
           primeira faz a empresa desistir do app inteiro. */
        setErro(mensagemDeErro(err, "Não consegui carregar os profissionais."));
      })
      .finally(() => setCarregando(false));
  }, []);

  /* Os filtros saem do que existe de verdade na cidade, e não de uma lista
     fixa de ofícios. Uma fileira com "Soldador" numa cidade sem soldador
     nenhum é um filtro que só sabe devolver tela vazia. */
  const oficios = useMemo(() => {
    const conta = new Map<string, number>();
    for (const p of lista) {
      for (const f of p.areas_de_interesse ?? []) conta.set(f, (conta.get(f) ?? 0) + 1);
    }
    return [...conta.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
      .slice(0, 12)
      .map(([f]) => f);
  }, [lista]);

  const visiveis = useMemo(() => {
    const t = filtro.trim().toLocaleLowerCase("pt-BR");
    return lista.filter((p) => {
      if (oficio && !(p.areas_de_interesse ?? []).includes(oficio)) return false;
      if (!t) return true;
      return (
        p.name.toLocaleLowerCase("pt-BR").includes(t) ||
        (p.areas_de_interesse ?? []).some((f) => f.toLocaleLowerCase("pt-BR").includes(t))
      );
    });
  }, [lista, filtro, oficio]);

  return (
    <div className="ei">
      <div className="ei-tela">
        <h1 className="ei-titulo-g">Profissionais</h1>
        <p className="ei-apoio">
          Quem está em {DEFAULT_CITY} aceitando ser chamado para trabalhar.
        </p>

        {/* A busca em cápsula, com a lupa dentro. */}
        <div className="ei-busca" style={{ marginTop: 18 }}>
          <IconeLupa />
          <input
            type="search"
            placeholder="Nome ou função"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            aria-label="Procurar profissional"
          />
          {filtro && (
            <button
              type="button"
              className="ei-busca-limpar"
              aria-label="Limpar a busca"
              onClick={() => setFiltro("")}
            >
              ✕
            </button>
          )}
        </div>

        {/* A fileira de filtros só aparece quando há mais de um ofício na
            cidade: com um só, ela seria um botão que não filtra nada. */}
        {oficios.length > 1 && (
          <div className="ei-filtros" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="ei-chip"
              aria-pressed={oficio === null}
              onClick={() => setOficio(null)}
            >
              Todos
            </button>
            {oficios.map((f) => (
              <button
                key={f}
                type="button"
                className="ei-chip"
                aria-pressed={oficio === f}
                onClick={() => setOficio(oficio === f ? null : f)}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {erro && (
          <p className="ei-campo-erro" style={{ marginTop: 16 }} role="alert">
            {erro}
          </p>
        )}

        {carregando && (
          <p className="ei-apoio" style={{ marginTop: 20 }}>
            Carregando…
          </p>
        )}

        {!carregando && !erro && (
          <div className="ei-secao-linha">
            <h2>
              {visiveis.length} {visiveis.length === 1 ? "pessoa" : "pessoas"}
            </h2>
            {(oficio || filtro) && (
              <button
                type="button"
                className="ei-secao-acao"
                onClick={() => {
                  setOficio(null);
                  setFiltro("");
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {!carregando && !erro && visiveis.length === 0 && (
          <div className="ei-cartao" style={{ padding: 0 }}>
            <div className="ei-vazio">
              <span className="ei-vazio-icone" aria-hidden="true">
                <IconeLupa grande />
              </span>
              <h3 className="ei-titulo">
                {filtro.trim() || oficio ? "Nada com esse filtro" : "Ainda não há ninguém"}
              </h3>
              <p className="ei-apoio">
                {filtro.trim() || oficio
                  ? "Tente outro nome, ou tire o filtro para ver todo mundo."
                  : "Assim que alguém se cadastrar em Itabirito, aparece aqui."}
              </p>
            </div>
          </div>
        )}

        {visiveis.length > 0 && (
          <div className="ei-grade">
            {visiveis.map((p) => {
              const funcoes = p.areas_de_interesse ?? [];
              return (
                <article key={p.id} className="ei-foto-cartao">
                  <div className="ei-foto-cartao-imagem">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt="" loading="lazy" />
                    ) : (
                      <span className="ei-foto-cartao-inicial" aria-hidden="true">
                        {p.name.trim().charAt(0).toLocaleUpperCase("pt-BR")}
                      </span>
                    )}
                    {p.neighborhood && (
                      <span className="ei-foto-cartao-selo">{p.neighborhood}</span>
                    )}
                  </div>
                  <div className="ei-foto-cartao-texto">
                    <div className="ei-foto-cartao-nome">{p.name}</div>
                    <div className="ei-foto-cartao-oficio">
                      {funcoes.slice(0, 2).join(" · ") ||
                        p.especialidade ||
                        "Sem função marcada"}
                      {funcoes.length > 2 && ` +${funcoes.length - 2}`}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!carregando && !erro && lista.length > 0 && (
          <p className="ei-apoio" style={{ marginTop: 24 }}>
            Para chamar alguém para uma vaga, publique a vaga: o aviso vai para todo mundo que
            encaixa, inclusive quem escolheu não aparecer nesta lista.
          </p>
        )}
      </div>
    </div>
  );
}

function IconeLupa({ grande = false }: { grande?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={grande ? 30 : 20}
      height={grande ? 30 : 20}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </svg>
  );
}
