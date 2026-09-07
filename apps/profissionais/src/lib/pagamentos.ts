import { supabase } from "./supabase";
import type { PlanoEmpresa } from "../types/domain";

/**
 * A cobrança pelo site — o lado da tela.
 *
 * As três peças de verdade rodam no servidor (Edge Functions): elas é que
 * sabem o preço, o token do Mercado Pago e quem é dono do quê. Daqui só sai
 * a INTENÇÃO — "quero o plano dez, todo mês" — e volta um endereço para
 * onde mandar a pessoa.
 *
 * O que este arquivo NÃO faz, e não pode passar a fazer:
 *
 *   · não manda valor nenhum. Preço que sai do navegador é preço que
 *     qualquer um edita antes de sair;
 *   · não manda id de empresa nem de cadastro. O servidor descobre pelo
 *     dono, a partir do token de quem está logado. Mandar o id daqui seria
 *     deixar alguém pagar um centavo e ligar o plano na empresa alheia.
 *
 * ── A PEGADINHA DO `functions.invoke` ─────────────────────────────────
 *
 * Quando a function responde erro (400, 409, 503...), o `invoke` devolve um
 * `error` genérico e JOGA FORA o corpo da resposta — que é justamente onde
 * está a frase que resolve ("Cadastre sua empresa antes de assinar",
 * "Você já tem uma assinatura ativa").
 *
 * O corpo continua alcançável em `error.context`, que é a resposta HTTP
 * crua. Sem `mensagemDaFunction` abaixo, toda recusa viraria "não consegui
 * agora, tente de novo" — e a pessoa tentaria de novo, para sempre, sem
 * nunca saber que faltava cadastrar a empresa.
 */

/** O que sai de uma das duas funções que abrem pagamento. */
type Aberto = { pedidoId: string; url: string };

async function mensagemDaFunction(erro: unknown, padrao: string): Promise<string> {
  const contexto = (erro as { context?: Response })?.context;
  if (contexto && typeof contexto.json === "function") {
    try {
      const corpo = await contexto.json();
      if (corpo && typeof corpo.error === "string" && corpo.error.trim()) {
        return corpo.error;
      }
    } catch {
      /* resposta sem JSON — segue com a frase padrão */
    }
  }
  return padrao;
}

async function chamar(nome: string, corpo: Record<string, unknown>): Promise<Aberto> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");

  const { data, error } = await client.functions.invoke(nome, { body: corpo });

  if (error) {
    throw new Error(
      await mensagemDaFunction(error, "Não consegui abrir o pagamento agora. Tente de novo.")
    );
  }
  const resposta = data as Partial<Aberto> | null;
  if (!resposta?.url) {
    throw new Error("O pagamento não abriu. Tente de novo em alguns minutos.");
  }
  return { pedidoId: String(resposta.pedidoId ?? ""), url: resposta.url };
}

/** Uma vez só: Pix, boleto ou cartão, 30 dias de plano. */
export function pagarPlanoUmaVez(plano: PlanoEmpresa): Promise<Aberto> {
  return chamar("criar-pagamento", { tipo: "plano_empresa", plano });
}

/**
 * Todo mês, no cartão, renovando sozinho.
 *
 * Só cartão — é limitação do Mercado Pago, não escolha nossa. Quem não tem
 * cartão continua tendo o caminho de cima, e a tela diz isso.
 */
export function assinarPlano(plano: PlanoEmpresa): Promise<Aberto> {
  return chamar("criar-assinatura", { plano });
}

/** O destaque de quem procura emprego: 7 dias no topo. */
export function pagarDestaque(): Promise<Aberto> {
  return chamar("criar-pagamento", { tipo: "destaque_profissional" });
}

/**
 * Desliga a renovação automática.
 *
 * NÃO tira o plano na hora, e a tela precisa dizer isso: quem cancela dia
 * 20 já pagou até o dia 30. Por isso a resposta traz `valeAte` — é a data
 * que a pessoa quer ver depois de tocar no botão, e sem ela o cancelamento
 * parece ter apagado o que ela pagou.
 */
export async function cancelarAssinatura(): Promise<{ valeAte: string | null }> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");

  const { data, error } = await client.functions.invoke("cancelar-assinatura-ei", { body: {} });

  if (error) {
    throw new Error(
      await mensagemDaFunction(
        error,
        "Não consegui cancelar agora. Tente de novo em alguns minutos — e, se continuar, fale com a gente."
      )
    );
  }
  const resposta = data as { cancelada?: boolean; valeAte?: string | null } | null;
  /* Sem `cancelada: true` o cancelamento NÃO aconteceu, mesmo sem erro.
     Dizer "cancelado" com a cobrança viva no Mercado Pago é o pior erro
     possível desta tela: a pessoa para de acompanhar e o cartão continua
     sendo debitado. */
  if (!resposta?.cancelada) {
    throw new Error("Não consegui confirmar o cancelamento. Fale com a gente para conferirmos.");
  }
  return { valeAte: resposta.valeAte ?? null };
}

/**
 * Leva a pessoa para a tela do Mercado Pago.
 *
 * `location.href` e não `window.open`: no celular, `open` cai no bloqueio
 * de pop-up quando a chamada acontece DEPOIS de uma espera pela rede — que
 * é exatamente o caso aqui, porque o endereço só existe depois de o
 * servidor responder. O bloqueio é silencioso: o botão pisca e nada
 * acontece.
 */
export function irParaOPagamento(url: string): void {
  window.location.href = url;
}
