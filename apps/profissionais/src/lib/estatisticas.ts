import { supabase } from "./supabase";

export interface EstatisticasPublicas {
  profissionais: number;
  avaliacoes: number;
  visitas: number;
  /** Quantas vezes o app foi aberto (migration 0048). */
  visitasApp: number;
}

const CHAVE_VISITA = "procuro-visita-registrada";

/**
 * Conta uma visita ao app, uma vez por sessão do navegador.
 *
 * A trava é `sessionStorage`: contar a cada tela aberta daria um número que
 * sobe sozinho enquanto a pessoa navega — vaidade, não informação. Uma vez
 * por sessão é o mais perto de "uma pessoa abriu o app" que dá para chegar
 * sem identificar ninguém.
 *
 * Não espera resposta e não quebra nada se falhar: é um contador, e quem
 * abriu o app veio fazer outra coisa.
 */
export async function registrarVisita(): Promise<void> {
  const client = supabase();
  if (!client) return;
  try {
    if (window.sessionStorage.getItem(CHAVE_VISITA)) return;
    window.sessionStorage.setItem(CHAVE_VISITA, "1");
  } catch {
    /* Sem sessionStorage (aba anônima trancada, navegador antigo): conta
       esta abertura e segue. Melhor contar demais aqui do que não contar. */
  }
  await client.from("visitas_app").insert({});
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
  if (!client) return { profissionais: 0, avaliacoes: 0, visitas: 0, visitasApp: 0 };

  const [profissionais, avaliacoes, visitas, visitasApp] = await Promise.all([
    client.from("professionals_public").select("id", { count: "exact", head: true }),
    client.from("reviews").select("id", { count: "exact", head: true }),
    client.rpc("contagem_de_visitas"),
    client.rpc("contagem_de_visitas_no_app"),
  ]);

  return {
    profissionais: profissionais.count ?? 0,
    avaliacoes: avaliacoes.count ?? 0,
    visitas: typeof visitas.data === "number" ? visitas.data : 0,
    visitasApp: typeof visitasApp.data === "number" ? visitasApp.data : 0,
  };
}
