import { supabase as getSupabase } from "./supabase";
import type { Company, JobListing, JobDispatch, JobResponse, WaveNumber } from "../types/domain";
import {
  cabeVagaNoPlano,
  categoriasDoMesmoGrupo,
  DIAS_ANUNCIO_VAGA,
} from "../types/domain";
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

/**
 * ═══════════════════════════════════════════════════════════════════════
 * MAIS DE UMA EMPRESA POR CONTA (item 3 das 16, migration 0102)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * A dona: "ter opção de cadastrar mais de uma empresa."
 *
 * Em Itabirito é o caso comum: quem tem a padaria e a lanchonete é a mesma
 * pessoa, com o mesmo telefone. Antes precisaria de dois celulares.
 *
 * ── POR QUE O `upsert` SAIU ───────────────────────────────────────────
 *
 * A gravação era `upsert(company, { onConflict: "owner_id" })`, e ela
 * dependia do `unique` que a 0102 tira. Sem o índice, o PostgREST responde
 * `42P10: there is no unique or exclusion constraint matching the ON
 * CONFLICT specification` e o cadastro de empresa para de funcionar
 * INTEIRO — não só o segundo.
 *
 * No lugar entram as duas operações separadas, que é o que sempre foram:
 * `criarEmpresa` (insert) e `atualizarEmpresa` (update por id). Elas
 * funcionam antes e depois da 0102 — o que a 0102 muda é só se a SEGUNDA
 * empresa é aceita.
 *
 * ── A EMPRESA ESCOLHIDA ───────────────────────────────────────────────
 *
 * Com várias, o app precisa saber em qual a pessoa está trabalhando agora.
 * Isso mora no aparelho (`localStorage`), e não no banco, porque é estado
 * de NAVEGAÇÃO e não do cadastro: a mesma pessoa pode estar com a padaria
 * aberta no celular e a lanchonete no computador, e nenhuma das duas está
 * "errada".
 */

const EMPRESA_ESCOLHIDA = "ei-empresa-escolhida";

/** Todas as empresas desta conta, da mais antiga para a mais nova. */
export async function minhasEmpresas(ownerId: string): Promise<Company[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("companies")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });

  /* Erro SOBE. Devolver lista vazia diria "você não tem empresa nenhuma" a
     quem tem duas — e a tela seguinte manda essa pessoa para o formulário
     de cadastro, por cima do que já existe. É a mesma regra que o
     CLAUDE.md registra: função de dados que falha nunca devolve lista
     vazia. */
  if (error) throw error;
  return (data ?? []) as Company[];
}

/**
 * O que a tela de escolha das empresas precisa saber.
 *
 * ── O PLANO É DA CONTA, E NÃO DE CADA EMPRESA (0107) ──────────────────
 *
 * A dona: "o plano é pelo usuário, então se ele quiser utilizar as vagas
 * em outras empresas cadastradas ele pode."
 *
 * Então são duas coisas diferentes, e por isso o retorno tem duas partes:
 *
 *   · `porEmpresa` — quantas vagas CADA loja tem no ar. É o que vai na
 *     segunda linha do cartão, e é diferente em cada uma;
 *   · `limite` e `abertas` — o teto da CONTA e o total somado entre todas
 *     as lojas. Isso é igual para todas, e por isso aparece uma vez só, no
 *     alto da tela. Repetir "3 de 3" dentro de cada cartão diria que cada
 *     loja tem três, que é justamente o contrário da 0107.
 *
 * A conta do teto é a mesma da função `limite_de_vagas_do_plano` no banco,
 * copiada porque perguntar custaria uma chamada e a resposta sai das linhas
 * de `companies` que esta tela já tem em mãos. Se a regra mudar lá, muda
 * aqui.
 *
 * ── UMA CONSULTA, NÃO UMA POR EMPRESA ─────────────────────────────────
 *
 * Três lojas dariam três idas ao banco no 4G da cidade, e esta é a primeira
 * tela do lado da empresa. `lerTudo` porque a 0062 pôs teto de 200 linhas
 * em toda consulta, e contagem que bate no teto congela sem avisar.
 *
 * Erro SOBE. Cartão dizendo "0 vagas" numa loja que tem três é pior que
 * cartão sem número nenhum.
 */
export type ResumoDasEmpresas = {
  /** Vagas no ar de cada empresa, pela id. */
  porEmpresa: Map<string, number>;
  /** Teto de vagas abertas da CONTA. 0 = sem plano; -1 = sem teto. */
  limite: number;
  /** Vagas no ar somadas em todas as empresas da conta. */
  abertas: number;
};

export async function resumoDasEmpresas(empresas: Company[]): Promise<ResumoDasEmpresas> {
  const porEmpresa = new Map<string, number>();
  for (const e of empresas) porEmpresa.set(e.id, 0);

  /* O plano mais alto EM DIA entre as empresas da conta — e a escolha é
     pelo plano, não pelo teto: o sem teto é `-1`, o MENOR número da lista,
     e pegar o maior teto escolheria justamente o pior plano. */
  const agora = Date.now();
  const forca = { pro: 1, tres: 2, ilimitado: 3 } as const;
  let melhor = 0;
  for (const e of empresas) {
    if (!e.plano || !e.plano_ate || new Date(e.plano_ate).getTime() < agora) continue;
    melhor = Math.max(melhor, forca[e.plano as keyof typeof forca] ?? 0);
  }
  const limite = melhor === 3 ? -1 : melhor === 2 ? 3 : melhor === 1 ? 1 : 0;

  const sb = getSupabase();
  if (!sb || empresas.length === 0) return { porEmpresa, limite, abertas: 0 };

  const vagas = await lerTudo<{ company_id: string; status: string }>(() =>
    sb
      .from("job_listings")
      .select("company_id, status")
      .in("company_id", empresas.map((e) => e.id))
  );

  let abertas = 0;
  for (const v of vagas) {
    if (v.status !== "active") continue;
    abertas += 1;
    porEmpresa.set(v.company_id, (porEmpresa.get(v.company_id) ?? 0) + 1);
  }

  return { porEmpresa, limite, abertas };
}

/** Qual empresa está aberta agora, ou `null` se ainda não escolheu. */
export function idDaEmpresaEscolhida(): string | null {
  try {
    return localStorage.getItem(EMPRESA_ESCOLHIDA);
  } catch {
    return null;
  }
}

export function escolherEmpresa(id: string | null) {
  try {
    if (id) localStorage.setItem(EMPRESA_ESCOLHIDA, id);
    else localStorage.removeItem(EMPRESA_ESCOLHIDA);
  } catch {
    /* segue sem lembrar: a tela de escolha aparece de novo, e isso é o
       pior que acontece */
  }
}

/**
 * A empresa em que a pessoa está trabalhando agora.
 *
 * A escolha guardada vale só se a empresa ainda existir — quem apagou a
 * padaria não pode continuar vendo o painel dela. Com uma empresa só, ela
 * é a escolhida sem ninguém precisar escolher: perguntar "qual das uma?"
 * é um toque a mais para nada.
 */
export async function empresaAtual(ownerId: string): Promise<Company | null> {
  const lista = await minhasEmpresas(ownerId);
  if (lista.length === 0) return null;
  const escolhida = idDaEmpresaEscolhida();
  return lista.find((e) => e.id === escolhida) ?? lista[0];
}

/** Cria uma empresa nova. */
export async function criarEmpresa(
  company: Omit<
    Company,
    | "id"
    | "created_at"
    | "phone_verified"
    | "phone_verified_at"
    | "plano"
    | "plano_ate"
    | "plano_recorrente"
  >
): Promise<Company> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");

  const { data, error } = await sb.from("companies").insert(company).select().single();

  if (error) {
    /* `23505` é o `unique` do owner_id, que só existe ANTES da 0102. A
       mensagem crua do Postgres ("duplicate key value violates unique
       constraint") não diz nada a quem está cadastrando a segunda loja. */
    if ((error as { code?: string }).code === "23505") {
      throw new Error(
        "Ainda não dá para ter duas empresas nesta conta. Falta aplicar uma atualização no banco."
      );
    }
    throw error;
  }
  if (!data) throw new Error("Falha ao criar a empresa");
  return data as Company;
}

/** Atualiza uma empresa que já existe, pelo id dela. */
export async function atualizarEmpresa(
  id: string,
  company: Partial<Company>
): Promise<Company> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");

  /* `update` e não `upsert`.
     ────────────────────────
     O CLAUDE.md registra por quê: o upsert do PostgREST é
     `insert ... on conflict`, então quem manda passa pela policy de
     INSERT mesmo editando linha que já existe — foi o que impedia a
     administração de salvar cadastro de outra pessoa. */
  const { data, error } = await sb
    .from("companies")
    .update(company)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Falha ao salvar a empresa");
  return data as Company;
}

/** Apaga uma empresa. As vagas dela caem junto (cascade da 0067). */
export async function apagarEmpresa(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");
  const { error } = await sb.from("companies").delete().eq("id", id);
  if (error) throw error;
  if (idDaEmpresaEscolhida() === id) escolherEmpresa(null);
}

/**
 * Cria ou atualiza o cadastro de uma empresa.
 *
 * @deprecated Use `criarEmpresa` ou `atualizarEmpresa`. Esta função depende
 * do `unique` em `owner_id` que a 0102 tira, e para de funcionar com ela
 * aplicada (42P10). Fica aqui só enquanto houver chamada antiga.
 */
export async function upsertCompany(
  /* Sem o selo do telefone na assinatura: quem o grava é a função do banco,
     e mandá-lo daqui seria recusado pelo gatilho da 0071 — que é o
     comportamento certo, mas derrubaria o salvamento inteiro do cadastro. */
  company: Omit<
    Company,
    | "id"
    | "created_at"
    | "phone_verified"
    | "phone_verified_at"
    | "plano"
    | "plano_ate"
    | "plano_recorrente"
  >
): Promise<Company> {
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

/* `obterMinhaEmpresa` saiu — 02/09
   ─────────────────────────────────
   Ela lia `companies` com `.single()`, que dá ERRO quando vem mais de uma
   linha. Desde a 0102 a conta pode ter várias empresas, então para quem
   tinha duas ela devolvia `null` — e as duas telas que a chamavam liam
   esse `null` como "esta pessoa não tem empresa" e mandavam para o
   cadastro.

   Foi assim que "Nova vaga" passou a cair na tela de cadastrar empresa
   para quem cadastrou a segunda loja, e o banco de talentos junto. O
   defeito não estava nas telas: estava numa função cujo nome prometia uma
   coisa que deixou de ser verdade.

   Quem quer "a empresa desta pessoa agora" usa `empresaAtual`, que
   respeita a escolhida na tela das empresas.
*/

/** Cria uma vaga de trabalho. */
export async function criarVaga(
  /* `anunciada_ate` entra depois, por `anunciarVaga`: a vaga nasce sem
     anúncio, e o anúncio é consequência de um pagamento. */
  vaga: Omit<JobListing, "id" | "created_at" | "closed_at" | "anunciada_ate">
): Promise<JobListing> {
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

/**
 * Salva as alterações de uma vaga que já existe.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "opção de editar uma vaga feita."
 *
 * Faltava mesmo: dava para publicar, pausar, arquivar e excluir — mas um
 * salário digitado errado ou um horário que mudou obrigavam a ENCERRAR a
 * vaga e publicar outra. Isso custa caro de três jeitos: gasta uma vaga do
 * plano, joga fora a lista de quem já tinha se interessado, e faz a vaga
 * nascer de novo no fim da lista de quem procura.
 *
 * ── O QUE NÃO SE EDITA, E POR QUÊ ─────────────────────────────────────
 *
 * `company_id` não entra: mudar a empresa de uma vaga que já recebeu gente
 * transferiria os interessados para outro dono. `status` também não —
 * pausar, reabrir e arquivar têm cada um a sua função, com as regras de
 * plano que este `update` não confere.
 *
 * O gatilho `job_listings_exige_plano` (0073) deixa passar a edição de uma
 * vaga que já estava ativa, então salvar não esbarra no teto do plano —
 * que é o certo: a vaga já ocupa o lugar dela.
 */
export async function atualizarVaga(
  vagaId: string,
  mudancas: Partial<Omit<JobListing, "id" | "company_id" | "status" | "created_at">>
): Promise<JobListing> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");

  const { data, error } = await sb
    .from("job_listings")
    .update(mudancas)
    .eq("id", vagaId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Não consegui salvar as mudanças da vaga.");

  return data as JobListing;
}

/** Lista vagas ativas da empresa. */
/**
 * As vagas desta empresa, em TODOS os estados.
 *
 * Antes pedia só `status = 'active'`, e o efeito era que arquivar uma vaga
 * a fazia sumir do painel inteiro — junto com a lista de quem se
 * interessou. A tela de arquivar prometia o contrário, por escrito: "quem
 * já respondeu continua nesta lista". A lista continuava mesmo; era o
 * caminho até ela que deixava de existir.
 *
 * A policy de leitura da 0067 sempre deixou a dona ver a própria vaga em
 * qualquer estado. Faltava pedir.
 */
export async function listarMinhasVagas(companyId: string): Promise<JobListing[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("job_listings")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  /* Erro SOBE — 03/09, na varredura.
     ─────────────────────────────────
     Isto devolvia lista vazia, e a tela mostrava "você ainda não publicou
     nenhuma vaga" para uma empresa com três no ar. É a mentira calma que o
     CLAUDE.md registra, e ela custou caro justamente aqui: com as policies
     quebradas para quem tem duas empresas (0109/0111), o erro do banco
     virava uma tela normal e vazia — nada apontava para o defeito. */
  if (error) throw error;
  return data as JobListing[];
}

/**
 * Quantas pessoas responderam cada uma destas vagas.
 *
 * ── Por que a lista da empresa precisa disto ──────────────────────────
 *
 * A dona: "quero que o app seja intuitivo e de fácil para ambas as partes."
 *
 * No painel, cada vaga mostrava título, ofício e data — nada sobre o que
 * aconteceu com ela. A empresa publica três vagas e, para saber se alguém
 * apareceu, tem que abrir uma por uma e voltar. O número de respostas é a
 * única coisa que ela vai ali procurar, e era exatamente o que faltava.
 *
 * ── Uma consulta para todas as vagas, não uma por vaga ────────────────
 *
 * Cinco vagas seriam cinco idas ao banco no 4G da cidade. E `lerTudo` em
 * vez de um `select` simples porque a 0062 pôs teto de 200 linhas em toda
 * consulta: a partir da ducentésima resposta a contagem congelaria, sem
 * nada avisando — é o mesmo defeito que já mordeu o total de pagamentos no
 * painel administrativo.
 *
 * Erro SOBE. Devolver mapa vazio mostraria "0 respostas" em vaga cheia, e
 * a empresa concluiria que ninguém quis o trabalho dela.
 */
export async function contarRespostasDasVagas(
  vagaIds: string[]
): Promise<Map<string, number>> {
  const conta = new Map<string, number>();
  if (vagaIds.length === 0) return conta;

  const sb = getSupabase();
  if (!sb) return conta;

  const linhas = await lerTudo<{ job_listing_id: string }>(() =>
    sb
      .from("job_responses")
      .select("job_listing_id")
      .in("job_listing_id", vagaIds)
      /* Interessados, e não respostas. O painel dizia "3 pessoas
         responderam" contando também quem respondeu que a vaga NÃO era para
         ela — e a empresa abriria esperando três nomes para achar um. */
      .eq("interessado", true)
  );

  for (const l of linhas) {
    conta.set(l.job_listing_id, (conta.get(l.job_listing_id) ?? 0) + 1);
  }
  return conta;
}

/**
 * Todas as pessoas interessadas nas vagas desta empresa, de uma vez.
 *
 * ── Por que o painel precisa disto ────────────────────────────────────
 *
 * A dona: "na tela do empresário ter as vagas que ela disponibilizou e as
 * pessoas que interessaram."
 *
 * O painel mostrava as vagas e o NÚMERO de interessados — "3 pessoas
 * interessadas" — e mais nada. Para ver quem eram, a empresa tinha que
 * abrir vaga por vaga e voltar. Numa cidade em que as pessoas se conhecem,
 * o nome e o rosto são o que ela veio ver: reconhecer alguém decide o
 * telefonema antes de qualquer currículo.
 *
 * Uma consulta para todas as vagas, e não uma por vaga: cinco vagas seriam
 * cinco idas ao banco no 4G. E `lerTudo` porque a 0062 pôs teto de 200
 * linhas em toda consulta — a partir da ducentésima resposta a lista
 * pararia de crescer, sem nada avisando.
 */
export type InteressadoNoPainel = RespostaComPessoa & {
  vagaId: string;
  vagaTitulo: string;
};

export async function interessadosDasVagas(
  vagas: Array<{ id: string; title: string }>
): Promise<InteressadoNoPainel[]> {
  if (vagas.length === 0) return [];

  const sb = getSupabase();
  if (!sb) return [];

  const ids = vagas.map((v) => v.id);
  const respostas = await lerTudo<JobResponse>(() =>
    sb
      .from("job_responses")
      .select("*")
      .in("job_listing_id", ids)
      .eq("interessado", true)
      .order("responded_at", { ascending: false })
  );
  if (respostas.length === 0) return [];

  /* `professional_id` aponta para a CONTA (`auth.users`), e não para a
     linha de `professionals` — por isso são duas consultas casadas por
     `owner_id`, e não um `select` embutido. O PostgREST junta por relação
     declarada, e não existe nenhuma entre essas duas tabelas. */
  const contas = [...new Set(respostas.map((r) => r.professional_id))];
  const { data: pessoas } = await sb
    .from("professionals_public")
    .select("id, owner_id, name, whatsapp, phone, photo_url, neighborhood")
    .in("owner_id", contas);

  const porConta = new Map<string, Record<string, unknown>>();
  for (const p of (pessoas ?? []) as Record<string, unknown>[]) {
    porConta.set(String(p.owner_id), p);
  }
  const tituloDaVaga = new Map(vagas.map((v) => [v.id, v.title]));

  return respostas.map((r) => {
    const pessoa = porConta.get(r.professional_id);
    return {
      ...r,
      vagaId: r.job_listing_id,
      vagaTitulo: tituloDaVaga.get(r.job_listing_id) ?? "",
      cadastroId: pessoa ? String(pessoa.id) : null,
      /* Sem cadastro visível — quem ficou oculto ou não confirmou o
         telefone — a linha continua na lista, porque a pessoa se interessou
         de verdade e sumir com ela seria esconder da empresa alguém que
         levantou a mão. O que muda é que não há para onde tocar. */
      nome: pessoa ? String(pessoa.name ?? "") : "Cadastro fora do ar",
      telefone: pessoa ? ((pessoa.whatsapp as string) ?? (pessoa.phone as string) ?? null) : null,
      foto: pessoa ? ((pessoa.photo_url as string) ?? null) : null,
      bairro: pessoa ? ((pessoa.neighborhood as string) ?? null) : null,
    };
  });
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
  /* ── Uma função do banco, e não mais a view pública ──────────────────
     A dona: "oculto ele recebe oportunidades pelas ondas de disparos."

     A consulta lia `professionals_public`, e essa view filtra
     `paused = false`. Quem se escondia da busca sumia também das ondas — o
     contrário do que a chave da tela promete, com estas palavras: "pode se
     esconder da lista e continuar recebendo vaga".

     Era o defeito mais silencioso que este app já teve. A pessoa se
     esconde para o patrão não ver, acha que continua na fila das
     oportunidades, e nunca recebe uma. Ninguém reclama de vaga que não
     chegou.

     A função da 0077 enxerga quem está pausado, e devolve `id` e
     `owner_id` e MAIS NADA — sem nome, sem telefone. Uma view que
     incluísse os pausados teria de ser legível por alguém, e aí daria para
     LISTAR quem se escondeu: desfazer o esconderijo para consertar o
     esconderijo. O nome, aliás, nunca foi usado — a tela só mostra
     quantas pessoas a onda alcança.

     As outras duas condições continuam: suspenso não recebe, e sem
     telefone confirmado não entra em onda nenhuma — o aviso é uma mensagem
     no número da pessoa, e mandar para um número que ninguém provou ser
     dela é, na melhor hipótese, avisar o vazio. */
  return sb.rpc("candidatos_da_onda", {
    p_cidade: vaga.city,
    /* O estado anda junto com a cidade, sempre: há "Bom Jesus" em mais de
       vinte estados, e filtrar só pelo nome mistura cidades distantes numa
       lista que chega cheia, sem erro nenhum na tela. */
    p_uf: vaga.uf ?? null,
    p_oficios:
      onda === 3
        ? // Ofícios vizinhos: o grupo inteiro da profissão, ela incluída.
          categoriasDoMesmoGrupo(vaga.profession)
        : [vaga.profession],
    p_coluna: coluna,
    /* Onda 1 é a única que olha especialidade — e só quando a vaga pediu
       uma. Vaga sem especialidade não tem como ser mais exata que o ofício,
       então a onda 1 já é a onda 2, e a 2 não terá o que acrescentar. É de
       propósito: melhor uma onda que sobra vazia do que uma que finge
       precisão que não existe.

       Só vale para quem OFERECE o serviço: especialidade é um recorte do
       que a pessoa faz, e quem marcou o ofício como interesse ainda não tem
       recorte nenhum dentro dele. */
    p_especialidade:
      onda === 1 && coluna === "categories" ? (vaga.specialty?.trim() ?? null) : null,
  });
}

/* Sem `name`: a função do banco não devolve nome, de propósito — e a tela
   nunca usou. Ver o comentário em `consultaDaOnda`. */
type AlcancadoPelaOnda = { id: string; owner_id: string };

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
  const pessoas = alvo?.pessoas ?? [];
  const donos = pessoas.map((p) => p.owner_id);

  /* Quantos, destes, têm aparelho que receba aviso.
     ───────────────────────────────────────────────
     A diferença entre `professionals_count` e `podiam_receber` é a verdade
     que a empresa precisa ver: push só alcança quem instalou o app e
     aceitou receber. Guardar só o primeiro número faria a tela vender um
     alcance que não existe — e a empresa descobriria pelo silêncio, que é a
     forma mais cara de descobrir. */
  let podiamReceber: number | null = null;
  if (donos.length > 0) {
    const { data, error } = await sb.rpc("quantos_recebem_push", { p_users: donos });
    /* Erro aqui não derruba o disparo: a vaga sair é mais importante que a
       estatística dela. Fica `null`, e a tela mostra "não sei" em vez de
       zero — que seria dizer que ninguém recebe. */
    if (!error) podiamReceber = Number(data ?? 0);
  }

  const { data, error } = await sb
    .from("job_dispatches")
    .insert([
      {
        job_listing_id: vaga.id,
        wave: onda,
        professionals_count: pessoas.length,
        podiam_receber: podiamReceber,
        status: "sent",
      },
    ])
    .select()
    .single();

  if (error) throw error;

  /* Agora o recado, pessoa por pessoa.
     ──────────────────────────────────
     Isto é o aviso em si. O push é só o empurrão para a pessoa abrir o app;
     quem não tem push ligado encontra a vaga em "vagas para você", porque a
     linha está aqui do mesmo jeito. Sem esta tabela, uma onda seria um
     número no painel da empresa e mais nada — ninguém teria como ficar
     sabendo da vaga.

     `ignoreDuplicates` porque a onda 2 pode alcançar quem a onda 1 já
     alcançou (o desconto entre ondas é da contagem, não uma garantia de
     banco), e a mesma vaga não avisa a mesma pessoa duas vezes. */
  if (pessoas.length > 0) {
    const { error: erroAviso } = await sb.from("job_notifications").upsert(
      pessoas.map((p) => ({
        job_listing_id: vaga.id,
        professional_id: p.owner_id,
        wave: onda,
      })),
      { onConflict: "job_listing_id,professional_id", ignoreDuplicates: true }
    );
    /* Este erro SOBE. Sem as linhas de aviso a onda não avisou ninguém — o
       registro em `job_dispatches` diria "12 pessoas alcançadas" sobre um
       disparo que não alcançou nenhuma. É exatamente o número que mente
       calado, e a empresa gastou uma das duas ondas da vaga nele. */
    if (erroAviso) throw erroAviso;

    /* Empurra a fila agora, para o aviso chegar em minutos e não na próxima
       rotina. É best-effort de propósito: se a função falhar ou demorar, as
       linhas continuam na fila e a chamada seguinte as pega. Esperar por
       ela aqui faria a empresa olhar um botão girando enquanto dezenas de
       notificações saem uma a uma — e um erro no meio pareceria "a vaga não
       foi criada", quando ela já foi. */
    sb.functions.invoke("enviar-avisos-de-vaga").catch(() => {});
  }

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

  /* Erro SOBE. "Nenhuma onda aberta" numa vaga que já disparou duas faria a
     empresa disparar de novo — e a terceira onda é a última que existe. */
  if (error) throw error;
  return data as JobDispatch[];
}

/**
 * Quem se interessou por uma vaga — com NOME, e não só o identificador.
 *
 * A tela mostrava "Profissional ID: 8f3a2b1c…" para cada pessoa
 * interessada. É a lista pela qual a empresa paga o plano inteiro, e ela
 * chegava como uma coluna de códigos: a empresa não tinha como saber quem
 * era, nem como falar com ninguém.
 *
 * O `!inner` na junção é de propósito: quem ficou oculto ou foi suspenso
 * some da `professionals_public`, e sem o `inner` a linha voltaria com o
 * nome nulo — de volta ao código na tela. Some inteira, que é o certo:
 * quem saiu de cena não deve aparecer numa lista de contatos.
 *
 * `status = "new"` saiu do filtro. Ele escondia da empresa todo mundo que
 * ela já tinha marcado como visto — e a lista de quem respondeu não é uma
 * caixa de entrada, é o resultado da vaga.
 */
export type RespostaComPessoa = JobResponse & {
  /** O id do CADASTRO, para abrir o perfil. Diferente de `professional_id`. */
  cadastroId: string | null;
  nome: string;
  telefone: string | null;
  foto: string | null;
  bairro: string | null;
};

/**
 * ── `professional_id` é a CONTA, não o cadastro ───────────────────────
 *
 * A chave estrangeira de `job_responses` aponta para `auth.users`, e não
 * para `professionals`. Isso tem duas consequências, e as duas passaram
 * despercebidas na primeira escrita desta função:
 *
 * 1. Não dá para juntar com `professionals_public` num `select` embutido:
 *    o PostgREST junta por relação declarada, e não existe nenhuma entre
 *    essas duas tabelas. São duas consultas, casadas por `owner_id`.
 * 2. O link do perfil precisa do id do CADASTRO. Passar o id da conta
 *    abriria uma página de "perfil não encontrado" — que é o que a tela
 *    fazia antes de o teste de banco 15 revelar de onde a coluna aponta.
 */
export async function obterRespostasDaVaga(vagaId: string): Promise<RespostaComPessoa[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("job_responses")
    .select("*")
    .eq("job_listing_id", vagaId)
    /* Só quem TEM interesse.
       ──────────────────────
       A dona: "a lista de interessados aparece em um painel para o
       anunciante." Interessados, e não respondentes: desde a 0078 a pessoa
       também pode dizer que a vaga não é para ela, e essa resposta é para o
       app parar de cobrá-la — não para a empresa ligar mesmo assim. */
    .eq("interessado", true)
    .order("responded_at", { ascending: false });

  /* Erro SOBE. "Ninguém se interessou ainda" é a frase mais cara do app
     para se dizer errado: a empresa conclui que o anúncio não funcionou e
     para de pagar. */
  if (error) throw error;
  const respostas = (data ?? []) as JobResponse[];
  if (respostas.length === 0) return [];

  const contas = [...new Set(respostas.map((r) => r.professional_id))];
  const { data: pessoas } = await sb
    .from("professionals_public")
    .select("id, owner_id, name, whatsapp, phone, photo_url, neighborhood")
    .in("owner_id", contas);

  const porConta = new Map<string, Record<string, unknown>>();
  for (const p of (pessoas ?? []) as Record<string, unknown>[]) {
    porConta.set(String(p.owner_id), p);
  }

  return respostas.map((r) => {
    const pessoa = porConta.get(r.professional_id);
    return {
      ...r,
      cadastroId: pessoa ? String(pessoa.id) : null,
      /* Sem cadastro visível — quem ficou oculto ou não confirmou o
         telefone — a linha continua na lista, porque a pessoa respondeu de
         verdade e sumir com ela seria esconder da empresa alguém que
         demonstrou interesse. O que muda é que não há para onde tocar. */
      nome: pessoa ? String(pessoa.name ?? "") : "Cadastro fora do ar",
      telefone: pessoa ? ((pessoa.whatsapp as string) ?? (pessoa.phone as string) ?? null) : null,
      foto: pessoa ? ((pessoa.photo_url as string) ?? null) : null,
      bairro: pessoa ? ((pessoa.neighborhood as string) ?? null) : null,
    };
  });
}

/**
 * Quantas vagas esta empresa já disparou no mês, e quantas ainda cabem.
 *
 * Quem conta é o banco (`vagas_disparadas_no_mes`, migration 0071), não o
 * navegador: um teto conferido só na tela é um teto que não existe, porque
 * a chamada pode ser feita sem passar pela tela. Aqui é para AVISAR antes —
 * a empresa precisa saber que está no último disparo antes de escrever a
 * vaga inteira, não depois.
 *
 * O erro sobe. "Você já usou 0 de 2" quando a consulta falhou seria a
 * mentira mais cara desta tela: a empresa acharia que tem os dois disparos
 * na mão e descobriria o contrário no fim.
 */
/**
 * O plano da empresa: se tem, quantas vagas cabem, e quantas já estão
 * abertas.
 *
 * O plano é a porta da vaga — sem ele a empresa vê e procura os
 * profissionais como qualquer pessoa, mas não publica, não dispara e não
 * recebe interessados. Quem recusa de verdade é o banco (migration 0073);
 * isto aqui é para a tela explicar antes, em vez de deixar a empresa
 * escrever a vaga inteira e esbarrar num erro no fim.
 *
 * `limite` vem do banco: 0 = sem plano ou vencido, -1 = ilimitado.
 */
export async function situacaoDoPlano(
  companyId: string
): Promise<{ limite: number; abertas: number; temPlano: boolean; cabeMais: boolean }> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");

  const [{ data: limite, error: e1 }, { data: ativas, error: e2 }] = await Promise.all([
    sb.rpc("limite_de_vagas_do_plano", { p_company_id: companyId }),
    sb.rpc("vagas_ativas_agora", { p_company_id: companyId }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const lim = Number(limite ?? 0);
  const abertas = Number(ativas ?? 0);
  return {
    limite: lim,
    abertas,
    temPlano: lim !== 0,
    cabeMais: cabeVagaNoPlano(lim, abertas),
  };
}

/** Quantas ondas esta vaga já abriu. O teto é `ONDAS_POR_VAGA`. */
export async function ondasJaAbertas(vagaId: string): Promise<number> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");

  const { count, error } = await sb
    .from("job_dispatches")
    .select("id", { count: "exact", head: true })
    .eq("job_listing_id", vagaId);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Confirma o telefone da empresa.
 *
 * Só chama a função do banco, que é quem confere tudo: se é o dono, se o
 * Auth já confirmou aquele número, e se o número confirmado é o mesmo do
 * cadastro. Nada disso pode ser decidido aqui — o navegador é justamente o
 * lugar onde alguém mexeria para se declarar confirmado.
 */
export async function confirmarTelefoneDaEmpresa(companyId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");

  const { error } = await sb.rpc("confirmar_telefone_empresa", {
    p_company_id: companyId,
  });
  if (error) throw error;
}

/**
 * Põe a vaga na área de anúncios por `DIAS_ANUNCIO_VAGA` dias.
 *
 * A data é calculada aqui e não no banco por ora — quando houver pagamento
 * de verdade, quem grava isto passa a ser a Edge Function que confirma o
 * pagamento, pelo mesmo motivo de sempre: data de validade escrita pelo
 * navegador é data de validade que se estica de graça.
 */
export async function anunciarVaga(vagaId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");

  const ate = new Date();
  ate.setDate(ate.getDate() + DIAS_ANUNCIO_VAGA);

  const { error } = await sb
    .from("job_listings")
    .update({ anunciada_ate: ate.toISOString() })
    .eq("id", vagaId);

  if (error) throw error;
}

/**
 * Arquiva uma vaga. Ela sai do ar e LIBERA uma vaga do plano.
 *
 * Arquivar não é apagar: a vaga continua no painel, na seção das
 * encerradas, com a lista de quem se interessou. É essa lista que a empresa
 * volta a consultar depois de contratar alguém — e ela nunca esteve
 * perdida, só inalcançável, porque o painel pedia apenas as vagas ativas.
 */
export async function arquivarVaga(vagaId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");

  const { error } = await sb
    .from("job_listings")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", vagaId);

  if (error) throw error;
}

/** Nome antigo, mantido para não quebrar tela que ainda o chame. */
export const fecharVaga = arquivarVaga;

/**
 * Pausa uma vaga: ela some de quem procura, mas não é encerrada.
 *
 * ── Pausar não é arquivar, e a diferença importa ──────────────────────
 *
 * A empresa que recebeu gente demais e quer parar de receber por uns dias
 * não quer encerrar o processo — encerrar é o que ela faz quando contratou.
 * Sem a pausa, as duas viravam a mesma coisa, e a única saída para "chega
 * de currículo por ora" era fechar de vez e ter que criar tudo de novo
 * depois.
 *
 * Isto já funcionava no banco desde sempre e ninguém tinha percebido: a
 * coluna aceita o estado e o gatilho da 0073 trata os dois sentidos. O que
 * faltava era a tela.
 *
 * Pausada, a vaga NÃO conta no teto do plano — e é o certo: o plano limita
 * quantas vagas ficam no ar, e pausada não está no ar. Reabrir passa pelo
 * teto de novo, então ninguém acumula vaga escondida para soltar de uma vez.
 */
export async function pausarVaga(vagaId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");

  const { error } = await sb
    .from("job_listings")
    .update({ status: "paused" })
    .eq("id", vagaId);

  if (error) throw error;
}

/**
 * Reabre uma vaga pausada ou arquivada.
 *
 * Aqui o banco pode dizer não, e com razão: reabrir é ocupar de novo uma
 * vaga do plano. Se o plano venceu ou já está cheio, o gatilho da 0073
 * recusa com a mensagem explicando qual das duas coisas é — e essa mensagem
 * é melhor que qualquer texto genérico escrito aqui, por isso o erro sobe
 * como veio.
 */
export async function reabrirVaga(vagaId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");

  const { error } = await sb
    .from("job_listings")
    .update({ status: "active", closed_at: null })
    .eq("id", vagaId);

  if (error) throw error;
}

/**
 * Apaga a vaga de vez, e com ela as respostas e os avisos.
 *
 * É irreversível, e por isso a tela pergunta antes dizendo quantas pessoas
 * interessadas somem junto — sem esse número, "excluir" parece apagar um
 * rascunho, e apaga o trabalho de quem respondeu.
 *
 * Quem quer só tirar do ar deve ARQUIVAR: guarda a lista e libera a vaga do
 * plano do mesmo jeito. Excluir é para quem publicou errado.
 */
export async function excluirVaga(vagaId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Banco não configurado");

  const { error } = await sb.from("job_listings").delete().eq("id", vagaId);
  if (error) throw error;
}

/**
 * Os avisos de quem se candidatou às vagas desta CONTA.
 *
 * ── O pedido ──────────────────────────────────────────────────────────
 *
 * A dona: "toda pessoa que se candidata em uma vaga que você anunciou deve
 * receber uma notificação e essa vai pro painel dos avisos."
 *
 * O painel de avisos existia só do lado de quem procura trabalho — ele
 * lista `job_notifications`, as vagas que a onda levou até a pessoa. Do
 * lado da empresa não havia aviso nenhum: quem se candidatava aparecia
 * DENTRO da vaga, e só. A empresa que não abrisse vaga por vaga não ficava
 * sabendo de ninguém.
 *
 * ── Por que não existe uma tabela de avisos da empresa ────────────────
 *
 * Porque o aviso já está gravado: cada candidatura é uma linha de
 * `job_responses`, com data e com o estado da triagem. Uma tabela nova
 * seria uma segunda cópia do mesmo fato — e, como toda cópia, um dia
 * discorda do original (a pessoa desiste, a linha some, o aviso fica).
 *
 * O "novo" também já existe e não precisou ser inventado: `status = 'new'`
 * é literalmente "chegou e a empresa ainda não leu".
 *
 * Erro SOBE, como em toda leitura deste arquivo. "Ninguém se candidatou" e
 * "não consegui ler" são a mesma tela e coisas opostas — e esta é a tela
 * em que a empresa decide se o anúncio dela está funcionando.
 */
export type AvisoDeCandidatura = {
  id: string;
  vagaId: string;
  vagaTitulo: string;
  cadastroId: string | null;
  nome: string;
  foto: string | null;
  bairro: string | null;
  quando: string;
  novo: boolean;
};

export async function avisosDeCandidatura(ownerId: string): Promise<AvisoDeCandidatura[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const empresas = await minhasEmpresas(ownerId);
  if (empresas.length === 0) return [];

  /* As vagas de TODAS as empresas da conta, não só a escolhida agora.
     Aviso que só aparece quando você está com a empresa certa aberta é
     aviso que não chega — e desde a 0107 o plano é da conta, então as
     empresas são um conjunto só do ponto de vista de quem entrou. */
  const { data: vagas, error: erroVagas } = await sb
    .from("job_listings")
    .select("id, title")
    .in("company_id", empresas.map((e) => e.id));
  if (erroVagas) throw erroVagas;

  const tituloDaVaga = new Map<string, string>();
  for (const v of (vagas ?? []) as Array<{ id: string; title: string }>) {
    tituloDaVaga.set(v.id, v.title);
  }
  if (tituloDaVaga.size === 0) return [];

  /* `lerTudo` porque a 0062 pôs teto de 200 linhas em qualquer consulta:
     a partir da ducentésima candidatura a lista pararia de crescer, sem
     nada avisando. */
  const respostas = await lerTudo<JobResponse>(() =>
    sb
      .from("job_responses")
      .select("*")
      .in("job_listing_id", [...tituloDaVaga.keys()])
      /* Só quem TEM interesse. Desde a 0078 a pessoa também pode dizer que
         a vaga não é para ela, e essa resposta é para o app parar de
         cobrá-la — não é uma candidatura. */
      .eq("interessado", true)
      .order("responded_at", { ascending: false })
  );
  if (respostas.length === 0) return [];

  /* `professional_id` é a CONTA (`auth.users`), não a linha de
     `professionals` — por isso é uma segunda consulta casada por
     `owner_id`, e não um `select` embutido. */
  const contas = [...new Set(respostas.map((r) => r.professional_id))];
  const { data: pessoas } = await sb
    .from("professionals_public")
    .select("id, owner_id, name, photo_url, neighborhood")
    .in("owner_id", contas);

  const porConta = new Map<string, Record<string, unknown>>();
  for (const p of (pessoas ?? []) as Record<string, unknown>[]) {
    porConta.set(String(p.owner_id), p);
  }

  return respostas.map((r) => {
    const pessoa = porConta.get(r.professional_id);
    return {
      id: r.id,
      vagaId: r.job_listing_id,
      vagaTitulo: tituloDaVaga.get(r.job_listing_id) ?? "Vaga",
      cadastroId: pessoa ? String(pessoa.id) : null,
      /* Sem cadastro visível — quem ficou oculto ou não confirmou o
         telefone — a linha fica na lista assim mesmo: a pessoa se
         candidatou de verdade, e sumir com ela seria esconder da empresa
         alguém que levantou a mão. */
      nome: pessoa ? String(pessoa.name ?? "") : "Cadastro fora do ar",
      foto: pessoa ? ((pessoa.photo_url as string) ?? null) : null,
      bairro: pessoa ? ((pessoa.neighborhood as string) ?? null) : null,
      quando: r.responded_at ?? "",
      novo: r.status === "new",
    };
  });
}

/**
 * Marca as candidaturas como lidas pela empresa.
 *
 * `status = 'read'` é da triagem da empresa e quer dizer exatamente isto:
 * chegou e foi visto. Sem esta marcação o selo "Novo" ficaria para sempre
 * em todo mundo, e um selo que nunca sai deixa de querer dizer alguma
 * coisa.
 *
 * Falha em silêncio de propósito: perder a marcação mostra um "Novo" a
 * mais na próxima visita, o que é bem menos grave que derrubar a tela
 * inteira de avisos por causa dela.
 */
export async function marcarCandidaturasComoLidas(ids: string[]): Promise<void> {
  const sb = getSupabase();
  if (!sb || ids.length === 0) return;
  await sb.from("job_responses").update({ status: "read" }).in("id", ids);
}
