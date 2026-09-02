/**
 * Favoritos: empresas e candidatos, na mesma lista.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "ter opção de favoritar empresas e candidatos e ter onde ver os
 * favoritos."
 *
 * ── POR QUE UMA TABELA NOVA, COM UMA JÁ CHAMADA `favorites` NO BANCO ───
 *
 * Existe `favorites` desde o procurô, e ela guarda SÓ profissional
 * (`user_id` + `professional_id`, sem lugar para empresa). Havia duas
 * saídas:
 *
 *   acrescentar `company_id` nela   mexeria numa tabela que o outro app
 *                                   ainda lê, e a coluna nula em todas as
 *                                   linhas dele seria dívida para sempre;
 *   uma tabela nova para os dois    é a da 0106, com duas colunas de alvo
 *                                   e um `check` de que exatamente uma
 *                                   está preenchida.
 *
 * A segunda ganhou, e a antiga fica intocada: nenhuma tela do Ei a lê hoje
 * (a rota `/favoritos` nem existia), então não há nada para migrar. Se um
 * dia houver, é uma cópia de uma consulta só.
 *
 * ── O FAVORITO É POR CONTA, E NÃO POR EMPRESA ──────────────────────────
 *
 * Quem tem a padaria e a lanchonete não quer favoritar a mesma pessoa duas
 * vezes, uma em cada loja. A chave é o `user_id`.
 */
import { supabase } from "./supabase";

export type Favoritos = {
  /** Ids das empresas favoritadas. */
  empresas: Set<string>;
  /** Ids dos cadastros de profissional favoritados. */
  pessoas: Set<string>;
};

export const SEM_FAVORITOS: Favoritos = { empresas: new Set(), pessoas: new Set() };

/**
 * O que esta conta favoritou, em conjuntos.
 *
 * Conjuntos e não listas: quem pergunta é o coraçãozinho de cada cartão —
 * "este aqui está marcado?" — e essa pergunta em lista é uma varredura por
 * item, o que numa tela de sessenta pessoas vira sessenta varreduras.
 *
 * Erro NÃO sobe aqui, e é a única função deste arquivo assim: ela é
 * chamada de telas que funcionam sem ela (a lista de gente, o perfil), e
 * derrubar a lista inteira porque o estado de um coração não carregou
 * seria trocar o que a pessoa veio ver por uma mensagem de erro. Sem
 * resposta, os corações ficam apagados — que é o mesmo que "ainda não
 * favoritei", e o toque conserta.
 */
export async function lerFavoritos(userId: string): Promise<Favoritos> {
  const sb = supabase();
  if (!sb) return SEM_FAVORITOS;
  try {
    const { data, error } = await sb
      .from("favoritos")
      .select("company_id, professional_id")
      .eq("user_id", userId);
    if (error) throw error;
    const f: Favoritos = { empresas: new Set(), pessoas: new Set() };
    for (const linha of (data ?? []) as { company_id: string | null; professional_id: string | null }[]) {
      if (linha.company_id) f.empresas.add(linha.company_id);
      if (linha.professional_id) f.pessoas.add(linha.professional_id);
    }
    return f;
  } catch {
    return SEM_FAVORITOS;
  }
}

/**
 * Marca ou desmarca. Devolve o estado NOVO.
 *
 * Erro SOBE. Aqui é o contrário da leitura: a pessoa acabou de tocar, está
 * esperando uma resposta, e um coração que acende sem ter gravado é a
 * mentira mais irritante que uma tela pode contar — ela volta amanhã e a
 * lista está vazia.
 */
export async function alternarFavorito(
  userId: string,
  alvo: { empresa?: string; pessoa?: string },
  marcadoAgora: boolean
): Promise<boolean> {
  const sb = supabase();
  if (!sb) throw new Error("Banco não configurado");

  const coluna = alvo.empresa ? "company_id" : "professional_id";
  const valor = alvo.empresa ?? alvo.pessoa;
  if (!valor) throw new Error("Favorito sem alvo");

  if (marcadoAgora) {
    const { error } = await sb
      .from("favoritos")
      .delete()
      .eq("user_id", userId)
      .eq(coluna, valor);
    if (error) throw error;
    return false;
  }

  const { error } = await sb.from("favoritos").insert({ user_id: userId, [coluna]: valor });
  /* `23505` é o índice único da 0106: já estava favoritado. Acontece com
     dois toques rápidos no mesmo coração, e não é erro nenhum para quem
     tocou — o resultado que ela queria (marcado) é o que está lá. */
  if (error && (error as { code?: string }).code !== "23505") throw error;
  return true;
}

export type EmpresaFavorita = {
  id: string;
  nome: string;
  foto: string | null;
  onde: string;
};

export type PessoaFavorita = {
  id: string;
  nome: string;
  foto: string | null;
  oficios: string[];
};

/**
 * Os favoritos com nome e foto, para a tela que os lista.
 *
 * Erro SOBE: esta é a tela cujo assunto SÃO os favoritos, e "você não tem
 * nenhum" é uma resposta que só pode aparecer quando for verdade.
 *
 * As duas leituras usam as views públicas. `companies_public` só mostra
 * empresa com vaga no ar (0100) — então uma empresa favoritada que fechou
 * tudo some da lista, e é o certo: um cartão que não leva a lugar nenhum
 * é pior que um a menos.
 */
export async function lerFavoritosCompletos(
  userId: string
): Promise<{ empresas: EmpresaFavorita[]; pessoas: PessoaFavorita[] }> {
  const sb = supabase();
  if (!sb) return { empresas: [], pessoas: [] };

  const { data, error } = await sb
    .from("favoritos")
    .select("company_id, professional_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const linhas = (data ?? []) as { company_id: string | null; professional_id: string | null }[];
  const idsEmpresas = linhas.map((l) => l.company_id).filter((x): x is string => !!x);
  const idsPessoas = linhas.map((l) => l.professional_id).filter((x): x is string => !!x);

  /* As duas consultas em paralelo, e cada uma só quando há o que buscar:
     um `.in()` com lista vazia é uma viagem ao banco para receber zero
     linhas. */
  const [emp, pes] = await Promise.all([
    idsEmpresas.length
      ? sb
          .from("companies_public")
          .select("id, company_name, photo_url, city, uf, neighborhood")
          .in("id", idsEmpresas)
      : Promise.resolve({ data: [], error: null }),
    idsPessoas.length
      ? sb
          .from("professionals_public")
          .select("id, name, photo_url, areas_de_interesse")
          .in("id", idsPessoas)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (emp.error) throw emp.error;
  if (pes.error) throw pes.error;

  return {
    empresas: ((emp.data ?? []) as any[]).map((e) => ({
      id: e.id,
      nome: e.company_name ?? "",
      foto: e.photo_url ?? null,
      onde: [e.neighborhood, [e.city, e.uf].filter(Boolean).join("/")].filter(Boolean).join(" · "),
    })),
    pessoas: ((pes.data ?? []) as any[]).map((p) => ({
      id: p.id,
      nome: p.name ?? "",
      foto: p.photo_url ?? null,
      oficios: p.areas_de_interesse ?? [],
    })),
  };
}
