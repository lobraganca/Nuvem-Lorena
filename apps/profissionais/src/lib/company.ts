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

/** Cria ou atualiza o cadastro de uma empresa. */
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

  if (error) return [];
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

  if (error) return [];
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

/** Fecha uma vaga. */
export async function fecharVaga(vagaId: string): Promise<void> {
  if (!supabase) throw new Error("Banco não configurado");

  const { error } = await supabase
    .from("job_listings")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", vagaId);

  if (error) throw error;
}
