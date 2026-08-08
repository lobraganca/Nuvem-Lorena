import { supabase } from "./supabase";

/**
 * Apaga a conta de quem está logado, junto com anúncios, avaliações e
 * favoritos.
 *
 * Quem executa é a Edge Function `delete-account`, no servidor: apagar um
 * usuário exige a chave de administração, que nunca pode estar no navegador.
 * O app só manda o token de quem está logado, e a função apaga o dono desse
 * token — ninguém consegue pedir a exclusão da conta de outra pessoa.
 */
export async function excluirMinhaConta(): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");

  const { data, error } = await client.functions.invoke("delete-account", { body: {} });

  if (error) {
    throw new Error(
      "Não foi possível apagar a conta agora. Se o problema continuar, fale com a gente pelo canal de sugestões."
    );
  }
  if (data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }

  // A sessão local ainda existe mesmo depois do usuário sumir do servidor —
  // sem isto, o app continuaria se comportando como logado até a próxima
  // atualização do token.
  await client.auth.signOut();
}
