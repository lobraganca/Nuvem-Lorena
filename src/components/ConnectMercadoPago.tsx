import { useAvena } from "../store/AvenaContext";
import { PAYMENTS_ENABLED } from "../lib/payments/mercadopago";
import type { Business } from "../types";

/**
 * Each agency receives directly in its own Mercado Pago account; Avena's
 * commission is retained by Mercado Pago at the moment of the sale. So every
 * agency has to authorise Avena once, and until it does there is nowhere to
 * send the money.
 */
export function ConnectMercadoPago({ business }: { business: Business }) {
  const { setMercadoPagoLink } = useAvena();
  const connected = business.mercadoPago?.connected === true;

  function connect() {
    if (PAYMENTS_ENABLED) {
      // Real OAuth: Mercado Pago asks the agency to authorise Avena and sends
      // the code back to the backend, which exchanges it for a seller token.
      window.location.href = `/api/mercadopago/connect?businessId=${business.id}`;
      return;
    }
    // No backend yet: record the intent so the rest of the flow can be tried.
    setMercadoPagoLink(business.id, {
      connected: true,
      connectedAt: new Date().toISOString(),
      accountLabel: `${business.email} (simulado)`,
    });
  }

  return (
    <div className={`mp-card ${connected ? "mp-card-connected" : ""}`}>
      <h3>Recebimento pelo Mercado Pago</h3>

      {connected ? (
        <>
          <p className="muted">
            Conta conectada
            {business.mercadoPago?.accountLabel
              ? `: ${business.mercadoPago.accountLabel}`
              : "."}{" "}
            O valor das reservas cai direto na sua conta, já com a taxa da Avena
            descontada. A Avena não retém o seu dinheiro em momento nenhum.
          </p>
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              if (
                confirm(
                  "Desconectar a conta? Seus passeios deixam de aceitar reserva pelo app até você conectar de novo."
                )
              ) {
                setMercadoPagoLink(business.id, { connected: false });
              }
            }}
          >
            Desconectar conta
          </button>
        </>
      ) : (
        <>
          <p className="muted">
            Para vender pelo Avena você precisa conectar a sua conta do Mercado
            Pago. O pagamento do viajante vai direto para você; a Avena recebe
            só a taxa de serviço, retida automaticamente na hora da venda.
            Enquanto a conta não estiver conectada, seus passeios aparecem na
            busca mas não aceitam reserva.
          </p>
          <button type="button" className="btn-primary" onClick={connect}>
            Conectar minha conta Mercado Pago
          </button>
        </>
      )}

      {!PAYMENTS_ENABLED && (
        <p className="muted mp-sandbox-note">
          Ambiente de demonstração: o botão apenas simula a conexão. Na versão de
          produção ele abre o Mercado Pago para você autorizar a Avena.
        </p>
      )}
    </div>
  );
}
