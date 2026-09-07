import { supabase } from "./supabase";
import { mensagemDeErro } from "./erros";

/**
 * A promoção: 30 dias de 1 vaga grátis, por tempo limitado.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "quero liberar 30 dias de 1 vaga grátis. Escrever que é por
 * tempo limitado."
 *
 * ── QUEM DECIDE É O BANCO, NÃO ESTA TELA ──────────────────────────────
 *
 * Nada aqui grava plano. A promoção é um `security definer` no banco
 * (`ativar_teste_gratis`, migration 0133), e tem de ser: desde a 0123 a
 * empresa NÃO pode escrever as próprias colunas de plano, porque quem
 * pudesse escrevê-las se daria o Ei Infinit sozinho com a chave pública
 * do app.
 *
 * Este arquivo é o mensageiro. Ele pergunta se pode ("a tela mostra o
 * botão?"), pede a ativação, e traduz a resposta para o português da
 * tela. Todas as regras — promoção ligada, uma por conta, a empresa é
 * sua — são conferidas lá dentro, DE NOVO, mesmo depois de esta tela já
 * ter perguntado: entre desenhar o botão e a pessoa tocar nele passam
 * minutos, e a promoção pode acabar no meio.
 *
 * ── "POR TEMPO LIMITADO" TEM DE SER VERDADE ───────────────────────────
 *
 * A frase só se escreve porque existe um interruptor atrás dela: a tabela
 * `ofertas` no banco. A dona desliga com uma linha de SQL, sem publicar
 * código nenhum — que é a única forma de a promoção acabar mesmo. Uma
 * promoção que só termina quando alguém tiver tempo de programar é uma
 * promoção para sempre.
 */

/** Trinta dias, e é o número que aparece na tela. Um lugar só. */
export const DIAS_DO_TESTE_GRATIS = 30;

/**
 * A promoção está de pé para ESTA conta?
 *
 * Devolve `false` quando a migration 0133 ainda não foi aplicada — e
 * avisa no console, em vez de calar. É a mesma leitura de `acessos.ts`:
 * 42883 é o Postgres dizendo que a função não existe, PGRST202 é o
 * PostgREST não a achando.
 *
 * Aqui, ao contrário da regra geral do projeto ("função de dados que
 * falha nunca devolve lista vazia"), o `false` é a resposta certa: o
 * estrago de esconder um botão de promoção é a promoção não aparecer; o
 * de mostrá-lo sem a função existir é a pessoa tocar, receber um erro e
 * achar que o app está quebrado. O aviso no console é o que impede o
 * silêncio de virar mistério.
 */
export async function testeGratisDisponivel(): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;

  const { data, error } = await sb.rpc("teste_gratis_disponivel");
  if (error) {
    const e = error as { code?: string };
    if (e.code === "42883" || e.code === "PGRST202") {
      console.warn(
        "[Ei] a promoção de 30 dias não aparece: falta aplicar a migration 0133."
      );
    } else {
      console.warn("[Ei] não consegui saber se a promoção está de pé:", error);
    }
    return false;
  }
  return data === true;
}

export type ResultadoDoTeste =
  | { ok: true; ate: Date }
  | { ok: false; erro: string };

/**
 * Ativa os 30 dias para uma empresa da própria conta.
 *
 * O banco devolve a data do fim, ou `null` quando recusa. `null` não é
 * erro de conexão: é "não tem direito" — promoção desligada no meio,
 * conta que já usou, empresa de outra pessoa. Por isso o texto de recusa
 * fala do direito, e não de falha, que é o que a pessoa precisa entender.
 */
export async function ativarTesteGratis(companyId: string): Promise<ResultadoDoTeste> {
  const sb = supabase();
  if (!sb) return { ok: false, erro: "Sem conexão com o banco agora." };

  const { data, error } = await sb.rpc("ativar_teste_gratis", { p_company_id: companyId });

  /* `mensagemDeErro` e não `err instanceof Error`: erro do Supabase é
     objeto solto com `message` e `code`, e o `instanceof` cai sempre no
     texto genérico — o padrão que escondeu por semanas o fato de que
     ninguém conseguia avaliar. */
  if (error) {
    return { ok: false, erro: mensagemDeErro(error, "Não consegui ativar agora. Tente de novo.") };
  }
  if (!data) {
    return {
      ok: false,
      erro: "Esta promoção não está mais disponível para a sua conta.",
    };
  }
  return { ok: true, ate: new Date(data as string) };
}

/** "7 de outubro" — como a dona escreveria, não "2026-10-07". */
export function diaPorExtenso(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}
