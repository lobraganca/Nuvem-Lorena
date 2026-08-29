import { supabase } from "./supabase";
import type { JobListing } from "../types/domain";

/** Uma vaga que chegou para este profissional, com o estado do aviso. */
export type VagaParaMim = {
  aviso_id: string;
  vaga: JobListing;
  empresa: string;
  criado_em: string;
  visto_em: string | null;
  respondida: boolean;
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
         companies!inner ( company_name )
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
  const respondidas = new Set<string>();
  if (ids.length > 0) {
    const { data: r } = await sb
      .from("job_responses")
      .select("job_listing_id")
      .eq("professional_id", userId)
      .in("job_listing_id", ids);
    (r ?? []).forEach((x: any) => respondidas.add(x.job_listing_id));
  }

  return (data ?? []).map((n: any) => ({
    aviso_id: n.id,
    vaga: n.job_listings as JobListing,
    empresa: n.job_listings.companies?.company_name ?? "",
    criado_em: n.criado_em,
    visto_em: n.visto_em,
    respondida: respondidas.has(n.job_listings.id),
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

/** Diz à empresa que este profissional tem interesse. */
export async function responderVaga(vagaId: string, userId: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Banco não configurado");

  const { error } = await sb
    .from("job_responses")
    .upsert(
      { job_listing_id: vagaId, professional_id: userId, status: "new" },
      { onConflict: "job_listing_id,professional_id", ignoreDuplicates: true }
    );

  if (error) throw error;
}
