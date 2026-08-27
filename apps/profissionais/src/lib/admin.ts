import { supabase } from "./supabase";
import { CITIES } from "../types/domain";
import { lerTudo } from "./lerTudo";

/** As cidades que a busca oferece. Fora delas, o cadastro existe e ninguém acha. */
const CIDADES_DO_APP: readonly string[] = CITIES;

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
  /* Em páginas: denúncia que não aparece é denúncia não lida, e o teto de
     linhas cortaria as mais antigas sem dizer nada.

     O `catch` que devolve lista vazia continua aqui de propósito? NÃO —
     ele estava e some: uma lista de denúncias vazia por causa de erro é
     exatamente a mentira calma que este projeto combateu em todo lugar.
     Falhando, a tela mostra o erro. */
  const data = await lerTudo(() =>
    client.from("reports").select("*, professionals(name, suspended)").order("created_at", { ascending: false })
  );
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
 * Tira um cadastro do ar (some da busca/perfil público, mas o dono e admins
 * continuam vendo). `banDocument: true` também bloqueia o CPF/CNPJ do
 * cadastro em `document_bans`, impedindo novo cadastro com o mesmo
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


/** Um cadastro turbinado agora, com a data em que o destaque acaba. */
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
  /* Em páginas: este número decide quantas VAGAS de destaque ainda há
     para vender por categoria. Truncado, ele venderia vaga que não
     existe. */
  const data = await lerTudo(() =>
    client
      .from("professionals")
      .select("id, name, category, city, boosted_until")
      .eq("boosted", true)
      .order("boosted_until", { ascending: true })
  );
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
  const data = await lerTudo(() => client.from("destaque_espera").select("category, city"));
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

/* ------------------------------------------------------------------
   Dinheiro: o que entrou e o que está ativo.

   Duas famílias de número, separadas de propósito porque têm confiança
   diferente:

   - RECEBIDO é dinheiro que de fato entrou, lido de `processed_payments`
     (assinaturas, créditos, patrocínio) e de `banners` (publicidade
     vendida na mão). O valor das assinaturas só passou a ser gravado na
     migration 0047 — antes dela o banco guardava que houve pagamento, mas
     não quanto. Por isso `desde` vem junto: sem essa data, um total baixo
     pareceria queda de faturamento quando é só falta de histórico.

   - RECORRENTE é projeção: quantas assinaturas estão ativas hoje, vezes o
     preço de hoje. Não é o que entrou nem o que vai entrar (alguém pode
     cancelar amanhã) — é quanto elas somam por mês se tudo ficar como
     está.
   ------------------------------------------------------------------ */

export interface ResumoFinanceiro {
  /** Soma real dos pagamentos com valor gravado, em centavos. */
  recebidoCentavos: number;
  /** Quantos pagamentos entraram nessa soma. */
  pagamentos: number;
  /** Pagamentos anteriores à 0047, que existem mas não têm valor. */
  pagamentosSemValor: number;
  /** Data do pagamento mais antigo COM valor — o começo do histórico. */
  desde: string | null;
  /** Recebido por tipo (chaves de SubscriptionType, "credits", "sponsorship"). */
  porTipo: Record<string, number>;
  /** Publicidade já paga e ainda a receber, em centavos (tabela `banners`). */
  bannersRecebidoCentavos: number;
  bannersAReceberCentavos: number;
}

export async function getResumoFinanceiro(): Promise<ResumoFinanceiro> {
  const vazio: ResumoFinanceiro = {
    recebidoCentavos: 0,
    pagamentos: 0,
    pagamentosSemValor: 0,
    desde: null,
    porTipo: {},
    bannersRecebidoCentavos: 0,
    bannersAReceberCentavos: 0,
  };
  const client = supabase();
  if (!client) return vazio;

  /* Em páginas, pelo mesmo motivo — e aqui o estrago seria o maior: o
     total recebido pararia no ducentésimo pagamento e nunca mais subiria,
     sem nada na tela dizendo isso. */
  const [pagos, banners] = await Promise.all([
    lerTudo(() => client.from("processed_payments").select("valor_centavos, tipo, processed_at")),
    lerTudo(() => client.from("banners").select("valor_centavos, pago")),
  ]);

  const resumo = { ...vazio, porTipo: {} as Record<string, number> };

  for (const p of (pagos ?? []) as { valor_centavos: number | null; tipo: string | null; processed_at: string }[]) {
    if (p.valor_centavos === null) {
      resumo.pagamentosSemValor += 1;
      continue;
    }
    resumo.recebidoCentavos += p.valor_centavos;
    resumo.pagamentos += 1;
    const chave = p.tipo ?? "outros";
    resumo.porTipo[chave] = (resumo.porTipo[chave] ?? 0) + p.valor_centavos;
    if (!resumo.desde || p.processed_at < resumo.desde) resumo.desde = p.processed_at;
  }

  for (const b of (banners ?? []) as { valor_centavos: number | null; pago: boolean }[]) {
    if (b.valor_centavos === null) continue;
    if (b.pago) resumo.bannersRecebidoCentavos += b.valor_centavos;
    else resumo.bannersAReceberCentavos += b.valor_centavos;
  }

  return resumo;
}

export interface AssinaturasAtivas {
  /** Quantas assinaturas ativas por tipo. */
  porTipo: Record<string, number>;
  total: number;
  /** Quantas são anuais (não entram na conta mensal do mesmo jeito). */
  anuais: number;
}

export async function getAssinaturasAtivas(): Promise<AssinaturasAtivas> {
  const client = supabase();
  if (!client) return { porTipo: {}, total: 0, anuais: 0 };
  // Em páginas: truncado, o total de assinaturas ativas viraria um número
  // que para de crescer sem avisar.
  const data = await lerTudo(() =>
    client
      .from("subscriptions")
      .select("type, status, billing_cycle, current_period_end")
      .in("status", ["active", "authorized"])
  );

  const agora = Date.now();
  const resultado: AssinaturasAtivas = { porTipo: {}, total: 0, anuais: 0 };
  for (const s of (data ?? []) as {
    type: string;
    billing_cycle: string | null;
    current_period_end: string | null;
  }[]) {
    // "active" no Mercado Pago não quer dizer "vigente hoje": uma assinatura
    // pode estar marcada como ativa e com o período já vencido esperando a
    // rotina diária. Contar essas infla o painel justamente no número que
    // se olha para decidir preço.
    if (s.current_period_end && new Date(s.current_period_end).getTime() < agora) continue;
    resultado.porTipo[s.type] = (resultado.porTipo[s.type] ?? 0) + 1;
    resultado.total += 1;
    if (s.billing_cycle === "annual") resultado.anuais += 1;
  }
  return resultado;
}

export interface ResumoDeCadastros {
  /** Cadastros existentes, contando os que estão fora do ar. */
  cadastros: number;
  /** Pessoas distintas. Uma pessoa pode ter até cinco cadastros. */
  pessoas: number;
  /** Cadastros criados hoje, no fuso do aparelho de quem olha. */
  hoje: number;
  /** Cadastros criados nos últimos sete dias, hoje incluído. */
  semana: number;
  /** Cadastros que existem e não aparecem na busca, com o motivo. */
  foraDoAr: number;
  suspensos: number;
  pausados: number;
  /** Cidade fora da lista do app — some da busca sem ninguém ter pausado nada. */
  cidadeDeFora: number;
  /** Nunca marcaram um serviço: não casam com nenhuma categoria. */
  semServico: number;
}

/**
 * Os números do painel de cadastros.
 *
 * O painel mostrava `pros.length` — o tamanho da lista já carregada, que
 * chega de vinte em vinte. Ou seja: dizia "20 cadastros" para qualquer
 * cidade com mais de vinte, e só crescia se alguém tocasse em "ver mais".
 * Era um número errado no lugar onde se olha justamente para saber se o
 * app está crescendo.
 *
 * Aqui as linhas são contadas no banco, não na tela. Traz só quatro
 * colunas de cada cadastro — o suficiente para todas as contas — porque
 * `count` sozinho não sabe responder "quantas *pessoas*": uma pessoa pode
 * ter cinco cadastros, e a diferença entre 40 cadastros e 12 pessoas é a
 * diferença entre uma cidade que aderiu e uma que não aderiu.
 *
 * "Hoje" é calculado com a data do aparelho de quem está olhando, e não em
 * UTC: às 21h de Itabirito, UTC já virou o dia seguinte, e o painel diria
 * "0 hoje" para quem acabou de ver alguém se cadastrar.
 *
 * Ler a tabela inteira é barato numa cidade e deixa de ser numa dezena
 * delas. Passando de uns poucos milhares de cadastros, estas contas devem
 * virar uma função no banco — o sinal de que a hora chegou é esta consulta
 * começar a demorar.
 */
export async function resumoDeCadastros(): Promise<ResumoDeCadastros> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");

  /* A tabela, e não a view pública: a view esconde suspensos e pausados, e
     são exatamente eles que este resumo precisa contar. Na tabela vale a
     RLS — admin vê tudo, e qualquer outra pessoa recebe zero linha. */
  /* Lido em páginas: o teto de 200 linhas da 0062 vale aqui também, e
     truncado este resumo mostraria "200 cadastros" para sempre. */
  const data = await lerTudo(() =>
    client.from("professionals").select("owner_id, created_at, suspended, paused, city, categories")
  );

  const linhas = (data ?? []) as {
    owner_id: string;
    created_at: string;
    suspended: boolean;
    paused: boolean;
    city: string | null;
    categories: string[] | null;
  }[];

  const inicioDeHoje = new Date();
  inicioDeHoje.setHours(0, 0, 0, 0);
  /* Sete dias contando hoje — "última semana" para quem pergunta é a
     semana que inclui o dia de hoje, não os sete dias anteriores a ontem. */
  const inicioDaSemana = new Date(inicioDeHoje);
  inicioDaSemana.setDate(inicioDaSemana.getDate() - 6);

  const resumo: ResumoDeCadastros = {
    cadastros: linhas.length,
    pessoas: new Set(linhas.map((l) => l.owner_id)).size,
    hoje: 0,
    semana: 0,
    foraDoAr: 0,
    suspensos: 0,
    pausados: 0,
    cidadeDeFora: 0,
    semServico: 0,
  };

  for (const l of linhas) {
    const criado = new Date(l.created_at);
    if (criado >= inicioDeHoje) resumo.hoje += 1;
    if (criado >= inicioDaSemana) resumo.semana += 1;

    /* Um cadastro pode estar fora do ar por mais de um motivo ao mesmo
       tempo. Cada motivo é contado por si, e `foraDoAr` conta cadastros —
       senão a soma dos motivos passaria do total e ninguém entenderia. */
    let some = false;
    if (l.suspended) {
      resumo.suspensos += 1;
      some = true;
    }
    if (l.paused) {
      resumo.pausados += 1;
      some = true;
    }
    if (!l.city || !CIDADES_DO_APP.includes(l.city)) {
      resumo.cidadeDeFora += 1;
      some = true;
    }
    if (!l.categories || l.categories.length === 0) {
      resumo.semServico += 1;
      some = true;
    }
    if (some) resumo.foraDoAr += 1;
  }

  return resumo;
}
