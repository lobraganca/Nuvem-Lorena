// Cancela e, quando a lei manda, reembolsa as assinaturas de um
// profissional no Mercado Pago — extraído de `cancel-subscription` para
// ser chamado de mais de um lugar sem duplicar a conta do arrependimento.
//
// ── POR QUE ISTO PRECISOU SAIR DAQUI E VIRAR COMPARTILHADO ──────────────
//
// A dona: "criar situação para exclusão de conta, reembolso... quero criar
// um sistema sustentavel que não precise da minha intervenção."
//
// A função `cancel-subscription` já fazia tudo isso — CANCELAMENTO E
// REEMBOLSO, com a conta do artigo 49 do CDC — mas só quando a PRÓPRIA
// PESSOA pedia, tocando um botão que não existia em nenhuma tela. E o
// `delete-account` apagava a conta sem cancelar nada no Mercado Pago: a
// pessoa sumia do banco, a cobrança continuava, e o primeiro a saber era
// o extrato do cartão dela — ou a dona, pelo WhatsApp do suporte.
//
// As DUAS chamadas (cancelar pedindo, e cancelar ao apagar a conta)
// precisam do MESMO cálculo de reembolso. Copiado em dois arquivos, um dia
// alguém acerta um bug num e esquece o outro — e a diferença é a lei: art.
// 49 do CDC não perdoa "só nesta tela funciona certo".
export interface ContextoDeCancelamento {
  admin: {
    from: (tabela: string) => any;
  };
  mpAccessToken: string;
}

export interface ResultadoDoCancelamento {
  cancelada: boolean;
  reembolsado: boolean;
  dentroDoArrependimento: boolean;
  erro?: string;
}

const DIAS_ARREPENDIMENTO = 7;

/**
 * Cancela (e reembolsa se dentro do prazo) UMA assinatura já carregada do
 * banco. Não verifica dono — quem chama já confirmou isso antes (o
 * `cancel-subscription` confere contra o usuário logado; o `delete-account`
 * já está lidando com o dono da conta que está sendo apagada).
 */
export async function cancelarUmaAssinatura(
  ctx: ContextoDeCancelamento,
  assinatura: {
    id: string;
    type: string;
    status: string;
    created_at: string;
    mercadopago_subscription_id: string | null;
    professional_id: string;
  }
): Promise<ResultadoDoCancelamento> {
  const { admin, mpAccessToken } = ctx;

  if (assinatura.status === "cancelled") {
    return { cancelada: true, reembolsado: false, dentroDoArrependimento: false };
  }

  const diasDesdeInicio =
    (Date.now() - new Date(assinatura.created_at).getTime()) / (1000 * 60 * 60 * 24);
  const dentroDoArrependimento = diasDesdeInicio <= DIAS_ARREPENDIMENTO;

  // 1. Para de cobrar no Mercado Pago.
  if (assinatura.mercadopago_subscription_id && mpAccessToken) {
    const resposta = await fetch(
      `https://api.mercadopago.com/preapproval/${assinatura.mercadopago_subscription_id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "cancelled" }),
      }
    );
    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error("cancelarUmaAssinatura: Mercado Pago recusou", assinatura.id, detalhe);
      // Nada é gravado: dizer "cancelado" e continuar cobrando é o pior
      // resultado possível para quem pediu — inclusive quando quem pediu
      // foi apagar a própria conta.
      return {
        cancelada: false,
        reembolsado: false,
        dentroDoArrependimento,
        erro: "Não foi possível cancelar no Mercado Pago agora.",
      };
    }
  }

  // 2. Dentro dos 7 dias: devolve o que foi pago.
  let reembolsado = false;
  if (dentroDoArrependimento && mpAccessToken) {
    const { data: pagamentos } = await admin
      .from("processed_payments")
      .select("payment_id")
      .eq("subscription_id", assinatura.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const pagamento = pagamentos?.[0]?.payment_id;
    if (pagamento) {
      const resposta = await fetch(`https://api.mercadopago.com/v1/payments/${pagamento}/refunds`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          "Content-Type": "application/json",
          // Sem isto, uma repetição do pedido devolveria o dinheiro duas
          // vezes — o Mercado Pago usa esta chave para reconhecer o mesmo
          // reembolso.
          "X-Idempotency-Key": `refund-${assinatura.id}`,
        },
      });
      reembolsado = resposta.ok;
      if (!resposta.ok) {
        console.error("cancelarUmaAssinatura: reembolso recusado", assinatura.id, await resposta.text());
      }
    }
  }

  // 3. Estado local. Fora dos 7 dias o benefício continua até a data já
  //    paga: cortar no meio de um mês pago seria ficar com o dinheiro sem
  //    entregar o combinado. (Quando é a própria conta sendo apagada, isso
  //    não importa mais — a linha cai junto no cascata — mas gravamos
  //    mesmo assim: se o cancelamento no MP deu certo e a exclusão falhar
  //    logo depois, a assinatura não pode continuar contando como ativa.)
  await admin
    .from("subscriptions")
    .update({ status: "cancelled", auto_renew: false })
    .eq("id", assinatura.id);

  if (reembolsado) {
    const campos: Record<string, unknown> =
      assinatura.type === "verification"
        ? { verified: false, verified_until: null }
        : assinatura.type === "boost"
          ? { boosted: false, boosted_until: null }
          : { plus_active: false, plus_until: null };
    await admin.from("professionals").update(campos).eq("id", assinatura.professional_id);
  }

  return { cancelada: true, reembolsado, dentroDoArrependimento };
}

/**
 * Cancela TODAS as assinaturas ainda ativas de um profissional — usado
 * pelo `delete-account`, que não recebe um `subscriptionId` (a pessoa está
 * apagando a conta inteira, não uma assinatura específica).
 *
 * Erros aqui são registrados e NÃO impedem a exclusão da conta: entre
 * "a conta não foi apagada porque uma cobrança externa falhou" e "a conta
 * foi apagada e o cancelamento de uma assinatura falhou", o segundo é o
 * menos ruim — e ainda fica no log para alguém tratar à mão, em vez de
 * silencioso. A pessoa continua com o direito ao reembolso mesmo depois de
 * apagada; sem a conta ela pede pelo canal de suporte, com o pagamento já
 * identificado pelo Mercado Pago independente do app.
 */
export async function cancelarAssinaturasDoProfissional(
  ctx: ContextoDeCancelamento,
  professionalId: string
): Promise<ResultadoDoCancelamento[]> {
  const { data: assinaturas } = await ctx.admin
    .from("subscriptions")
    .select("id, type, status, created_at, mercadopago_subscription_id, professional_id")
    .eq("professional_id", professionalId)
    .neq("status", "cancelled");

  const resultados: ResultadoDoCancelamento[] = [];
  for (const assinatura of assinaturas ?? []) {
    try {
      resultados.push(await cancelarUmaAssinatura(ctx, assinatura));
    } catch (err) {
      console.error(
        "cancelarAssinaturasDoProfissional: falha ao cancelar",
        assinatura.id,
        (err as Error)?.message ?? err
      );
      resultados.push({
        cancelada: false,
        reembolsado: false,
        dentroDoArrependimento: false,
        erro: "Erro inesperado ao cancelar.",
      });
    }
  }
  return resultados;
}
