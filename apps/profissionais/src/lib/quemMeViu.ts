/**
 * As empresas que abriram o seu cadastro.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "criar opção do candidato ver que a empresa visualizou seu
 * perfil."
 *
 * ── POR QUE ISSO VALE MAIS AQUI DO QUE PARECE ──────────────────────────
 *
 * Quem procura trabalho passa semanas sem sinal nenhum. O cadastro está
 * lá, a vaga chegou, a pessoa respondeu — e daí em diante é silêncio, que
 * ela lê como "não estou servindo para nada". A maioria some do app nesse
 * ponto, e some calada.
 *
 * "A Padaria Pão de Minas abriu seu cadastro ontem" é o primeiro sinal de
 * que o app está funcionando para ela. Não promete emprego nenhum, e não
 * deve — mas responde a pergunta que ela está fazendo.
 *
 * ── UMA LINHA POR EMPRESA, E NÃO POR VISITA ────────────────────────────
 *
 * A 0106 guarda um par (candidato, empresa) e conta as vezes. Sem isso, a
 * lista viraria a mesma padaria repetida quarenta vezes — a mesma pessoa
 * conferindo o cadastro antes de ligar.
 */
import { supabase } from "./supabase";

export type QuemViu = {
  empresa: string;
  foto: string | null;
  empresaId: string;
  quando: string;
  vezes: number;
};

/**
 * Quem viu este cadastro, da visita mais recente para a mais antiga.
 *
 * Erro SOBE. Lista vazia diria "ninguém te viu ainda", que é a notícia
 * mais desanimadora que esta tela pode dar — e dá-la por causa de uma
 * consulta que falhou seria mentir na direção mais cara.
 */
export async function quemViuMeuPerfil(professionalId: string): Promise<QuemViu[]> {
  const sb = supabase();
  /* Sem cliente do Supabase, o erro SOBE — nunca vira lista vazia.
     ─────────────────────────────────────────────────────────────────
     "Nenhum profissional em Itabirito" e "a build subiu sem saber com
     qual banco falar" são a MESMA tela e coisas opostas. Aconteceu em
     31/08: o site passou o dia dizendo que a cidade estava vazia porque
     as variáveis de ambiente não foram assadas na build. Ninguém
     percebeu, porque uma lista vazia não parece defeito.

     Aqui não há nenhum caso legítimo de lista vazia: `!sb` quer dizer
     que o app não tem como falar com banco nenhum. */
  if (!sb) throw new Error("Sem conexão com o banco.");

  /* `companies_public!inner` e não `companies`: a tabela só é legível pelo
     próprio dono (0066), então quem procura trabalho leria ZERO linhas —
     sem erro, só sem resultado — e a lista viria vazia com a visita
     existindo no banco. É o mesmo defeito que a 0100 consertou nas duas
     telas de vaga.

     O `!inner` derruba a visita cuja empresa saiu do ar, e é o certo: um
     cartão com o nome em branco não diz nada a ninguém. */
  const { data, error } = await sb
    .from("profile_views")
    .select("company_id, viewed_at, vezes, companies:companies_public!inner ( company_name, photo_url )")
    .eq("professional_id", professionalId)
    .not("company_id", "is", null)
    .order("viewed_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  return (data ?? []).map((v: any) => ({
    empresaId: v.company_id,
    empresa: v.companies?.company_name ?? "",
    foto: v.companies?.photo_url ?? null,
    quando: v.viewed_at,
    vezes: v.vezes ?? 1,
  }));
}

/**
 * Registra que esta empresa abriu este cadastro.
 *
 * Quem confere tudo é o banco (ver `registrar_visita_perfil`, na 0106): se
 * a empresa é mesmo de quem está chamando, e se a visita repetida deve
 * virar linha nova ou só adiantar o relógio.
 *
 * NUNCA levanta erro. Esta chamada acontece enquanto a empresa abre o
 * cadastro de alguém — e derrubar essa tela porque o registro da visita
 * falhou seria trocar o que a pessoa veio fazer por uma contabilidade que
 * não é dela.
 */
export async function registrarVisita(professionalId: string, companyId: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  try {
    await sb.rpc("registrar_visita_perfil", {
      p_professional_id: professionalId,
      p_company_id: companyId,
    });
  } catch {
    /* silêncio proposital: ver acima */
  }
}
