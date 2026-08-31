import { supabase } from "./supabase";
import type { JobListing } from "../types/domain";

/** Uma vaga que chegou para este profissional, com o estado do aviso. */
export type VagaParaMim = {
  aviso_id: string;
  vaga: JobListing;
  empresa: string;
  /* A marca da empresa. O cartão de vaga não tinha imagem nenhuma, e numa
     cidade pequena "que empresa é essa" pesa tanto quanto o que é a vaga. */
  empresa_foto: string | null;
  criado_em: string;
  visto_em: string | null;
  respondida: boolean;
  /**
   * O que a pessoa respondeu: `true` tem interesse, `false` não tem,
   * `undefined` ainda não respondeu.
   *
   * São três estados e não dois, e é essa a diferença que faltava. Antes
   * havia só `respondida`, e "não quis" ficava indistinguível de "ainda não
   * abriu": a vaga recusada voltava à lista com o mesmo botão pedindo
   * resposta, e a contagem de novas cobrava uma decisão já tomada.
   */
  interessado?: boolean;
};

/**
 * As vagas que chegaram para esta pessoa.
 *
 * É o caminho que funciona SEM push nenhum, e por isso ele existe antes do
 * push: notificação só alcança quem instalou o app e aceitou receber, e no
 * iPhone só quem adicionou à tela de início. Se o aviso fosse só o
 * empurrão, quem não tem push nunca ficaria sabendo de vaga nenhuma — e não
 * teria como saber que está perdendo.
 *
 * Aqui a vaga está guardada. A pessoa abre o app e encontra, com ou sem
 * push. O empurrão serve para ela abrir mais cedo.
 *
 * Erro sobe, nunca vira lista vazia. "Nenhuma vaga para você" e "não
 * consegui ler as vagas" são a mesma tela e coisas opostas — e esta é
 * justamente a tela onde a mentira calada custa o emprego de alguém.
 */
export async function vagasParaMim(userId: string): Promise<VagaParaMim[]> {
  const sb = supabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("job_notifications")
    .select(
      `id, criado_em, visto_em,
       job_listings!inner (
         id, company_id, title, description, profession, specialty,
         required_experience, skills, salary_range_min, salary_range_max,
         available_immediately, work_modality, city, uf, neighborhood,
         anunciada_ate, status, created_at, closed_at,
         companies!inner ( company_name, photo_url )
       )`
    )
    .eq("professional_id", userId)
    /* Vaga fechada some da lista. Uma vaga que já encheu na lista de quem
       procura emprego é pior que lista vazia: a pessoa se anima, responde,
       e não recebe resposta nenhuma. */
    .eq("job_listings.status", "active")
    .order("criado_em", { ascending: false });

  if (error) throw error;

  /* Quais destas a pessoa já respondeu. Uma consulta à parte porque o
     PostgREST não junta `job_responses` por este caminho sem uma relação
     declarada — e forçar isso deixaria a consulta principal frágil a
     qualquer mexida no schema. */
  const ids = (data ?? []).map((n: any) => n.job_listings.id);
  /* A resposta agora tem DUAS: `true` é "tenho interesse", `false` é "não
     tenho". `undefined` é a terceira, e a mais importante de distinguir —
     ainda não respondeu. Um `Set` de "respondidas" não dava conta disso:
     ele misturava o não com o sim, e a tela mostrava as duas iguais. */
  const resposta = new Map<string, boolean>();
  if (ids.length > 0) {
    const { data: r, error: erroResposta } = await sb
      .from("job_responses")
      .select("job_listing_id, interessado")
      .eq("professional_id", userId)
      .in("job_listing_id", ids);
    /* Erro SOBE. Tratar como "não respondeu nenhuma" faria a tela pedir
       resposta de novo para tudo que a pessoa já respondeu — e um segundo
       "tenho interesse" na mesma vaga é constrangimento com a empresa. */
    if (erroResposta) throw erroResposta;
    (r ?? []).forEach((x: any) => resposta.set(x.job_listing_id, x.interessado !== false));
  }

  return (data ?? []).map((n: any) => ({
    aviso_id: n.id,
    vaga: n.job_listings as JobListing,
    empresa: n.job_listings.companies?.company_name ?? "",
    empresa_foto: n.job_listings.companies?.photo_url ?? null,
    criado_em: n.criado_em,
    visto_em: n.visto_em,
    respondida: resposta.has(n.job_listings.id),
    interessado: resposta.get(n.job_listings.id),
  }));
}

/** Quantas vagas chegaram e ainda não foram abertas. Para o aviso no menu. */
export async function quantasVagasNovas(userId: string): Promise<number> {
  const sb = supabase();
  if (!sb) return 0;

  const { count, error } = await sb
    .from("job_notifications")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", userId)
    .is("visto_em", null);

  /* Aqui o erro NÃO sobe: é um numerozinho no menu, e derrubar a navegação
     inteira por causa dele seria trocar um enfeite por uma tela quebrada.
     Zero esconde o aviso, que é o mesmo que não ter novidade. */
  if (error) return 0;
  return count ?? 0;
}

/** Marca que a pessoa abriu o aviso. */
export async function marcarVagaComoVista(avisoId: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;

  await sb
    .from("job_notifications")
    .update({ visto_em: new Date().toISOString() })
    .eq("id", avisoId)
    /* Só marca uma vez: a primeira abertura é a que interessa, e reescrever
       a data a cada visita apagaria "quando ela viu pela primeira vez". */
    .is("visto_em", null);
}

/**
 * A resposta da pessoa ao aviso de compatibilidade: tem interesse, ou não.
 *
 * ── Por que o "não" existe ────────────────────────────────────────────
 *
 * A dona: "a pessoa escolhe se quer estar disponível ou se não tem
 * interesse."
 *
 * Antes só havia o sim, e um botão só. Sem o não, o app não distinguia
 * "ainda não abriu" de "abriu e não quis": a vaga recusada ficava na lista
 * para sempre, com o mesmo botão pedindo resposta, e a contagem de novas
 * cobrava uma decisão que já tinha sido tomada.
 *
 * ── `insert` e `update` separados, e nunca `upsert` ───────────────────
 *
 * O `upsert` do PostgREST é um `insert ... on conflict`, então quem manda
 * passa pela policy de INSERT mesmo estando só trocando o próprio sim por
 * não. É o defeito que já impediu a administração de salvar cadastro de
 * outra pessoa neste mesmo projeto.
 */
export async function responderVaga(
  vagaId: string,
  userId: string,
  interessado: boolean
): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Banco não configurado");

  const { data: jaExiste, error: erroLer } = await sb
    .from("job_responses")
    .select("id")
    .eq("job_listing_id", vagaId)
    .eq("professional_id", userId)
    .maybeSingle();
  if (erroLer) throw erroLer;

  if (jaExiste) {
    /* Só `interessado`. `status` é a triagem da empresa, e a 0078 tem um
       gatilho que recusa a pessoa mexendo nela — mandar daqui derrubaria a
       gravação inteira. */
    const { error } = await sb
      .from("job_responses")
      .update({ interessado })
      .eq("id", (jaExiste as { id: string }).id);
    if (error) throw error;
    return;
  }

  const { error } = await sb.from("job_responses").insert({
    job_listing_id: vagaId,
    professional_id: userId,
    status: "new",
    interessado,
  });
  if (error) throw error;
}
