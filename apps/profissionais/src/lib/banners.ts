import { supabase } from "./supabase";
import type { Banner } from "../types/domain";

/**
 * Banners de publicidade.
 *
 * A filtragem por período e por "ativo" acontece no banco (ver a policy de
 * leitura na migration 0040), não aqui: se dependesse desta função, quem
 * consultasse a API direto veria campanhas encerradas e futuras — inclusive
 * as de concorrentes.
 */
export async function getBannersDaBusca(cidade: string, categoria: string): Promise<Banner[]> {
  const client = supabase();
  if (!client) return [];
  let query = client.from("banners").select("*");
  // Banner sem cidade vale para todas; com cidade, só naquela. Mesma ideia
  // para categoria — é o que permite vender "quero aparecer para quem
  // procura eletricista".
  query = query.or(`cidade.is.null,cidade.eq.${cidade}`);
  query = categoria ? query.or(`categoria.is.null,categoria.eq.${categoria}`) : query.is("categoria", null);
  const { data } = await query.order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * Banners da tela de boas-vindas — cartões vendidos dentro da lista "Tem
 * gente boa aqui do lado", não a faixa de publicidade da busca.
 *
 * Sem `categoria`: essa tela é anterior a qualquer busca, ninguém escolheu
 * um serviço ainda. O único recorte que faz sentido ali é a cidade de quem
 * abriu o app.
 */
export async function getBannersBoasVindas(cidade: string): Promise<Banner[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client
    .from("banners")
    .select("*")
    .eq("local", "boas_vindas")
    .or(`cidade.is.null,cidade.eq.${cidade}`)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Todos, inclusive fora do período — só admin enxerga (policy). */
export async function getTodosOsBanners(): Promise<Banner[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client.from("banners").select("*").order("created_at", { ascending: false });
  return data ?? [];
}

export async function salvarBanner(input: Partial<Banner>): Promise<Banner> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { data, error } = await client.from("banners").upsert(input).select().single();
  if (error) throw error;
  return data;
}

export async function apagarBanner(id: string) {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("banners").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Contagens, por função do banco.
 *
 * `void` e sem `await` em quem chama: nenhuma delas pode atrasar a tela nem
 * quebrar nada se falhar — um contador é informação de venda, não parte do
 * que a pessoa veio fazer.
 */
export async function contarExibicao(id: string) {
  const client = supabase();
  if (!client) return;
  await client.rpc("banner_contar_exibicao", { p_id: id });
}

export async function contarClique(id: string) {
  const client = supabase();
  if (!client) return;
  await client.rpc("banner_contar_clique", { p_id: id });
}

/** Envia a imagem do banner para o bucket próprio e devolve o endereço dela. */
export async function enviarImagemDeBanner(arquivo: File): Promise<string> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  if (!arquivo.type.startsWith("image/")) throw new Error("Envie uma imagem.");
  if (arquivo.size > 2 * 1024 * 1024) throw new Error("A imagem precisa ter no máximo 2 MB.");
  const extensao = arquivo.name.split(".").pop()?.toLowerCase() || "jpg";
  const caminho = `${Date.now()}.${extensao}`;
  const { error } = await client.storage.from("banners").upload(caminho, arquivo, { upsert: false });
  if (error) throw error;
  return client.storage.from("banners").getPublicUrl(caminho).data.publicUrl;
}
