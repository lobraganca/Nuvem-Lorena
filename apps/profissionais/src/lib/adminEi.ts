import { supabase } from "./supabase";
import { lerTudo } from "./lerTudo";
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
  comPlano: number;
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
      comPlano: empresas.filter(
        (e) => e.plano && e.plano_ate && new Date(e.plano_ate).getTime() > agora
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
  dias: number
): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");
  const ate = new Date(Date.now() + dias * 86_400_000).toISOString();
  const { error } = await sb
    .from("companies")
    .update({ plano, plano_ate: ate })
    .eq("id", companyId);
  if (error) throw error;
}

/** Desliga o plano. As vagas no ar continuam no ar até vencerem. */
export async function desligarPlano(companyId: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");
  const { error } = await sb
    .from("companies")
    .update({ plano: null, plano_ate: null })
    .eq("id", companyId);
  if (error) throw error;
}
