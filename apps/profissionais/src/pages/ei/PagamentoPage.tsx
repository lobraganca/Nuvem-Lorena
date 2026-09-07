import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { supabase } from "../../lib/supabase";
import { SUPORTE_WHATSAPP } from "../../config";

/**
 * A volta do Mercado Pago.
 *
 * ── POR QUE ESTA TELA PRECISA EXISTIR ─────────────────────────────────
 *
 * Porque o endereço dela está escrito dentro da cobrança, no `back_urls`
 * das Edge Functions. Sem a tela, quem acabou de PAGAR volta para um "não
 * encontrado" — e a primeira coisa que a empresa faz é ligar reclamando de
 * um dinheiro que, do lado dela, sumiu.
 *
 * ── O QUE ELA NÃO PODE FAZER: ACREDITAR NO ENDEREÇO ───────────────────
 *
 * O Mercado Pago traz na volta um `status` na barra de endereço. Ele é
 * palpite, não prova: qualquer pessoa digita `?status=approved` e chega
 * aqui. Quem liga o plano é o webhook, no servidor, depois de perguntar o
 * estado real na API deles.
 *
 * Então esta tela não decide nada — ela OLHA o pedido no banco e conta o
 * que encontrou. É a diferença entre "o site disse que deu certo" e "o
 * pagamento consta".
 *
 * ── E ELA ESPERA UM POUCO, DE PROPÓSITO ───────────────────────────────
 *
 * O aviso do Mercado Pago e a volta da pessoa são duas viagens diferentes,
 * e às vezes a pessoa chega primeiro. Um "não consta" mostrado no primeiro
 * segundo estaria errado na metade das vezes. Por isso a tela reconsulta
 * algumas vezes antes de dizer qualquer coisa — e, se mesmo assim não
 * constar, ela NÃO diz que deu errado: diz que ainda não constou, que é o
 * que se sabe.
 *
 * Pix e cartão caem em segundos. Boleto leva dias, e a tela precisa dizer
 * isso sem parecer defeito.
 */

type Estado = "procurando" | "pago" | "esperando" | "recusado" | "sem-pedido";

const TENTATIVAS = 6;
const ESPERA_MS = 2500;

export function PagamentoPage({ deuCerto }: { deuCerto: boolean }) {
  useTituloDaPagina(deuCerto ? "Pagamento" : "Pagamento não concluído");
  const [busca] = useSearchParams();
  const pedidoId = busca.get("pedido") ?? "";

  const [estado, setEstado] = useState<Estado>(deuCerto ? "procurando" : "recusado");
  const [oQueComprou, setOQueComprou] = useState<string>("");

  useEffect(() => {
    if (!deuCerto) return;
    if (!pedidoId) {
      setEstado("sem-pedido");
      return;
    }

    let vivo = true;
    let tentativas = 0;

    async function olhar() {
      const sb = supabase();
      if (!sb) return;

      const { data } = await sb
        .from("pedidos")
        .select("status, tipo, plano, dias")
        .eq("id", pedidoId)
        .maybeSingle();

      if (!vivo) return;

      if (data?.status === "pago") {
        setOQueComprou(
          data.tipo === "destaque_profissional"
            ? `Seu cadastro fica em destaque por ${data.dias} dias.`
            : `Seu plano está ativo por ${data.dias} dias.`
        );
        setEstado("pago");
        return;
      }

      tentativas += 1;
      if (tentativas >= TENTATIVAS) {
        setEstado("esperando");
        return;
      }
      setTimeout(olhar, ESPERA_MS);
    }

    olhar();
    return () => {
      vivo = false;
    };
  }, [deuCerto, pedidoId]);

  const zap = `https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(
    `Olá! Fiz um pagamento no Ei Emprego e queria conferir. Número do pedido: ${pedidoId || "(não sei)"}`
  )}`;

  return (
    <div className="ei">
      <div className="ei-tela ei-pronto">
        <div className="ei-pronto-meio">
          {estado === "pago" && (
            <>
              <span className="ei-pronto-marca" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor"
                     strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5l5.5 5.5L20 7" />
                </svg>
              </span>
              <h1 className="ei-pronto-titulo">Pagamento confirmado</h1>
              <p className="ei-pronto-frase">{oQueComprou}</p>
            </>
          )}

          {estado === "procurando" && (
            <>
              <h1 className="ei-pronto-titulo">Conferindo o pagamento…</h1>
              <p className="ei-pronto-frase">
                Só um instante. Estamos esperando a confirmação do Mercado Pago.
              </p>
            </>
          )}

          {/* Não é erro, e a tela não pode dar a entender que é. Boleto
              leva dias; Pix e cartão às vezes demoram alguns minutos. */}
          {estado === "esperando" && (
            <>
              <h1 className="ei-pronto-titulo">Recebemos seu pagamento</h1>
              <p className="ei-pronto-frase">
                A confirmação ainda não chegou aqui. Se você pagou por Pix ou cartão, costuma
                levar alguns minutos; por boleto, alguns dias. Assim que confirmar, o plano liga
                sozinho e você não precisa fazer mais nada.
              </p>
            </>
          )}

          {estado === "recusado" && (
            <>
              <h1 className="ei-pronto-titulo">O pagamento não foi concluído</h1>
              <p className="ei-pronto-frase">
                Nada foi cobrado. Você pode tentar de novo, com outra forma de pagamento se
                preferir.
              </p>
            </>
          )}

          {estado === "sem-pedido" && (
            <>
              <h1 className="ei-pronto-titulo">Não achei este pagamento</h1>
              <p className="ei-pronto-frase">
                O endereço veio sem o número do pedido. Se você pagou, fale com a gente que
                conferimos na hora.
              </p>
            </>
          )}
        </div>

        <div className="ei-pronto-pe">
          <Link className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto" to="/painel-empresa">
            Ir para o meu painel
          </Link>
          {/* O caminho do suporte fica em TODOS os casos, inclusive no que
              deu certo: quem paga e fica na dúvida precisa achar gente sem
              procurar. Só que ele nunca é o botão principal. */}
          <a className="ei-btn ei-btn-contorno ei-btn-largo" href={zap}
             target="_blank" rel="noopener noreferrer">
            Falar com a gente
          </a>
        </div>
      </div>
    </div>
  );
}
