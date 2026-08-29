import { supabase as getSupabase } from "./supabase";
import type { Company, JobListing, JobDispatch, JobResponse, UserOnboarding } from "../types/domain";
import { mensagemDeErro } from "./erros";

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

/** Busca profissionais locais compatíveis com a vaga (sem disparar). */
export async function buscarProfissionaisComFiltrosLocais(
  jobListing: JobListing
): Promise<Array<{ professional: any; distancia: number; compatibilidade: number }>> {
  if (!supabase) return [];

  /* Esta é uma busca MOCK — sem banco real, não há dados.
     Quando o banco estiver pronto, esta função fará uma query real
     que:
     1. Filtra professionals.city = jobListing.city
     2. Filtra por profession/category match
     3. Calcula compatibilidade por skills, experience, etc
     4. Calcula distância aproximada
     5. Retorna resultados ordenados
  */

  return [];
}

/** Cria as 3 ondas automáticas ao disparar uma vaga. */
export async function dispararVagaComOndas(vagaId: string): Promise<{ ondas: JobDispatch[] }> {
  if (!supabase) throw new Error("Banco não configurado");

  /* MOCK: Quando o banco estiver pronto:
     1. Busca profissionais compatíveis (onda 1: maior compatibilidade + menor distância)
     2. Cria 3 registros em job_dispatches com wave 1, 2, 3
     3. Retorna as ondas criadas

     Por enquanto, retorna ondas vazias. */

  return { ondas: [] };
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
