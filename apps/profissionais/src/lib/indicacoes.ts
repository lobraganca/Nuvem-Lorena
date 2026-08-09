import { supabase } from "./supabase";

/**
 * Indicações de quem não foi encontrado.
 *
 * Busca vazia é o momento mais informativo do app e o mais desperdiçado: a
 * pessoa acabou de dizer exatamente o que precisa, não achou, e vai embora.
 * Guardar isso transforma a saída dela em duas coisas — a lista de quem
 * prospectar e o retrato do que a cidade procura sem oferta.
 */
export interface NovaIndicacao {
  servico_buscado?: string | null;
  cidade?: string | null;
  nome_indicado?: string | null;
  contato_indicado?: string | null;
  mensagem?: string | null;
  user_id?: string | null;
}

export async function enviarIndicacao(dados: NovaIndicacao): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");
  const { error } = await client.from("indicacoes").insert({
    servico_buscado: dados.servico_buscado || null,
    cidade: dados.cidade || null,
    nome_indicado: dados.nome_indicado || null,
    contato_indicado: dados.contato_indicado || null,
    mensagem: dados.mensagem || null,
    user_id: dados.user_id || null,
  });
  if (error) throw error;
}

export interface Indicacao extends NovaIndicacao {
  id: string;
  status: "nova" | "contatada" | "descartada";
  created_at: string;
}

/** Só administradoras leem — é lista de contato de terceiros. */
export async function listarIndicacoes(): Promise<Indicacao[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client
    .from("indicacoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as Indicacao[];
}

export async function atualizarStatusIndicacao(
  id: string,
  status: Indicacao["status"]
): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");
  const { error } = await client.from("indicacoes").update({ status }).eq("id", id);
  if (error) throw error;
}
