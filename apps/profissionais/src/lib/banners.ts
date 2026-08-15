import { supabase } from "./supabase";
import type { Banner, LocalDeAnuncio, PedidoDeAnuncio, PedidoDeAnuncioStatus } from "../types/domain";

/**
 * Banners de publicidade da tela de anúncios.
 *
 * Já foram a faixa de publicidade no fim da busca. Saíram de lá: a busca é
 * a tela em que a pessoa está resolvendo um problema, e publicidade ali
 * disputa atenção com o motivo pelo qual ela abriu o app. Agora vivem na
 * tela de anúncios, que é onde quem entra já entrou para ver o que a
 * cidade tem — o mesmo anúncio, na tela em que ele é o conteúdo e não a
 * interrupção.
 *
 * Sem recorte por categoria, ao contrário de quando ficavam na busca: ali
 * dava para vender "só para quem procura eletricista" porque havia uma
 * busca em andamento. Aqui não há pergunta nenhuma para casar, e esconder
 * quem pagou porque o campo `categoria` está preenchido seria cobrar por
 * uma exibição que não acontece.
 *
 * A filtragem por período e por "ativo" acontece no banco (ver a policy de
 * leitura na migration 0040), não aqui: se dependesse desta função, quem
 * consultasse a API direto veria campanhas encerradas e futuras — inclusive
 * as de concorrentes.
 */
export async function getBannersDeAnuncios(cidade: string): Promise<Banner[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client
    .from("banners")
    .select("*")
    // Os de boas-vindas têm tela própria e formato próprio (cartão dentro
    // da lista, não faixa); misturá-los aqui os mostraria duas vezes.
    .eq("local", "busca")
    // Banner sem cidade vale para todas; com cidade, só naquela.
    .or(`cidade.is.null,cidade.eq.${cidade}`)
    .order("created_at", { ascending: false });
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

/**
 * Pedidos de anúncio — quem tocou em "Apareça aqui" e deixou o contato.
 *
 * Sem `.select()` depois do insert, de propósito: `INSERT ... RETURNING`
 * exige passar também pela policy de *leitura*, e quem envia o pedido não
 * tem (nem pode ter) permissão de ler a lista de pedidos. Pedir o registro
 * de volta faria o envio falhar para todo mundo que não é admin.
 */
export async function enviarPedidoDeAnuncio(input: {
  nome: string;
  contato: string;
  local: LocalDeAnuncio;
  cidade: string | null;
  mensagem: string | null;
  userId: string | null;
}): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("banner_leads").insert({
    nome: input.nome,
    contato: input.contato,
    local: input.local,
    cidade: input.cidade,
    mensagem: input.mensagem,
    user_id: input.userId,
  });
  if (error) throw error;
}

/** Lista os pedidos, mais novos primeiro — só admin enxerga (policy 0044). */
export async function listarPedidosDeAnuncio(): Promise<PedidoDeAnuncio[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client
    .from("banner_leads")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function atualizarStatusDoPedido(id: string, status: PedidoDeAnuncioStatus): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("banner_leads").update({ status }).eq("id", id);
  if (error) throw error;
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
