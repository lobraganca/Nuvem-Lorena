import { supabase } from "./supabase";

export type ReportStatus = "pending" | "reviewed" | "dismissed";

export interface ReportWithProfessional {
  id: string;
  professional_id: string;
  reporter_id: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  professional_name: string | null;
  professional_suspended: boolean;
}

/**
 * Verifica se o usuário é admin lendo a própria linha em `admins`.
 *
 * A leitura depende da policy da migration 0046. Antes dela a tabela tinha
 * RLS ligada e nenhuma policy de select: a consulta voltava vazia mesmo
 * para quem tinha a linha, e o painel dizia "Acesso restrito." para todo
 * mundo — inclusive para quem administra o app.
 *
 * O erro é registrado no console porque durante um bom tempo ele não teve
 * como ser visto: para a tela, "sem permissão" e "não é admin" dão no
 * mesmo (e devem mesmo dar), mas para quem vai descobrir o problema são
 * coisas opostas.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const client = supabase();
  if (!client) return false;
  const { data, error } = await client.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) {
    console.warn("[admin] não foi possível conferir a permissão:", error.message);
    return false;
  }
  return !!data;
}

/** Lista todas as denúncias (mais recentes primeiro) com o nome do profissional denunciado. */
export async function listReports(): Promise<ReportWithProfessional[]> {
  const client = supabase();
  if (!client) return [];
  const { data, error } = await client
    .from("reports")
    .select("*, professionals(name, suspended)")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => {
    const { professionals, ...rest } = row as typeof row & {
      professionals: { name: string; suspended: boolean } | null;
    };
    return {
      ...rest,
      professional_name: professionals?.name ?? null,
      professional_suspended: professionals?.suspended ?? false,
    };
  });
}

export async function updateReportStatus(reportId: string, status: ReportStatus): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client.from("reports").update({ status }).eq("id", reportId);
  if (error) throw error;
}

/**
 * Tira um anúncio do ar (some da busca/perfil público, mas o dono e admins
 * continuam vendo). `banDocument: true` também bloqueia o CPF/CNPJ do
 * anúncio em `document_bans`, impedindo novo cadastro com o mesmo
 * documento. Dispara (best-effort, sem bloquear a suspensão) o e-mail de
 * aviso ao dono via Edge Function `notify-suspension`.
 */
export async function suspendProfessional(
  professionalId: string,
  reason: string,
  banDocument: boolean
): Promise<{ emailSent: boolean }> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");

  const { data: professional, error: profError } = await client
    .from("professionals")
    .select("document")
    .eq("id", professionalId)
    .single();
  if (profError) throw profError;

  const { error } = await client
    .from("professionals")
    .update({ suspended: true, suspended_reason: reason })
    .eq("id", professionalId);
  if (error) throw error;

  if (banDocument && professional?.document) {
    const { error: banError } = await client
      .from("document_bans")
      .upsert({ document: professional.document, reason });
    if (banError) throw banError;
  }

  let emailSent = false;
  try {
    const { data, error: fnError } = await client.functions.invoke("notify-suspension", {
      body: { professionalId, reason },
    });
    emailSent = !fnError && !!data?.sent;
  } catch {
    emailSent = false;
  }

  return { emailSent };
}

export async function reactivateProfessional(professionalId: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");
  const { error } = await client
    .from("professionals")
    .update({ suspended: false, suspended_reason: null })
    .eq("id", professionalId);
  if (error) throw error;
}


/** Um anúncio turbinado agora, com a data em que o destaque acaba. */
export interface DestaqueAtivo {
  id: string;
  name: string;
  category: string;
  city: string;
  boosted_until: string | null;
}

/**
 * Quem está turbinado agora, do que vence primeiro para o que vence por
 * último. A ordem importa: é a fila de quem vai liberar vaga, e é isso que
 * responde "quando eu consigo vender de novo nessa categoria".
 */
export async function getDestaquesAtivos(): Promise<DestaqueAtivo[]> {
  const client = supabase();
  if (!client) return [];
  const { data } = await client
    .from("professionals")
    .select("id, name, category, city, boosted_until")
    .eq("boosted", true)
    .order("boosted_until", { ascending: true });
  const agora = Date.now();
  return ((data ?? []) as DestaqueAtivo[]).filter(
    (d) => !d.boosted_until || new Date(d.boosted_until).getTime() > agora
  );
}

/** Quantas pessoas esperam vaga de destaque, por categoria e cidade. */
export interface DemandaDestaque {
  category: string;
  city: string;
  esperando: number;
}

export async function getDemandaDeDestaque(): Promise<DemandaDestaque[]> {
  const client = supabase();
  if (!client) return [];
  // A policy de admin em `destaque_espera` é o que libera esta leitura; para
  // qualquer outra pessoa, isto volta só com a própria linha.
  const { data } = await client.from("destaque_espera").select("category, city");
  const contagem = new Map<string, DemandaDestaque>();
  for (const linha of (data ?? []) as { category: string; city: string }[]) {
    const chave = `${linha.city}|${linha.category}`;
    const atual = contagem.get(chave);
    if (atual) atual.esperando += 1;
    else contagem.set(chave, { category: linha.category, city: linha.city, esperando: 1 });
  }
  // Mais procurado primeiro: é onde o preço está defasado.
  return [...contagem.values()].sort((a, b) => b.esperando - a.esperando);
}
