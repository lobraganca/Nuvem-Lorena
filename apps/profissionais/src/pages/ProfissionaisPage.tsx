import { useEffect, useState } from "react";
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
 */
export function ProfissionaisPage() {
  useTituloDaPagina("Profissionais disponíveis");

  const [lista, setLista] = useState<Disponivel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("");

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

  const visiveis = filtro.trim()
    ? lista.filter((p) => {
        const t = filtro.toLocaleLowerCase("pt-BR");
        return (
          p.name.toLocaleLowerCase("pt-BR").includes(t) ||
          (p.areas_de_interesse ?? []).some((f) => f.toLocaleLowerCase("pt-BR").includes(t))
        );
      })
    : lista;

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 24 }}>
      <h1 style={{ marginBottom: 4 }}>Profissionais</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Quem está em {DEFAULT_CITY} aceitando ser chamado para trabalhar.
      </p>

      <input
        type="search"
        placeholder="Procurar por nome ou função"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        aria-label="Procurar profissional"
        style={{ marginTop: 16 }}
      />

      {erro && <p style={{ color: "var(--color-danger)", marginTop: 16 }}>{erro}</p>}

      {carregando && <p className="muted" style={{ marginTop: 20 }}>Carregando…</p>}

      {!carregando && !erro && visiveis.length === 0 && (
        <div className="card" style={{ marginTop: 20, textAlign: "center" }}>
          <p style={{ margin: 0 }}>
            {filtro.trim() ? "Ninguém com esse nome ou função." : "Ainda não há ninguém cadastrado."}
          </p>
        </div>
      )}

      <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
        {visiveis.map((p) => (
          <div key={p.id} className="card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {p.photo_url ? (
              <img
                src={p.photo_url}
                alt=""
                style={{ width: 48, height: 48, borderRadius: 999, objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              /* Círculo com a inicial, e não um ícone genérico de pessoa:
                 numa lista de trinta, trinta silhuetas iguais viram ruído.
                 A letra pelo menos distingue uma linha da outra. */
              <span
                aria-hidden="true"
                style={{
                  width: 48, height: 48, borderRadius: 999, flexShrink: 0,
                  display: "grid", placeItems: "center",
                  background: "var(--color-primary-container)",
                  color: "var(--color-on-primary-container)",
                  fontWeight: 700, fontSize: "1.1rem",
                }}
              >
                {p.name.trim().charAt(0).toLocaleUpperCase("pt-BR")}
              </span>
            )}

            <div style={{ minWidth: 0, flex: 1 }}>
              <strong style={{ display: "block" }}>{p.name}</strong>
              <span className="muted" style={{ fontSize: "0.88em" }}>
                {(p.areas_de_interesse ?? []).slice(0, 3).join(" · ") ||
                  p.especialidade ||
                  "Sem função marcada"}
                {(p.areas_de_interesse?.length ?? 0) > 3 &&
                  ` +${(p.areas_de_interesse?.length ?? 0) - 3}`}
              </span>
            </div>
          </div>
        ))}
      </div>

      {!carregando && !erro && lista.length > 0 && (
        <p className="muted" style={{ marginTop: 20, fontSize: "0.88em" }}>
          Para chamar alguém para uma vaga, publique a vaga: o aviso vai para todo
          mundo que encaixa, inclusive quem escolheu não aparecer nesta lista.
        </p>
      )}
    </div>
  );
}
