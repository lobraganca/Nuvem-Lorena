import { supabase as getSupabase } from "./supabase";
import type { Company, JobListing, JobDispatch, JobResponse, WaveNumber } from "../types/domain";
import { categoriasDoMesmoGrupo } from "../types/domain";
import { lerTudo } from "./lerTudo";

const supabase = getSupabase();

/** Registra o tipo de usuário (profissional ou empresa) após login/criação de conta. */
export async function registrarTipoDeUsuario(userId: string, tipoDeUsuario: "professional" | "company"): Promise<void> {
  if (!supabase) throw new Error("Banco não configurado");

  const { error } = await supabase
    .from("user_onboarding")
    .upsert({ user_id: userId, user_type: tipoDeUsuario }, { onConflict: "user_id" });

  if (error) throw error;
}

/** Obtém o tipo de usuário registrado. */
export async function obterTipoDeUsuario(userId: string): Promise<"professional" | "company" | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("user_onboarding")
    .select("user_type")
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data?.user_type ?? null;
}

/** Verifica se o onboarding de tipo de usuário foi completado. */
export async function onboardingCompleto(userId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { data, error } = await sb
    .from("user_onboarding")
    .select("completed")
    .eq("user_id", userId)
    .single();

  if (error) return false;
  return data?.completed ?? false;
}

/** Marca o onboarding como completo. */
export async function marcarOnboardingCompleto(userId: string): Promise<void> {
  if (!supabase) throw new Error("Banco não configurado");

  const { error } = await supabase
    .from("user_onboarding")
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) throw error;
}

/** Cria ou atualiza o cadastro de uma empresa. */
export async function upsertCompany(company: Omit<Company, "id" | "created_at">): Promise<Company> {
  if (!supabase) throw new Error("Banco não configurado");

  const { data, error } = await supabase
    .from("companies")
    .upsert(company, { onConflict: "owner_id" })
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Falha ao criar/atualizar empresa");

  return data as Company;
}

/** Obtém a empresa do usuário logado. */
export async function obterMinhaEmpresa(ownerId: string): Promise<Company | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("companies")
    .select("*")
    .eq("owner_id", ownerId)
    .single();

  if (error) return null;
  return data as Company;
}

/** Cria uma vaga de trabalho. */
export async function criarVaga(vaga: Omit<JobListing, "id" | "created_at" | "closed_at">): Promise<JobListing> {
  if (!supabase) throw new Error("Banco não configurado");

  const { data, error } = await supabase
    .from("job_listings")
    .insert([vaga])
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Falha ao criar vaga");

  return data as JobListing;
}

/** Lista vagas ativas da empresa. */
export async function listarMinhasVagas(companyId: string): Promise<JobListing[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("job_listings")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data as JobListing[];
}

/** Obtém detalhes de uma vaga. */
export async function obterVaga(vagaId: string): Promise<JobListing | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("job_listings")
    .select("*")
    .eq("id", vagaId)
    .single();

  if (error) return null;
  return data as JobListing;
}

/**
 * Quem uma onda alcança.
 *
 * Lê a `professionals_public`, que já deixa de fora suspensos e pausados
 * (migration 0053). Ninguém que tirou o próprio cadastro do ar recebe vaga.
 *
 * As três ondas diferem só na largura do filtro de ofício — ver `ONDAS` e o
 * cabeçalho da migration 0068 para o porquê de não haver distância aqui.
 */
function consultaDaOnda(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  vaga: JobListing,
  onda: WaveNumber,
  /* Duas colunas guardam ofício: `categories` é o que a pessoa FAZ,
     `areas_de_interesse` é onde ela ACEITARIA trabalhar. A vaga alcança
     pelas duas.

     São duas consultas, e não um `or` numa string só, porque nome de ofício
     tem espaço, acento e hífen ("Refrigeração e ar-condicionado") — e a
     condição escrita à mão que o `or` exigiria não devolve menos resultado
     quando as aspas erram, derruba a consulta inteira. `contains` e
     `overlaps` são métodos do cliente, que escapam o valor sozinhos. */
  coluna: "categories" | "areas_de_interesse"
) {
  let q = sb
    .from("professionals_public")
    .select("id, owner_id, name, categories, areas_de_interesse, especialidade")
    .eq("city", vaga.city)
    /* Sem telefone confirmado, ninguém entra em onda nenhuma.
       O aviso da vaga é uma mensagem no número da pessoa: mandar para um
       número que ninguém provou ser dela é, na melhor hipótese, avisar o
       vazio — e na pior, avisar um estranho. A view pública já deixa de
       fora quem está pausado ou suspenso (migration 0053); esta linha
       acrescenta a terceira condição para ser alcançável.

       Quem se cadastrou e não confirmou fica invisível para as vagas, e
       isso é grave o bastante para a pessoa PRECISAR saber — o cartão do
       painel avisa, com o botão de confirmar do lado. Cadastro que não
       recebe nada e não explica por quê é o defeito mais caro que existe:
       ninguém reclama, todo mundo some. */
    .eq("whatsapp_verified", true);

  /* O estado anda junto com a cidade, sempre: há "Bom Jesus" em mais de
     vinte estados, e filtrar só pelo nome mistura cidades distantes numa
     lista que chega cheia, sem erro nenhum na tela. */
  if (vaga.uf) q = q.eq("uf", vaga.uf);

  if (onda === 3) {
    // Ofícios vizinhos: o grupo inteiro da profissão, ela incluída.
    q = q.overlaps(coluna, categoriasDoMesmoGrupo(vaga.profession));
  } else {
    q = q.contains(coluna, [vaga.profession]);
  }

  /* Onda 1 é a única que olha especialidade — e só quando a vaga pediu uma.
     Vaga sem especialidade não tem como ser mais exata que o ofício, então
     a onda 1 já é a onda 2, e a 2 não terá o que acrescentar. É de
     propósito: melhor uma onda que sobra vazia do que uma que finge
     precisão que não existe.

     Só vale para quem OFERECE o serviço: especialidade é um recorte do que
     a pessoa faz, e quem marcou o ofício como interesse ainda não tem
     recorte nenhum dentro dele. */
  if (onda === 1 && coluna === "categories" && vaga.specialty?.trim()) {
    q = q.ilike("especialidade", `%${vaga.specialty.trim()}%`);
  }

  return q;
}

type AlcancadoPelaOnda = { id: string; owner_id: string; name: string };

/**
 * Quantas pessoas cada onda alcançaria, sem avisar ninguém.
 *
 * É o que a tela mostra antes de a empresa confirmar. As ondas são
 * cumulativas por construção (quem está na 1 está na 2), então o número de
 * cada uma é descontado das anteriores — senão a tela diria "12, 30, 45"
 * para 45 pessoas no total, e quem lê entenderia 87.
 *
 * `lerTudo` e não `select` direto: a migration 0062 pôs teto de 200 linhas
 * por consulta, e ele vale para toda consulta. Uma contagem que bate no
 * teto para de subir para sempre, sem erro, sem aviso — e um número que
 * mente calado é o defeito mais caro deste projeto.
 */
export async function calcularOndas(
  vaga: JobListing
): Promise<Array<{ onda: WaveNumber; novos: number; pessoas: AlcancadoPelaOnda[] }>> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");

  const jaAlcancados = new Set<string>();
  const resultado: Array<{ onda: WaveNumber; novos: number; pessoas: AlcancadoPelaOnda[] }> = [];

  for (const onda of [1, 2, 3] as WaveNumber[]) {
    /* Uma consulta por coluna (o que faz / onde aceitaria trabalhar), e a
       união feita aqui. Quem marcou as duas aparece nas duas listas e é
       contado uma vez só — o `Set` abaixo resolve isso junto com a
       sobreposição entre ondas. */
    const [oferece, aceitaria] = await Promise.all([
      lerTudo<AlcancadoPelaOnda>(() => consultaDaOnda(sb, vaga, onda, "categories")),
      lerTudo<AlcancadoPelaOnda>(() => consultaDaOnda(sb, vaga, onda, "areas_de_interesse")),
    ]);

    const novas: AlcancadoPelaOnda[] = [];
    for (const p of [...oferece, ...aceitaria]) {
      if (jaAlcancados.has(p.id)) continue;
      jaAlcancados.add(p.id);
      novas.push(p);
    }

    resultado.push({ onda, novos: novas.length, pessoas: novas });
  }

  return resultado;
}

/**
 * Abre UMA onda — a que a empresa pediu no botão.
 *
 * Não existe disparo automático neste app, e é decisão de produto: a
 * empresa que já achou gente não incomoda mais ninguém, e ninguém é
 * acordado por um agendamento de madrugada.
 *
 * O `unique (job_listing_id, wave)` do banco é quem garante que dois toques
 * no botão não avisem as mesmas pessoas duas vezes — a conferência aqui
 * embaixo é conveniência de tela, a garantia é lá.
 */
export async function abrirOnda(vaga: JobListing, onda: WaveNumber): Promise<JobDispatch> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");

  const ondas = await calcularOndas(vaga);
  const alvo = ondas.find((o) => o.onda === onda);

  const { data, error } = await sb
    .from("job_dispatches")
    .insert([
      {
        job_listing_id: vaga.id,
        wave: onda,
        professionals_count: alvo?.novos ?? 0,
        status: "sent",
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as JobDispatch;
}

/** Obtém o status das ondas de uma vaga. */
export async function obterOndasDaVaga(vagaId: string): Promise<JobDispatch[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("job_dispatches")
    .select("*")
    .eq("job_listing_id", vagaId)
    .order("wave", { ascending: true });

  if (error) return [];
  return data as JobDispatch[];
}

/** Obtém respostas (profissionais interessados) de uma vaga. */
export async function obterRespostasDaVaga(vagaId: string): Promise<JobResponse[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("job_responses")
    .select("*")
    .eq("job_listing_id", vagaId)
    .eq("status", "new")
    .order("responded_at", { ascending: false });

  if (error) return [];
  return data as JobResponse[];
}

/** Fecha uma vaga. */
export async function fecharVaga(vagaId: string): Promise<void> {
  if (!supabase) throw new Error("Banco não configurado");

  const { error } = await supabase
    .from("job_listings")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", vagaId);

  if (error) throw error;
}
