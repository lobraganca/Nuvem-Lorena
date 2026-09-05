import { supabase } from "./supabase";
import { erroDeColunaDesconhecida } from "./colunasNovas";
import type { JobListing } from "../types/domain";

/**
 * ── DEPOIS DE 15 DIAS O AVISO SOME — 05/09 ────────────────────────────
 *
 * A dona: "os avisos chegam e ficam pra sempre. Colocar uma regra que
 * após 15 dias o aviso some."
 *
 * É um FILTRO na consulta, e não uma faxina que apaga linhas. Duas
 * razões, e a segunda é a que decide:
 *
 *   1. A mesma linha que é "o aviso que chegou para mim" é "quantas
 *      pessoas minha vaga alcançou" do outro lado. Apagar por idade
 *      mudaria, para trás, um número que a empresa já leu.
 *   2. Rotina agendada NÃO RODA neste repositório: o GitHub dispara os
 *      workflows agendados a partir da branch padrão, que está 226 commits
 *      atrás (está no CLAUDE.md). Uma faxina diária seria escrita,
 *      commitada e nunca executada — e todo mundo acharia que a regra
 *      existe.
 *
 * Filtrando, a regra vale a partir do primeiro carregamento e não depende
 * de nada rodar.
 */
export const DIAS_QUE_O_AVISO_DURA = 15;

function desdeQuandoVale(): string {
  const d = new Date();
  d.setDate(d.getDate() - DIAS_QUE_O_AVISO_DURA);
  return d.toISOString();
}

/** Uma vaga que chegou para este profissional, com o estado do aviso. */
export type VagaParaMim = {
  aviso_id: string;
  vaga: JobListing;
  empresa: string;
  /* A marca da empresa. O cartão de vaga não tinha imagem nenhuma, e numa
     cidade pequena "que empresa é essa" pesa tanto quanto o que é a vaga. */
  empresa_foto: string | null;
  criado_em: string;
  visto_em: string | null;
  respondida: boolean;
  /**
   * O que a pessoa respondeu: `true` tem interesse, `false` não tem,
   * `undefined` ainda não respondeu.
   *
   * São três estados e não dois, e é essa a diferença que faltava. Antes
   * havia só `respondida`, e "não quis" ficava indistinguível de "ainda não
   * abriu": a vaga recusada voltava à lista com o mesmo botão pedindo
   * resposta, e a contagem de novas cobrava uma decisão já tomada.
   */
  interessado?: boolean;
};

/**
 * As vagas que chegaram para esta pessoa.
 *
 * É o caminho que funciona SEM push nenhum, e por isso ele existe antes do
 * push: notificação só alcança quem instalou o app e aceitou receber, e no
 * iPhone só quem adicionou à tela de início. Se o aviso fosse só o
 * empurrão, quem não tem push nunca ficaria sabendo de vaga nenhuma — e não
 * teria como saber que está perdendo.
 *
 * Aqui a vaga está guardada. A pessoa abre o app e encontra, com ou sem
 * push. O empurrão serve para ela abrir mais cedo.
 *
 * Erro sobe, nunca vira lista vazia. "Nenhuma vaga para você" e "não
 * consegui ler as vagas" são a mesma tela e coisas opostas — e esta é
 * justamente a tela onde a mentira calada custa o emprego de alguém.
 */
export async function vagasParaMim(userId: string): Promise<VagaParaMim[]> {
  const sb = supabase();
  /* Sem cliente do Supabase, o erro SOBE — nunca vira lista vazia.
     ─────────────────────────────────────────────────────────────────
     "Nenhum profissional em Itabirito" e "a build subiu sem saber com
     qual banco falar" são a MESMA tela e coisas opostas. Aconteceu em
     31/08: o site passou o dia dizendo que a cidade estava vazia porque
     as variáveis de ambiente não foram assadas na build. Ninguém
     percebeu, porque uma lista vazia não parece defeito.

     Aqui não há nenhum caso legítimo de lista vazia: `!sb` quer dizer
     que o app não tem como falar com banco nenhum. */
  if (!sb) throw new Error("Sem conexão com o banco.");

  /* A lista de colunas é escrita à mão, uma a uma. Coluna nova que
     ninguém acrescente aqui chega como indefinida, sem nenhum erro para
     avisar — e o cartão passaria a dizer "Salário não informado" em toda
     vaga. As quatro do fim são da 0080.

     E o comentário fica AQUI FORA: dentro da string ele viraria parte da
     consulta, e o PostgREST recusaria tudo. */
    /* É `companies_public`, e não `companies`, porque a tabela só tem a
       policy de leitura do próprio dono (0066): quem procura trabalho não
       enxerga empresa nenhuma, e o `!inner` derruba a vaga junto — as duas
       telas voltavam ZERO linhas, sem erro. A 0100 criou a view com nome,
       foto e cidade (sem CNPJ nem telefone). O apelido `companies:` mantém
       o nome da chave na resposta. */
  const { data, error } = await sb
    .from("job_notifications")
    .select(
      `id, criado_em, visto_em,
       job_listings!inner (
         id, company_id, title, description, profession, specialty,
         required_experience, skills, salary_range_min, salary_range_max,
         available_immediately, work_modality, city, uf, neighborhood,
         anunciada_ate, status, created_at, closed_at,
         tipo_contrato, jornada, beneficios, salario_a_combinar, salario_periodo,
         companies:companies_public!inner ( company_name, photo_url )
       )`
    )
    .eq("professional_id", userId)
    /* Vaga fechada some da lista. Uma vaga que já encheu na lista de quem
       procura emprego é pior que lista vazia: a pessoa se anima, responde,
       e não recebe resposta nenhuma. */
    .eq("job_listings.status", "active")
    .order("criado_em", { ascending: false });

  if (error) throw error;

  /* Quais destas a pessoa já respondeu. Uma consulta à parte porque o
     PostgREST não junta `job_responses` por este caminho sem uma relação
     declarada — e forçar isso deixaria a consulta principal frágil a
     qualquer mexida no schema. */
  const ids = (data ?? []).map((n: any) => n.job_listings.id);
  /* A resposta agora tem DUAS: `true` é "tenho interesse", `false` é "não
     tenho". `undefined` é a terceira, e a mais importante de distinguir —
     ainda não respondeu. Um `Set` de "respondidas" não dava conta disso:
     ele misturava o não com o sim, e a tela mostrava as duas iguais. */
  const resposta = new Map<string, boolean>();
  if (ids.length > 0) {
    const { data: r, error: erroResposta } = await sb
      .from("job_responses")
      .select("job_listing_id, interessado")
      .eq("professional_id", userId)
      .in("job_listing_id", ids);
    /* Erro SOBE. Tratar como "não respondeu nenhuma" faria a tela pedir
       resposta de novo para tudo que a pessoa já respondeu — e um segundo
       "tenho interesse" na mesma vaga é constrangimento com a empresa. */
    if (erroResposta) throw erroResposta;
    (r ?? []).forEach((x: any) => resposta.set(x.job_listing_id, x.interessado !== false));
  }

  return (data ?? []).map((n: any) => ({
    aviso_id: n.id,
    vaga: n.job_listings as JobListing,
    empresa: n.job_listings.companies?.company_name ?? "",
    empresa_foto: n.job_listings.companies?.photo_url ?? null,
    criado_em: n.criado_em,
    visto_em: n.visto_em,
    respondida: resposta.has(n.job_listings.id),
    interessado: resposta.get(n.job_listings.id),
  }));
}

/**
 * TODOS os avisos que chegaram para esta pessoa — o histórico.
 *
 * ── Como isto é diferente de `vagasParaMim` ───────────────────────────
 *
 * A dona: "na barra, vagas, meu perfil e conta, coloque também as
 * notificações que as pessoas receberem dos disparos."
 *
 * `vagasParaMim` é a lista do que dá para RESPONDER: só vaga aberta, porque
 * uma vaga que já encheu ali é pior que lista vazia — a pessoa se anima,
 * responde, e não recebe resposta nenhuma.
 *
 * Só que essa regra tem um custo que ninguém via: o aviso SOME. A pessoa
 * recebe a notificação no celular, demora dois dias para abrir o app, a
 * empresa já encerrou — e não há nada. Nem a vaga, nem o registro de que
 * ela existiu. Fica parecendo que a notificação foi engano.
 *
 * Aqui está tudo o que chegou, aberto ou não, na ordem em que chegou. É o
 * histórico: o que a pessoa recebeu, o que ela respondeu, e o que aconteceu
 * com cada uma.
 */
export type Aviso = VagaParaMim & {
  /** A vaga ainda está no ar? Encerrada, ela vira histórico e não ação. */
  aberta: boolean;
};

export async function todosOsAvisos(userId: string): Promise<Aviso[]> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");

  const { data, error } = await sb
    .from("job_notifications")
    .select(
      `id, criado_em, visto_em,
       job_listings!inner (
         id, company_id, title, description, profession, specialty,
         required_experience, skills, salary_range_min, salary_range_max,
         available_immediately, work_modality, city, uf, neighborhood,
         anunciada_ate, status, created_at, closed_at,
         tipo_contrato, jornada, beneficios, salario_a_combinar, salario_periodo,
         companies:companies_public!inner ( company_name, photo_url )
       )`
    )
    .eq("professional_id", userId)
    /* Sem filtro de `status`: é justamente o que separa esta consulta da
       outra. Vaga encerrada continua aqui, marcada como encerrada. */
    .gte("criado_em", desdeQuandoVale())
    .is("escondido_em", null)
    .order("criado_em", { ascending: false });

  /* Enquanto a 0122 não for aplicada, `escondido_em` não existe e o
     PostgREST recusa a consulta INTEIRA — a tela de avisos ficaria vazia,
     que é a mentira calma de sempre. Sem a coluna, a lista volta como
     antes: com os 15 dias já valendo (esse filtro é de uma coluna que
     sempre existiu) e sem esconder nada. */
  if (error && erroDeColunaDesconhecida(error)) {
    const { data: d2, error: e2 } = await sb
      .from("job_notifications")
      .select(
        `id, criado_em, visto_em,
         job_listings!inner (
           id, company_id, title, description, profession, specialty,
           required_experience, skills, salary_range_min, salary_range_max,
           available_immediately, work_modality, city, uf, neighborhood,
           anunciada_ate, status, created_at, closed_at,
           tipo_contrato, jornada, beneficios, salario_a_combinar, salario_periodo,
           companies:companies_public!inner ( company_name, photo_url )
         )`
      )
      .eq("professional_id", userId)
      .gte("criado_em", desdeQuandoVale())
      .order("criado_em", { ascending: false });
    if (e2) throw e2;
    return montarAvisos(sb, userId, d2 ?? []);
  }
  if (error) throw error;

  return montarAvisos(sb, userId, data ?? []);
}

/* A segunda metade de `todosOsAvisos`, à parte porque os dois caminhos —
   com e sem a coluna `escondido_em` — terminam do mesmo jeito. */
async function montarAvisos(
  sb: NonNullable<ReturnType<typeof supabase>>,
  userId: string,
  data: any[]
): Promise<Aviso[]> {
  const ids = data.map((n: any) => n.job_listings.id);
  const resposta = new Map<string, boolean>();
  if (ids.length > 0) {
    const { data: r, error: erroResposta } = await sb
      .from("job_responses")
      .select("job_listing_id, interessado")
      .eq("professional_id", userId)
      .in("job_listing_id", ids);
    if (erroResposta) throw erroResposta;
    (r ?? []).forEach((x: any) => resposta.set(x.job_listing_id, x.interessado !== false));
  }

  return data.map((n: any) => ({
    aviso_id: n.id,
    vaga: n.job_listings as JobListing,
    empresa: n.job_listings.companies?.company_name ?? "",
    empresa_foto: n.job_listings.companies?.photo_url ?? null,
    criado_em: n.criado_em,
    visto_em: n.visto_em,
    respondida: resposta.has(n.job_listings.id),
    interessado: resposta.get(n.job_listings.id),
    aberta: n.job_listings.status === "active",
  }));
}

/**
 * Quantas vagas chegaram e ainda não foram abertas. É o número do selo na
 * barra de baixo.
 *
 * Esta função existia desde o começo, com este mesmo comentário — "para o
 * aviso no menu" — e NÃO ERA CHAMADA EM LUGAR NENHUM. O contador estava
 * escrito e o menu que ele servia nunca tinha sido feito.
 */
export async function quantasVagasNovas(userId: string): Promise<number> {
  const sb = supabase();
  if (!sb) return 0;

  const { count, error } = await sb
    .from("job_notifications")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", userId)
    .is("visto_em", null)
    /* O selinho da barra conta o MESMO que a lista mostra. Sem os 15 dias
       aqui, ele diria "3 novos" e a pessoa abriria uma tela sem os três —
       que é a forma mais rápida de o app perder a confiança dela. */
    .gte("criado_em", desdeQuandoVale());

  /* Aqui o erro NÃO sobe: é um numerozinho no menu, e derrubar a navegação
     inteira por causa dele seria trocar um enfeite por uma tela quebrada.
     Zero esconde o aviso, que é o mesmo que não ter novidade. */
  if (error) return 0;
  return count ?? 0;
}

/**
 * Tira o aviso da lista, para sempre.
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "se a pessoa quiser excluir, ter um aviso que esse chamado foi
 * feito por compatibilidade, se a pessoa quer mesmo excluir."
 *
 * ── Esconde, e não apaga ──────────────────────────────────────────────
 *
 * Para quem exclui é exclusão: sai da lista e não volta. Mas a linha fica,
 * porque ela é DUAS coisas — "o aviso que chegou para mim" e "quantas
 * pessoas minha vaga alcançou", do lado da empresa. Apagar faria uma
 * pessoa mexer, sem saber, num número de outra que já foi lido e pago.
 */
export async function esconderAviso(avisoId: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");

  const { error } = await sb
    .from("job_notifications")
    .update({ escondido_em: new Date().toISOString() })
    .eq("id", avisoId);
  if (error) throw error;
}

/** Marca que a pessoa abriu o aviso. */
export async function marcarVagaComoVista(avisoId: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;

  await sb
    .from("job_notifications")
    .update({ visto_em: new Date().toISOString() })
    .eq("id", avisoId)
    /* Só marca uma vez: a primeira abertura é a que interessa, e reescrever
       a data a cada visita apagaria "quando ela viu pela primeira vez". */
    .is("visto_em", null);
}

/**
 * A resposta da pessoa ao aviso de compatibilidade: tem interesse, ou não.
 *
 * ── Por que o "não" existe ────────────────────────────────────────────
 *
 * A dona: "a pessoa escolhe se quer estar disponível ou se não tem
 * interesse."
 *
 * Antes só havia o sim, e um botão só. Sem o não, o app não distinguia
 * "ainda não abriu" de "abriu e não quis": a vaga recusada ficava na lista
 * para sempre, com o mesmo botão pedindo resposta, e a contagem de novas
 * cobrava uma decisão que já tinha sido tomada.
 *
 * ── `insert` e `update` separados, e nunca `upsert` ───────────────────
 *
 * O `upsert` do PostgREST é um `insert ... on conflict`, então quem manda
 * passa pela policy de INSERT mesmo estando só trocando o próprio sim por
 * não. É o defeito que já impediu a administração de salvar cadastro de
 * outra pessoa neste mesmo projeto.
 */
export async function responderVaga(
  vagaId: string,
  userId: string,
  interessado: boolean
): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Banco não configurado");

  /* `order` + `limit(1)` em vez de `maybeSingle()`.
     ───────────────────────────────────────────────
     `maybeSingle()` aceita nenhuma linha, mas ERRA com mais de uma
     (PGRST116) — e o erro chega na tela como "não consegui enviar seu
     interesse", com o botão continuando ali, sem nunca funcionar. A
     unicidade de (vaga, pessoa) existe no banco desde a 0069, então em
     tese não há duas; mas é exatamente a mesma aposta que já quebrou duas
     vezes neste projeto (`obterMinhaEmpresa` e `lerMeuPerfil`), e o preço
     de errar aqui é alguém não conseguir se candidatar a um emprego.

     Encontrado usando o app como cliente exigente: dois toques em "Tenho
     interesse" na mesma vaga. */
  const { data: existentes, error: erroLer } = await sb
    .from("job_responses")
    .select("id")
    .eq("job_listing_id", vagaId)
    .eq("professional_id", userId)
    .order("responded_at", { ascending: true })
    .limit(1);
  if (erroLer) throw erroLer;
  const jaExiste = (existentes ?? [])[0] ?? null;

  if (jaExiste) {
    /* Só `interessado`. `status` é a triagem da empresa, e a 0078 tem um
       gatilho que recusa a pessoa mexendo nela — mandar daqui derrubaria a
       gravação inteira. */
    const { error } = await sb
      .from("job_responses")
      .update({ interessado })
      .eq("id", (jaExiste as { id: string }).id);
    if (error) throw error;
    return;
  }

  const { error } = await sb.from("job_responses").insert({
    job_listing_id: vagaId,
    professional_id: userId,
    status: "new",
    interessado,
  });
  if (error) throw error;
}
