import { supabase } from "./supabase";
import type { Profile } from "../types/domain";

export async function getProfile(userId: string): Promise<Profile | null> {
  const client = supabase();
  if (!client) return null;
  const { data } = await client.from("profiles").select("*").eq("id", userId).single();
  return data ?? null;
}

/* `saveCpf` foi removida.
 *
 * O CPF deixou de ser pedido na migration 0033, mas a função que o grava
 * continuou aqui — sem nenhuma tela chamando, e ainda assim funcionando.
 * Uma porta que ninguém usa continua sendo uma porta: pela política de
 * segurança do banco, o dono do próprio perfil pode gravar o campo, então
 * bastava alguém chamar isto.
 *
 * Guardar dado sem finalidade atual é exatamente o que a LGPD trata como
 * excesso. A coluna sai do banco na migration que acompanha esta mudança;
 * aqui sai o caminho que escrevia nela.
 */

/**
 * Guarda os dados de contato de quem está logado: nome, e-mail, telefone
 * e foto.
 *
 * Existe porque a porta de entrada mudou. Enquanto o login era só pelo
 * Google, nome e foto vinham prontos: o Google os entrega junto com a
 * conta, e o gatilho `handle_new_user` os copia para `profiles`. Ninguém
 * precisava preencher nada, e por isso nunca houve onde preencher.
 *
 * Entrando pelo telefone não vem nada — nem nome, nem foto. A conta nasce
 * anônima e ficava assim para sempre: as avaliações daquela pessoa
 * apareciam como "Usuário do Ei Itabirito", com um "?" no lugar do rosto.
 *
 * E cada porta traz só metade do contato: o Google entrega e-mail e nunca
 * telefone; o SMS entrega telefone e nunca e-mail. Por isso `email` e
 * `phone` também passam por aqui — são colunas de `profiles` desde a
 * migration 0064, alimentadas pela tela que completa o perfil.
 *
 * Isso corrói justamente o que dá valor ao app. Uma avaliação vale pela
 * pessoa que a escreveu; assinada por "Usuário do procurô", ela lê como
 * texto de robô — e quem procura, que veio ler opinião de gente da
 * cidade, desconfia da lista inteira.
 *
 * `update` e não `upsert`: a linha já existe (o gatilho a cria junto com a
 * conta), e o `upsert` do PostgREST é `insert ... on conflict`, então
 * passaria pela policy de INSERT mesmo editando linha existente — que é
 * exatamente o erro que já impediu a administração de salvar cadastro de
 * outra pessoa.
 */
export async function salvarMeuPerfil(
  userId: string,
  dados: {
    full_name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
    phone?: string | null;
  }
): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");
  const { error } = await client.from("profiles").update(dados).eq("id", userId);
  if (error) throw error;
}
