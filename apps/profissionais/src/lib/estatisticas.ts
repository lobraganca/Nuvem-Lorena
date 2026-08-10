import { supabase } from "./supabase";

export interface EstatisticasPublicas {
  profissionais: number;
  avaliacoes: number;
  visitas: number;
}

/**
 * Números reais para a tela de boas-vindas.
 *
 * Profissionais e avaliações vêm de tabelas/views já de leitura pública —
 * contagem direta, sem função nenhuma. Visitas é a exceção: `profile_views`
 * só é legível pelo dono de cada anúncio, então o total soma pela function
 * `contagem_de_visitas` (ver migration 0042), que devolve um número só, sem
 * apontar para nenhum anúncio.
 *
 * Sem banco configurado, ou se qualquer contagem falhar, devolve zero nela —
 * a tela decide se mostra ou esconde, não esta função.
 */
export async function getEstatisticasPublicas(): Promise<EstatisticasPublicas> {
  const client = supabase();
  if (!client) return { profissionais: 0, avaliacoes: 0, visitas: 0 };

  const [profissionais, avaliacoes, visitas] = await Promise.all([
    client.from("professionals_public").select("id", { count: "exact", head: true }),
    client.from("reviews").select("id", { count: "exact", head: true }),
    client.rpc("contagem_de_visitas"),
  ]);

  return {
    profissionais: profissionais.count ?? 0,
    avaliacoes: avaliacoes.count ?? 0,
    visitas: typeof visitas.data === "number" ? visitas.data : 0,
  };
}
