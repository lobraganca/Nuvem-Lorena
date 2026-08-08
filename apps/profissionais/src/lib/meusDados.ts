import { supabase } from "./supabase";

/**
 * Direito de acesso e portabilidade (LGPD, art. 18, II e V): a pessoa baixa
 * tudo o que a plataforma guarda sobre ela, em arquivo legível, sem pedir
 * autorização a ninguém e sem esperar resposta de e-mail.
 *
 * O arquivo é montado no navegador, a partir das mesmas consultas que o app
 * já faz — e é por isso que ele é honesto: o RLS do banco só entrega as
 * linhas da própria pessoa, então o que sai daqui é exatamente o que existe
 * lá dentro, nem mais nem menos.
 */
export async function baixarMeusDados(userId: string, email: string | undefined): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");

  const [perfil, anuncios, avaliacoes, favoritos] = await Promise.all([
    client.from("profiles").select("*").eq("id", userId).maybeSingle(),
    client.from("professionals").select("*").eq("owner_id", userId),
    client.from("reviews").select("*").eq("user_id", userId),
    client.from("favorites").select("*").eq("user_id", userId),
  ]);

  const conteudo = {
    gerado_em: new Date().toISOString(),
    conta: { id: userId, email: email ?? null },
    perfil: perfil.data ?? null,
    meus_anuncios: anuncios.data ?? [],
    minhas_avaliacoes: avaliacoes.data ?? [],
    meus_favoritos: favoritos.data ?? [],
    observacao:
      "Este arquivo contém os dados pessoais guardados pelo Busca Itabirito sobre esta conta. Registros técnicos de acesso, exigidos pelo Marco Civil da Internet, não constam aqui e são guardados por seis meses.",
  };

  const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `meus-dados-busca-itabirito-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  // Sem o revoke, o arquivo fica preso na memória da aba até ela fechar.
  URL.revokeObjectURL(url);
}
