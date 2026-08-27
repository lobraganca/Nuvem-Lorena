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
