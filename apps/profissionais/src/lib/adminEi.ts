import { supabase } from "./supabase";
import { lerTudo } from "./lerTudo";
import { erroDeColunaDesconhecida, gravarTolerando } from "./colunasNovas";
import { TESTE_GRATIS } from "../types/domain";
import type { Company, JobListing, PlanoEmpresa } from "../types/domain";

/**
 * Os dados do Ei Emprego para o painel de administração.
 *
 * ── Por que um arquivo novo, e não mais funções em `admin.ts` ─────────
 *
 * `admin.ts` é do outro produto: denúncias, destaques, banners, créditos.
 * Nada ali fala de empresa, vaga ou plano. Misturar os dois assuntos num
 * arquivo de 400 linhas é o caminho conhecido para alguém mexer numa
 * consulta de anúncio achando que mexe numa de vaga.
 *
 * ── Quem pode ler isto ───────────────────────────────────────────────
 *
 * Só a conta que está em `admins`, e quem decide é o BANCO (0112), não
 * esta tela. Para qualquer outra conta as consultas voltam vazias — por
 * isso as funções daqui distinguem "vazio" de "falhou": erro SOBE, sempre.
 * Um painel que mostra "0 empresas" porque a permissão caiu é pior que um
 * painel com mensagem de erro.
 *
 * `lerTudo` em todas as listas: a 0062 pôs teto de 200 linhas em qualquer
 * consulta, e é justamente aqui que a contagem passaria do teto sem nada
 * avisando.
 */

export type EmpresaNoPainel = Company & {
  vagasNoAr: number;
  candidaturas: number;
};

export type NumerosDoEi = {
  empresas: number;
  /** Quantas ASSINAM: plano em dia que não é cortesia. */
  comPlano: number;
  /** Quantas estão no teste grátis agora (0123). */
  testando: number;
  vagasNoAr: number;
  vagasTotal: number;
  candidaturas: number;
  vagasNovasNaSemana: number;
  /* ── O NÚMERO QUE PROVA QUE O APP FUNCIONA (0119) ───────────────────
     Todos os outros números aqui medem movimento: quantas empresas,
     quantas vagas, quantas pessoas se interessaram. Movimento é fácil de
     confundir com resultado — lista cheia e ninguém empregado é o
     fracasso silencioso mais fácil de não enxergar.

     `contratacoes` conta as PESSOAS contratadas por vagas que disseram
     que a contratação veio daqui; `vagasQueContrataram`, quantas vagas
     foram essas. Vaga que disse sim sem dizer quantas conta como uma
     pessoa — o sim já é a informação, e descartá-la por falta do número
     jogaria fora a contratação inteira. */
  contratacoes: number;
  vagasQueContrataram: number;
};

/** Empresas, vagas e candidaturas, numa passada só. */
export async function panoramaDoEi(): Promise<{
  numeros: NumerosDoEi;
  empresas: EmpresaNoPainel[];
  vagas: JobListing[];
}> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");

  const empresas = (await lerTudo(() => sb.from("companies").select("*"))) as Company[];
  const vagas = (await lerTudo(() =>
    sb
      .from("job_listings")
      .select("*")
      .order("created_at", { ascending: false })
  )) as JobListing[];
  const respostas = (await lerTudo(() =>
    sb.from("job_responses").select("job_listing_id, interessado")
  )) as { job_listing_id: string; interessado: boolean | null }[];

  const porVaga = new Map<string, number>();
  for (const r of respostas) {
    if (r.interessado === false) continue;
    porVaga.set(r.job_listing_id, (porVaga.get(r.job_listing_id) ?? 0) + 1);
  }

  const noArPorEmpresa = new Map<string, number>();
  const candidaturasPorEmpresa = new Map<string, number>();
  for (const v of vagas) {
    if (v.status === "active") {
      noArPorEmpresa.set(v.company_id, (noArPorEmpresa.get(v.company_id) ?? 0) + 1);
    }
    const q = porVaga.get(v.id) ?? 0;
    if (q) candidaturasPorEmpresa.set(v.company_id, (candidaturasPorEmpresa.get(v.company_id) ?? 0) + q);
  }

  const agora = Date.now();
  const seteDias = agora - 7 * 86_400_000;

  return {
    numeros: {
      empresas: empresas.length,
      /* ── ASSINANTE E QUEM ESTÁ TESTANDO SÃO NÚMEROS DIFERENTES — 0123 ──
         `comPlano` sozinho passaria a somar os testes grátis, e a pergunta
         que a dona faz todo dia ("quantas empresas assinaram?") nasceria
         inflada — justamente no momento em que ela começa a dar teste, e
         justamente por causa disso.

         `plano_cortesia !== true` e não `=== false`: até a 0123 ser
         aplicada a coluna chega indefinida, e indefinido aqui é "não é
         cortesia" — a resposta certa para todo plano que já existia. */
      comPlano: empresas.filter(
        (e) =>
          e.plano &&
          e.plano_ate &&
          new Date(e.plano_ate).getTime() > agora &&
          e.plano_cortesia !== true
      ).length,
      testando: empresas.filter(
        (e) =>
          e.plano &&
          e.plano_ate &&
          new Date(e.plano_ate).getTime() > agora &&
          e.plano_cortesia === true
      ).length,
      vagasNoAr: vagas.filter((v) => v.status === "active").length,
      vagasTotal: vagas.length,
      candidaturas: [...porVaga.values()].reduce((a, b) => a + b, 0),
      vagasNovasNaSemana: vagas.filter((v) => new Date(v.created_at).getTime() >= seteDias).length,
      /* `=== true` e não só o valor: nulo é "não respondeu", e nulo em
         `if` vale falso — mas escrever `=== true` deixa a diferença à
         vista de quem ler isto depois. */
      vagasQueContrataram: vagas.filter((v) => v.contratou_por_aqui === true).length,
      contratacoes: vagas
        .filter((v) => v.contratou_por_aqui === true)
        .reduce((soma, v) => soma + (v.quantos_contratados ?? 1), 0),
    },
    empresas: empresas
      .map((e) => ({
        ...e,
        vagasNoAr: noArPorEmpresa.get(e.id) ?? 0,
        candidaturas: candidaturasPorEmpresa.get(e.id) ?? 0,
      }))
      /* Quem tem vaga no ar primeiro: é sobre essas empresas que a
         administração vai precisar decidir alguma coisa hoje. */
      .sort((a, b) => b.vagasNoAr - a.vagasNoAr || a.company_name.localeCompare(b.company_name, "pt-BR")),
    vagas,
  };
}

/**
 * Liga (ou renova) o plano de uma empresa por um número de dias.
 *
 * ── Por que isto existe ──────────────────────────────────────────────
 *
 * A cobrança ainda não está ligada, então quem liga plano hoje é a dona —
 * e vinha fazendo isso colando SQL no painel do Supabase, uma empresa por
 * vez. Um `update` escrito à mão sem `where`, num dia cansado, liga plano
 * para a cidade inteira.
 *
 * A data de INÍCIO não é escrita aqui de propósito: quem a carimba é o
 * gatilho da 0110, no banco, para ela ser a mesma venha a mudança de onde
 * vier.
 *
 * A validade é contada a partir de AGORA, e não da validade antiga: se
 * fosse somada, uma empresa que parou de pagar por três meses ganharia os
 * três meses de volta ao voltar.
 */
export async function ligarPlano(
  companyId: string,
  plano: PlanoEmpresa,
  dias: number,
  /* Teste grátis, e não assinatura — ver `TESTE_GRATIS` e a 0123. O padrão
     é `false` de propósito: ligar plano continua querendo dizer "esta
     empresa fechou com a gente", que é o caso mais comum e o que a
     contagem de assinantes conta. */
  cortesia = false
): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");
  const ate = new Date(Date.now() + dias * 86_400_000).toISOString();
  /* ── A TOLERÂNCIA VALE PARA O PLANO PAGO, E NÃO PARA O TESTE ────────
     `plano_cortesia` é da 0123 e pode ainda não existir: as migrations são
     aplicadas à mão e o código sobe sozinho. Coluna desconhecida faz o
     PostgREST recusar a gravação INTEIRA, e sem tolerância o dia entre
     subir o código e aplicar a SQL seria um dia sem ligar plano nenhum.

     Só que tolerar tem um preço, e no TESTE o preço é alto demais: a
     gravação passaria sem a marca, o plano ficaria ligado por 5 dias como
     se fosse assinatura, a empresa não veria "teste grátis" na tela dela e
     a contagem de assinantes somaria mais um. A dona acharia que deu um
     teste, e teria dado um plano de graça sem prazo visível para ninguém.

     Isso é uma mentira calma — a tela fica normal e o defeito não aparece
     em lugar nenhum. Então o teste FALHA em voz alta, com a frase que
     resolve, e o plano pago segue tolerando. */
  const campos = { plano, plano_ate: ate, plano_cortesia: cortesia };
  const { error } = cortesia
    ? await sb.from("companies").update(campos).eq("id", companyId)
    : await gravarTolerando(campos, ["plano_cortesia"], (c) =>
        sb.from("companies").update(c).eq("id", companyId)
      );
  if (error) {
    if (cortesia && erroDeColunaDesconhecida(error)) {
      throw new Error(
        "O banco ainda não conhece o teste grátis. Aplique a migration 0123 " +
          "no SQL Editor e tente de novo — sem ela, o plano ligaria como " +
          "assinatura e a empresa não veria que é teste."
      );
    }
    throw error;
  }
}

/**
 * Dá o teste grátis: o plano e os dias que a dona definiu, marcados como
 * cortesia.
 *
 * Função própria, e não um `ligarPlano(..., true)` escrito em cada tela:
 * conceder teste é uma decisão diferente de ligar plano pago, e ter um
 * nome só para ela é o que impede alguém de conceder cortesia sem querer
 * ao mexer num parâmetro.
 */
export async function darTesteGratis(companyId: string): Promise<void> {
  await ligarPlano(companyId, TESTE_GRATIS.plano, TESTE_GRATIS.dias, true);
}

/** Desliga o plano. As vagas no ar continuam no ar até vencerem. */
export async function desligarPlano(companyId: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");
  /* A marca de cortesia sai junto: sem isso, uma empresa que testou e
     depois assinou continuaria contada como teste — e a conta de quem
     paga nasceria errada. */
  const { error } = await gravarTolerando(
    { plano: null, plano_ate: null, plano_cortesia: false },
    ["plano_cortesia"],
    (campos) => sb.from("companies").update(campos).eq("id", companyId)
  );
  if (error) throw error;
}
